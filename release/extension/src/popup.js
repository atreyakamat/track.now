import { auth, db } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY_HABITS = 'tracknow_habits';
const STORAGE_KEY_COMPLETIONS = 'tracknow_completions';

function getTodayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDayKey() {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
}

async function loadLocalData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_HABITS, STORAGE_KEY_COMPLETIONS], (result) => {
      resolve({
        habits: result[STORAGE_KEY_HABITS] || [],
        completions: result[STORAGE_KEY_COMPLETIONS] || {}
      });
    });
  });
}

async function syncToLocal(habits, completions) {
  // completions from Firestore are documents with { habitId, date }
  // we need to convert them to { "date": [habitId1, habitId2] }
  const localCompletions = {};
  completions.forEach(c => {
    if (!localCompletions[c.date]) {
      localCompletions[c.date] = [];
    }
    localCompletions[c.date].push(c.habitId);
  });

  await chrome.storage.local.set({
    [STORAGE_KEY_HABITS]: habits,
    [STORAGE_KEY_COMPLETIONS]: localCompletions
  });
}

function getTodayHabits(habits) {
  const today = getTodayDayKey();
  return habits
    .filter((habit) => Array.isArray(habit.days) && habit.days.includes(today))
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

function getTodayCompletions(completions) {
  return completions[getTodayString()] || [];
}

function formatTime(time) {
  if (!time) return 'Anytime';
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getReminderSummary(habit) {
  const reminders = Array.isArray(habit.reminderTimes) && habit.reminderTimes.length > 0
    ? habit.reminderTimes
    : [habit.time || '09:00'];
  if (reminders.length === 1) return formatTime(reminders[0]);
  return `${formatTime(reminders[0])} +${reminders.length - 1}`;
}

function getMissionLabel(habit) {
  const duration = habit.durationDays || 21;
  const completedCount = Number(habit.completedSessions || 0);
  const currentDay = Math.min(completedCount + 1, duration);
  return `Day ${currentDay} / ${duration}`;
}

async function toggleHabit(habitId) {
  const user = auth.currentUser;
  if (!user) return;

  const today = getTodayString();
  const { completions } = await loadLocalData();
  
  if (!Array.isArray(completions[today])) {
    completions[today] = [];
  }

  const index = completions[today].indexOf(habitId);

  if (index >= 0) {
    // Unmark complete in Firestore
    const q = query(
      collection(db, 'completions'),
      where('userId', '==', user.uid),
      where('habitId', '==', habitId),
      where('date', '==', today)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'completions', d.id));
    }
    completions[today].splice(index, 1);
  } else {
    // Mark complete in Firestore
    await addDoc(collection(db, 'completions'), {
      habitId,
      userId: user.uid,
      date: today,
      completed: true,
      completedAt: serverTimestamp()
    });
    completions[today].push(habitId);
  }

  await chrome.storage.local.set({ [STORAGE_KEY_COMPLETIONS]: completions });
  await renderApp();
}

function renderList(target, habits, completed) {
  target.innerHTML = habits.map((habit) => `
    <div class="habit${completed ? ' done' : ''}">
      <div class="emoji">${habit.emoji || '✅'}</div>
      <div>
        <strong>${habit.name}</strong>
        <span>${getReminderSummary(habit)} · ${getMissionLabel(habit)}</span>
      </div>
      <button class="check${completed ? ' done' : ''}" data-habit-id="${habit.id}">
        ${completed ? '✓' : ''}
      </button>
    </div>
  `).join('');
}

async function renderApp() {
  const { habits, completions } = await loadLocalData();
  const todayHabits = getTodayHabits(habits);
  const todayCompletions = getTodayCompletions(completions);
  const pending = todayHabits.filter((habit) => !todayCompletions.includes(habit.id));
  const completed = todayHabits.filter((habit) => todayCompletions.includes(habit.id));

  const total = todayHabits.length;
  const done = completed.length;
  const pendingCount = pending.length;
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  const ring = document.getElementById('progress-ring');
  if (ring) ring.style.setProperty('--progress-angle', `${Math.round((percentage / 100) * 360)}deg`);
  
  const val = document.getElementById('progress-value');
  if (val) val.textContent = `${percentage}%`;
  
  const sd = document.getElementById('stat-done');
  if (sd) sd.textContent = String(done);
  
  const st = document.getElementById('stat-total');
  if (st) st.textContent = String(total);
  
  const sp = document.getElementById('stat-pending');
  if (sp) sp.textContent = String(pendingCount);

  const heroTitle = document.getElementById('hero-title');
  const heroBody = document.getElementById('hero-body');
  const emptyState = document.getElementById('empty-state');
  const pendingList = document.getElementById('pending-list');
  const completedList = document.getElementById('completed-list');

  if (habits.length === 0) {
    if (heroTitle) heroTitle.textContent = 'No missions yet';
    if (heroBody) heroBody.textContent = 'Create your first habit in the main app to make the extension useful.';
    if (pendingList) pendingList.innerHTML = '';
    if (completedList) completedList.innerHTML = '';
    if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent = 'No habits found. Open the app to create your first mission.';
    }
    return;
  }

  if (todayHabits.length === 0) {
    if (heroTitle) heroTitle.textContent = 'Nothing scheduled today';
    if (heroBody) heroBody.textContent = 'Track.now keeps rest days quiet. Your next mission will show up when its day arrives.';
    if (pendingList) pendingList.innerHTML = '';
    if (completedList) completedList.innerHTML = '';
    if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent = 'No habits are scheduled for today.';
    }
    return;
  }

  if (emptyState) emptyState.hidden = true;
  if (heroTitle) heroTitle.textContent = pendingCount === 0
    ? 'Everything for today is complete'
    : `${pendingCount} mission${pendingCount === 1 ? '' : 's'} still open`;
  if (heroBody) heroBody.textContent = pendingCount === 0
    ? 'You can leave the rest of the day uncluttered.'
    : 'Use one tap to complete the next action without opening the full app.';

  if (pendingList) renderList(pendingList, pending, false);
  if (completedList) renderList(completedList, completed, true);

  document.querySelectorAll('.check').forEach((button) => {
    button.onclick = async (event) => {
      event.preventDefault();
      const habitId = event.currentTarget.dataset.habitId;
      if (habitId) {
        await toggleHabit(habitId);
      }
    };
  });
}

// Auth UI handling
const authSection = document.getElementById('auth-section');
const mainContent = document.getElementById('main-content');
const loginForm = document.getElementById('login-form');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');

loginForm.onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  authError.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    authError.textContent = err.message;
  }
};

logoutBtn.onclick = async () => {
  await signOut(auth);
  await chrome.storage.local.clear();
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    authSection.hidden = true;
    mainContent.hidden = false;
    
    // Subscribe to habits
    const hQuery = query(collection(db, 'habits'), where('userId', '==', user.uid));
    onSnapshot(hQuery, async (hSnap) => {
        const habits = hSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Fetch completions (maybe just for last 7 days and today)
        // For simplicity, let's just fetch all completions for this user for now, or just recent ones.
        // Actually, let's fetch only recent ones to avoid large data.
        const cQuery = query(collection(db, 'completions'), where('userId', '==', user.uid));
        const cSnap = await getDocs(cQuery);
        const completions = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        await syncToLocal(habits, completions);
        await renderApp();
    });

  } else {
    authSection.hidden = false;
    mainContent.hidden = true;
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY_HABITS] || changes[STORAGE_KEY_COMPLETIONS]) {
    renderApp();
  }
});

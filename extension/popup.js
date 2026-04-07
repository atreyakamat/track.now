const STORAGE_KEY_HABITS = 'tracknow_habits'
const STORAGE_KEY_COMPLETIONS = 'tracknow_completions'

function getTodayString() {
  return new Date().toISOString().split('T')[0]
}

function getTodayDayKey() {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return days[new Date().getDay()]
}

function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function loadData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_HABITS, STORAGE_KEY_COMPLETIONS], (result) => {
      resolve({
        habits: result[STORAGE_KEY_HABITS] || [],
        completions: result[STORAGE_KEY_COMPLETIONS] || {}
      })
    })
  })
}

function saveCompletions(completions) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY_COMPLETIONS]: completions }, resolve)
  })
}

function getTodayHabits(habits) {
  const today = getTodayDayKey()
  return habits.filter(h => h.days && h.days.includes(today))
}

function getTodayCompletions(completions) {
  const today = getTodayString()
  return completions[today] || []
}

function isCompleted(habitId, todayCompletions) {
  return todayCompletions.includes(habitId)
}

async function toggleHabit(habitId) {
  const { habits, completions } = await loadData()
  const today = getTodayString()

  if (!completions[today]) {
    completions[today] = []
  }

  const idx = completions[today].indexOf(habitId)
  if (idx >= 0) {
    completions[today].splice(idx, 1)
  } else {
    completions[today].push(habitId)
    showCompletionEffect(habitId)
  }

  await saveCompletions(completions)
  await renderApp()
}

function showCompletionEffect(habitId) {
  const item = document.querySelector(`[data-habit-id="${habitId}"]`)
  if (item) {
    item.style.transform = 'scale(1.02)'
    setTimeout(() => { item.style.transform = '' }, 200)
  }
}

async function renderApp() {
  const { habits, completions } = await loadData()
  const todayHabits = getTodayHabits(habits)
  const todayCompletions = getTodayCompletions(completions)
  const completedCount = todayHabits.filter(h => isCompleted(h.id, todayCompletions)).length
  const total = todayHabits.length
  const rate = total > 0 ? (completedCount / total) : 0

  const appContent = document.getElementById('app-content')

  if (habits.length === 0) {
    appContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">📝</div>
        <p>No habits found. Open the app to add your first habit!</p>
      </div>
    `
    return
  }

  if (todayHabits.length === 0) {
    appContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">☀️</div>
        <p>No habits scheduled for today. Enjoy your rest day!</p>
      </div>
    `
    return
  }

  const allDone = completedCount === total

  let html = `
    <div class="progress-bar-wrap">
      <div class="progress-label">
        <span>${getFormattedDate()}</span>
        <span>${completedCount}/${total} done</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${rate * 100}%"></div>
      </div>
    </div>
  `

  if (allDone) {
    html += `
      <div class="all-done">
        <div class="trophy">🎉</div>
        <p>All habits done for today!</p>
      </div>
    `
  }

  const pending = todayHabits.filter(h => !isCompleted(h.id, todayCompletions))
  const completed = todayHabits.filter(h => isCompleted(h.id, todayCompletions))

  if (pending.length > 0) {
    html += `<div class="date-label">Pending</div><div class="habit-list">`
    for (const habit of pending) {
      html += renderHabitItem(habit, false)
    }
    html += '</div>'
  }

  if (completed.length > 0) {
    html += `<div class="date-label">Completed ✅</div><div class="habit-list">`
    for (const habit of completed) {
      html += renderHabitItem(habit, true)
    }
    html += '</div>'
  }

  appContent.innerHTML = html

  document.querySelectorAll('.habit-item').forEach(item => {
    item.addEventListener('click', () => {
      const habitId = item.dataset.habitId
      if (habitId) toggleHabit(habitId)
    })
  })
}

function renderHabitItem(habit, completed) {
  const streakText = habit.streak > 0 ? `🔥 ${habit.streak} day streak` : 'Start your streak!'
  return `
    <div class="habit-item${completed ? ' completed' : ''}" data-habit-id="${habit.id}">
      <div class="habit-emoji">${habit.emoji || '✅'}</div>
      <div class="habit-info">
        <div class="habit-name">${habit.name}</div>
        <div class="habit-streak">${streakText}</div>
      </div>
      <div class="habit-check${completed ? ' completed' : ''}"></div>
    </div>
  `
}

function seedDefaultHabits() {
  const defaultHabits = [
    { id: 'demo-1', name: 'Morning Run', emoji: '🏃', days: ['mon','tue','wed','thu','fri'], time: '07:00', streak: 5, category: 'fitness' },
    { id: 'demo-2', name: 'Read 30 mins', emoji: '📚', days: ['mon','tue','wed','thu','fri','sat','sun'], time: '21:00', streak: 12, category: 'study' },
    { id: 'demo-3', name: 'Meditation', emoji: '🧘', days: ['mon','tue','wed','thu','fri','sat','sun'], time: '07:30', streak: 3, category: 'mindfulness' }
  ]

  chrome.storage.local.get([STORAGE_KEY_HABITS], (result) => {
    if (!result[STORAGE_KEY_HABITS] || result[STORAGE_KEY_HABITS].length === 0) {
      chrome.storage.local.set({ [STORAGE_KEY_HABITS]: defaultHabits })
    }
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  seedDefaultHabits()
  // Brief delay to allow chrome.storage to finish initializing on first load
  await new Promise(resolve => setTimeout(resolve, 100))
  await renderApp()
})

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY_HABITS] || changes[STORAGE_KEY_COMPLETIONS]) {
    renderApp()
  }
})

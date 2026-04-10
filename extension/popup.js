const STORAGE_KEY_HABITS = 'tracknow_habits'
const STORAGE_KEY_COMPLETIONS = 'tracknow_completions'

function getTodayString() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTodayDayKey() {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
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
  return habits
    .filter((habit) => Array.isArray(habit.days) && habit.days.includes(today))
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
}

function getTodayCompletions(completions) {
  return completions[getTodayString()] || []
}

function formatTime(time) {
  if (!time) return 'Anytime'

  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  })
}

function getReminderSummary(habit) {
  const reminders = Array.isArray(habit.reminderTimes) && habit.reminderTimes.length > 0
    ? habit.reminderTimes
    : [habit.time || '09:00']

  if (reminders.length === 1) {
    return formatTime(reminders[0])
  }

  return `${formatTime(reminders[0])} +${reminders.length - 1}`
}

function getMissionLabel(habit) {
  const duration = habit.durationDays || 21
  const completedCount = Number(habit.completedSessions || 0)
  const currentDay = Math.min(completedCount + 1, duration)
  return `Day ${currentDay} / ${duration}`
}

async function toggleHabit(habitId) {
  const { completions } = await loadData()
  const today = getTodayString()

  if (!Array.isArray(completions[today])) {
    completions[today] = []
  }

  const index = completions[today].indexOf(habitId)

  if (index >= 0) {
    completions[today].splice(index, 1)
  } else {
    completions[today].push(habitId)
  }

  await saveCompletions(completions)
  await renderApp()
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
  `).join('')
}

async function renderApp() {
  const { habits, completions } = await loadData()
  const todayHabits = getTodayHabits(habits)
  const todayCompletions = getTodayCompletions(completions)
  const pending = todayHabits.filter((habit) => !todayCompletions.includes(habit.id))
  const completed = todayHabits.filter((habit) => todayCompletions.includes(habit.id))

  const total = todayHabits.length
  const done = completed.length
  const pendingCount = pending.length
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0

  document.getElementById('progress-ring').style.setProperty('--progress-angle', `${Math.round((percentage / 100) * 360)}deg`)
  document.getElementById('progress-value').textContent = `${percentage}%`
  document.getElementById('stat-done').textContent = String(done)
  document.getElementById('stat-total').textContent = String(total)
  document.getElementById('stat-pending').textContent = String(pendingCount)

  const heroTitle = document.getElementById('hero-title')
  const heroBody = document.getElementById('hero-body')
  const emptyState = document.getElementById('empty-state')
  const pendingList = document.getElementById('pending-list')
  const completedList = document.getElementById('completed-list')

  if (habits.length === 0) {
    heroTitle.textContent = 'No missions yet'
    heroBody.textContent = 'Create your first habit in the main app to make the extension useful.'
    pendingList.innerHTML = ''
    completedList.innerHTML = ''
    emptyState.hidden = false
    emptyState.textContent = 'No habits found. Open the app to create your first mission.'
    return
  }

  if (todayHabits.length === 0) {
    heroTitle.textContent = 'Nothing scheduled today'
    heroBody.textContent = 'Track.now keeps rest days quiet. Your next mission will show up when its day arrives.'
    pendingList.innerHTML = ''
    completedList.innerHTML = ''
    emptyState.hidden = false
    emptyState.textContent = 'No habits are scheduled for today.'
    return
  }

  emptyState.hidden = true
  heroTitle.textContent = pendingCount === 0
    ? 'Everything for today is complete'
    : `${pendingCount} mission${pendingCount === 1 ? '' : 's'} still open`
  heroBody.textContent = pendingCount === 0
    ? 'You can leave the rest of the day uncluttered.'
    : 'Use one tap to complete the next action without opening the full app.'

  renderList(pendingList, pending, false)
  renderList(completedList, completed, true)

  document.querySelectorAll('.check').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault()
      const habitId = event.currentTarget.dataset.habitId
      if (habitId) {
        await toggleHabit(habitId)
      }
    })
  })
}

function seedDefaultHabits() {
  const defaultHabits = [
    { id: 'demo-1', name: 'Read 10 pages', emoji: '📚', days: ['mon', 'tue', 'wed', 'thu', 'fri'], time: '20:00', reminderTimes: ['20:00'], durationDays: 21, completedSessions: 13 },
    { id: 'demo-2', name: 'Hydration check', emoji: '💧', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], time: '09:00', reminderTimes: ['09:00', '14:00', '19:00'], durationDays: 45, completedSessions: 7 },
    { id: 'demo-3', name: 'Evening reset', emoji: '🧘', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], time: '19:00', reminderTimes: ['19:00'], durationDays: 21, completedSessions: 11 }
  ]

  chrome.storage.local.get([STORAGE_KEY_HABITS], (result) => {
    if (!result[STORAGE_KEY_HABITS] || result[STORAGE_KEY_HABITS].length === 0) {
      chrome.storage.local.set({ [STORAGE_KEY_HABITS]: defaultHabits })
    }
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  seedDefaultHabits()
  await new Promise((resolve) => setTimeout(resolve, 120))
  await renderApp()
})

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY_HABITS] || changes[STORAGE_KEY_COMPLETIONS]) {
    renderApp()
  }
})

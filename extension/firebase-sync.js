const ALARM_NAME = 'habit-reminder'
const STORAGE_KEY_HABITS = 'tracknow_habits'
const STORAGE_KEY_COMPLETIONS = 'tracknow_completions'

chrome.runtime.onInstalled.addListener(() => {
  setupDailyAlarm()
  scheduleHabitAlarms()
})

chrome.runtime.onStartup.addListener(() => {
  setupDailyAlarm()
  scheduleHabitAlarms()
})

function setupDailyAlarm() {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(ALARM_NAME, {
        when: getNextMorningTime(),
        periodInMinutes: 24 * 60
      })
    }
  })
}

function getNextMorningTime() {
  const now = new Date()
  const morning = new Date()
  morning.setHours(8, 0, 0, 0)
  if (morning <= now) {
    morning.setDate(morning.getDate() + 1)
  }
  return morning.getTime()
}

async function scheduleHabitAlarms() {
  const { tracknow_habits: habits } = await chrome.storage.local.get([STORAGE_KEY_HABITS])
  if (!habits || habits.length === 0) return

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const today = days[new Date().getDay()]
  const todayHabits = habits.filter(h => h.days && h.days.includes(today))

  for (const habit of todayHabits) {
    if (!habit.time) continue
    const [hours, minutes] = habit.time.split(':').map(Number)
    const alarmTime = new Date()
    alarmTime.setHours(hours, minutes, 0, 0)

    if (alarmTime > new Date()) {
      const alarmKey = `habit-${habit.id}`
      chrome.alarms.create(alarmKey, { when: alarmTime.getTime() })
    }
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await handleDailyReminder()
    await scheduleHabitAlarms()
    return
  }

  if (alarm.name.startsWith('habit-')) {
    const habitId = alarm.name.replace('habit-', '')
    await handleHabitAlarm(habitId)
  }
})

async function handleDailyReminder() {
  const { tracknow_habits: habits, tracknow_completions: completions } = await chrome.storage.local.get([
    STORAGE_KEY_HABITS,
    STORAGE_KEY_COMPLETIONS
  ])

  if (!habits || habits.length === 0) return

  const today = new Date().toISOString().split('T')[0]
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const todayKey = days[new Date().getDay()]
  const todayHabits = habits.filter(h => h.days && h.days.includes(todayKey))
  const todayCompletions = (completions && completions[today]) ? completions[today] : []
  const pendingCount = todayHabits.filter(h => !todayCompletions.includes(h.id)).length

  if (pendingCount > 0) {
    chrome.notifications.create('daily-reminder', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⚡ Track.now — Daily Check-in',
      message: `You have ${pendingCount} habit${pendingCount !== 1 ? 's' : ''} to complete today. Keep your streak going! 🔥`,
      priority: 1
    })
  }
}

async function handleHabitAlarm(habitId) {
  const { tracknow_habits: habits, tracknow_completions: completions } = await chrome.storage.local.get([
    STORAGE_KEY_HABITS,
    STORAGE_KEY_COMPLETIONS
  ])

  if (!habits) return

  const habit = habits.find(h => h.id === habitId)
  if (!habit) return

  const today = new Date().toISOString().split('T')[0]
  const todayCompletions = (completions && completions[today]) ? completions[today] : []

  if (todayCompletions.includes(habitId)) return

  chrome.notifications.create(`habit-${habitId}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `${habit.emoji || '⚡'} Time for: ${habit.name}`,
    message: `Keep your streak alive! ${habit.streak > 0 ? `🔥 ${habit.streak} days and counting` : 'Start your streak today!'}`,
    priority: 2,
    buttons: [
      { title: '✅ Mark Complete' },
      { title: '⏰ Remind me later' }
    ]
  })
}

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith('habit-')) return

  const habitId = notificationId.replace('habit-', '')

  if (buttonIndex === 0) {
    const { tracknow_completions: completions } = await chrome.storage.local.get([STORAGE_KEY_COMPLETIONS])
    const today = new Date().toISOString().split('T')[0]
    const updated = completions || {}

    if (!updated[today]) updated[today] = []
    if (!updated[today].includes(habitId)) {
      updated[today].push(habitId)
      await chrome.storage.local.set({ [STORAGE_KEY_COMPLETIONS]: updated })
    }

    chrome.notifications.clear(notificationId)

    chrome.notifications.create('completion-confirm', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🎉 Habit completed!',
      message: 'Great job! Keep building that streak.',
      priority: 0
    })
  } else if (buttonIndex === 1) {
    const snoozeTime = Date.now() + 30 * 60 * 1000
    chrome.alarms.create(`habit-${habitId}`, { when: snoozeTime })
    chrome.notifications.clear(notificationId)
  }
})

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId)
  chrome.action.openPopup()
})

chrome.storage.onChanged.addListener((changes) => {
  if (changes[STORAGE_KEY_HABITS]) {
    scheduleHabitAlarms()
  }
})

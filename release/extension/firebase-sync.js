const DAILY_ALARM_NAME = 'tracknow-daily-reminder'
const STORAGE_KEY_HABITS = 'tracknow_habits'
const STORAGE_KEY_COMPLETIONS = 'tracknow_completions'
const PRE_NOTIFICATION_MINUTES = 20

chrome.runtime.onInstalled.addListener(() => {
  setupDailyAlarm()
  scheduleHabitAlarms()
})

chrome.runtime.onStartup.addListener(() => {
  setupDailyAlarm()
  scheduleHabitAlarms()
})

function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDayKey(date = new Date()) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()]
}

function getReminderTimes(habit) {
  return Array.isArray(habit.reminderTimes) && habit.reminderTimes.length > 0
    ? habit.reminderTimes
    : [habit.time || '09:00']
}

function setupDailyAlarm() {
  chrome.alarms.get(DAILY_ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(DAILY_ALARM_NAME, {
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

async function loadHabitsAndCompletions() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_HABITS, STORAGE_KEY_COMPLETIONS], (result) => {
      resolve({
        habits: result[STORAGE_KEY_HABITS] || [],
        completions: result[STORAGE_KEY_COMPLETIONS] || {}
      })
    })
  })
}

function getAllAlarms() {
  return new Promise((resolve) => {
    chrome.alarms.getAll((alarms) => resolve(alarms || []))
  })
}

function clearAlarm(name) {
  return new Promise((resolve) => {
    chrome.alarms.clear(name, () => resolve())
  })
}

async function scheduleHabitAlarms() {
  const { habits } = await loadHabitsAndCompletions()
  if (!Array.isArray(habits) || habits.length === 0) return

  const existingAlarms = await getAllAlarms()
  await Promise.all(
    existingAlarms
      .filter((alarm) => alarm.name.startsWith('habit:'))
      .map((alarm) => clearAlarm(alarm.name))
  )

  const todayHabits = habits.filter((habit) => Array.isArray(habit.days) && habit.days.includes(getDayKey()))

  for (const habit of todayHabits) {
    for (const reminderTime of getReminderTimes(habit)) {
      scheduleReminderAlarm(habit.id, reminderTime, 'upcoming', PRE_NOTIFICATION_MINUTES)
      scheduleReminderAlarm(habit.id, reminderTime, 'exact', 0)
    }
  }
}

function scheduleReminderAlarm(habitId, reminderTime, phase, offsetMinutes) {
  const [hours, minutes] = reminderTime.split(':').map(Number)
  const alarmTime = new Date()
  alarmTime.setHours(hours, minutes, 0, 0)
  alarmTime.setMinutes(alarmTime.getMinutes() - offsetMinutes)

  if (alarmTime <= new Date()) return

  chrome.alarms.create(`habit:${habitId}:${reminderTime}:${phase}`, { when: alarmTime.getTime() })
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === DAILY_ALARM_NAME) {
    await handleDailyReminder()
    await scheduleHabitAlarms()
    return
  }

  if (alarm.name.startsWith('habit:')) {
    const [, habitId, reminderTime, phase] = alarm.name.split(':')
    await handleHabitAlarm(habitId, reminderTime, phase)
  }
})

async function handleDailyReminder() {
  const { habits, completions } = await loadHabitsAndCompletions()

  if (!Array.isArray(habits) || habits.length === 0) return

  const todayKey = getDateKey()
  const todayHabits = habits.filter((habit) => Array.isArray(habit.days) && habit.days.includes(getDayKey()))
  const todayCompletions = Array.isArray(completions[todayKey]) ? completions[todayKey] : []
  const pendingCount = todayHabits.filter((habit) => !todayCompletions.includes(habit.id)).length

  if (pendingCount > 0) {
    chrome.notifications.create('tracknow-daily', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Track.now check-in',
      message: `You have ${pendingCount} mission${pendingCount === 1 ? '' : 's'} waiting today.`,
      priority: 1
    })
  }
}

async function handleHabitAlarm(habitId, reminderTime, phase) {
  const { habits, completions } = await loadHabitsAndCompletions()
  const habit = habits.find((item) => item.id === habitId)

  if (!habit) return

  const todayKey = getDateKey()
  const todayCompletions = Array.isArray(completions[todayKey]) ? completions[todayKey] : []
  if (todayCompletions.includes(habitId)) return

  const phaseTitle = phase === 'upcoming' ? 'Upcoming mission' : 'Time for your mission'
  const displayTime = reminderTime === 'snooze' ? 'soon' : reminderTime
  const phaseBody = phase === 'upcoming'
    ? `${habit.name} starts in ${PRE_NOTIFICATION_MINUTES} minutes at ${displayTime}.`
    : `${habit.name} is scheduled for ${displayTime}. Tap to complete or snooze.`

  chrome.notifications.create(`habit:${habitId}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `${habit.emoji || '⚡'} ${phaseTitle}`,
    message: phaseBody,
    priority: phase === 'exact' ? 2 : 1,
    buttons: phase === 'exact'
      ? [{ title: '✅ Mark complete' }, { title: '⏰ Remind me later' }]
      : []
  })
}

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith('habit:')) return

  const [, habitId] = notificationId.split(':')
  const { completions } = await loadHabitsAndCompletions()
  const todayKey = getDateKey()

  if (buttonIndex === 0) {
    if (!Array.isArray(completions[todayKey])) {
      completions[todayKey] = []
    }

    if (!completions[todayKey].includes(habitId)) {
      completions[todayKey].push(habitId)
      await chrome.storage.local.set({ [STORAGE_KEY_COMPLETIONS]: completions })
    }

    chrome.notifications.clear(notificationId)
  }

  if (buttonIndex === 1) {
    chrome.alarms.create(`habit:${habitId}:snooze:exact`, { when: Date.now() + 30 * 60 * 1000 })
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

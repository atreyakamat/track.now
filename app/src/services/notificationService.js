import { formatTimeLabel, normalizeReminderTimes } from 'src/utils/habitModel'

// Stores pending alarm metadata so the service worker can fire notifications
// even when the page is not in focus. Keys are habit IDs.
const pendingAlarms = {}
const alarmKeysByHabit = {}
const PRE_NOTIFICATION_MINUTES = 20

function registerAlarmKey(habitId, alarmKey) {
  if (!alarmKeysByHabit[habitId]) {
    alarmKeysByHabit[habitId] = new Set()
  }

  alarmKeysByHabit[habitId].add(alarmKey)
}

function unregisterAlarmKey(habitId, alarmKey) {
  if (!alarmKeysByHabit[habitId]) return
  alarmKeysByHabit[habitId].delete(alarmKey)

  if (alarmKeysByHabit[habitId].size === 0) {
    delete alarmKeysByHabit[habitId]
  }
}

function getReminderTarget(time, offsetMinutes = 0, dayShift = 0) {
  const [hours, minutes] = time.split(':').map(Number)
  const now = new Date()
  const target = new Date()

  target.setDate(target.getDate() + dayShift)
  target.setHours(hours, minutes, 0, 0)
  target.setMinutes(target.getMinutes() - offsetMinutes)

  return { now, target }
}

export const notificationService = {
  async requestPermission() {
    if (!('Notification' in window)) return false
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  },

  async scheduleHabitReminder(habit, options = {}) {
    const {
      preReminder = true,
      exactReminder = true,
      requestPermission = false,
      completedSessionIds = []
    } = options

    this.cancelHabitReminder(habit.id)

    const hasPermission = requestPermission
      ? await this.requestPermission()
      : (typeof Notification !== 'undefined' && Notification.permission === 'granted')

    if (!hasPermission || (!preReminder && !exactReminder)) return

    const reminderTimes = normalizeReminderTimes(habit.reminderTimes, habit.time)
    const completedSessionSet = new Set((completedSessionIds || []).filter(Boolean))

    for (const reminderTime of reminderTimes) {
      if (completedSessionSet.has(reminderTime)) continue

      if (preReminder) {
        await this.scheduleSingleReminder(habit, reminderTime, 'upcoming', PRE_NOTIFICATION_MINUTES)
      }

      if (exactReminder) {
        await this.scheduleSingleReminder(habit, reminderTime, 'now', 0)
      }
    }
  },

  async scheduleSingleReminder(habit, reminderTime, phase, offsetMinutes) {
    const { now, target: exactTarget } = getReminderTarget(reminderTime, 0)
    let { target } = getReminderTarget(reminderTime, offsetMinutes)

    if (phase === 'upcoming') {
      if (exactTarget <= now) {
        target = getReminderTarget(reminderTime, offsetMinutes, 1).target
      } else if (target <= now) {
        return
      }
    } else if (target <= now) {
      target = getReminderTarget(reminderTime, offsetMinutes, 1).target
    }

    const alarmKey = `habit-alarm-${habit.id}-${reminderTime}-${phase}`
    registerAlarmKey(habit.id, alarmKey)

    // Persist alarm metadata so a service worker (if registered) can fire
    // the notification even after the page is reloaded or closed.
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_ALARM',
        alarmKey,
        habitId: habit.id,
        habitName: habit.name,
        habitEmoji: habit.emoji || '✅',
        difficulty: habit.difficulty || 'medium',
        phase,
        reminderTime,
        fireAt: target.getTime()
      })
      return
    }

    // Fallback: in-memory map used when the page remains open.
    // This is intentionally a best-effort mechanism; for reliable
    // cross-session reminders use Capacitor Local Notifications on mobile
    // or the extension's chrome.alarms API.
    if (pendingAlarms[alarmKey]) {
      clearTimeout(pendingAlarms[alarmKey])
    }

    pendingAlarms[alarmKey] = setTimeout(() => {
      delete pendingAlarms[alarmKey]
      unregisterAlarmKey(habit.id, alarmKey)
      this.showNotification(habit, { phase, reminderTime })
    }, target.getTime() - Date.now())
  },

  showNotification(habit, { phase = 'now', reminderTime } = {}) {
    if (Notification.permission !== 'granted') return

    const formattedTime = formatTimeLabel(reminderTime || habit.time || '09:00')
    const title = phase === 'upcoming'
      ? `Upcoming: ${habit.emoji} ${habit.name}`
      : `Time for: ${habit.emoji} ${habit.name}`
    const body = phase === 'upcoming'
      ? `${formattedTime} is coming up in ${PRE_NOTIFICATION_MINUTES} minutes`
      : `Tap in, skip, or delay this mission for ${formattedTime}`

    new Notification(title, {
      body,
      icon: '/icons/favicon-128x128.png',
      tag: `habit-${habit.id}-${reminderTime || habit.time || 'default'}-${phase}`
    })
  },

  cancelHabitReminder(habitId) {
    const alarmKeys = [...(alarmKeysByHabit[habitId] || [])]

    alarmKeys.forEach((alarmKey) => {
      if (pendingAlarms[alarmKey]) {
        clearTimeout(pendingAlarms[alarmKey])
        delete pendingAlarms[alarmKey]
      }

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_ALARM', alarmKey })
      }

      unregisterAlarmKey(habitId, alarmKey)
    })

    if (alarmKeys.length === 0 && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_ALARM_PREFIX', habitId })
    }
  },

  async scheduleAll(habits, options = {}) {
    for (const habit of habits) {
      const completedSessionIds = options.completedSessionIdsByHabit?.[habit.id] || []
      await this.scheduleHabitReminder(habit, {
        ...options,
        completedSessionIds
      })
    }
  }
}

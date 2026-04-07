// Stores pending alarm metadata so the service worker can fire notifications
// even when the page is not in focus. Keys are habit IDs.
const pendingAlarms = {}

export const notificationService = {
  async requestPermission() {
    if (!('Notification' in window)) return false
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  },

  async scheduleHabitReminder(habit) {
    const hasPermission = await this.requestPermission()
    if (!hasPermission) return

    const [hours, minutes] = (habit.time || '09:00').split(':').map(Number)
    const now = new Date()
    const target = new Date()
    target.setHours(hours, minutes, 0, 0)

    if (target <= now) {
      // Schedule for the next occurrence tomorrow
      target.setDate(target.getDate() + 1)
    }

    const alarmKey = `habit-alarm-${habit.id}`

    // Persist alarm metadata so a service worker (if registered) can fire
    // the notification even after the page is reloaded or closed.
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_ALARM',
        alarmKey,
        habitId: habit.id,
        habitName: habit.name,
        habitEmoji: habit.emoji || '✅',
        streak: habit.streak || 0,
        fireAt: target.getTime()
      })
    } else {
      // Fallback: in-memory map used when the page remains open.
      // This is intentionally a best-effort mechanism; for reliable
      // cross-session reminders use Capacitor Local Notifications on mobile
      // or the extension's chrome.alarms API.
      if (pendingAlarms[alarmKey]) {
        clearTimeout(pendingAlarms[alarmKey])
      }
      pendingAlarms[alarmKey] = setTimeout(() => {
        delete pendingAlarms[alarmKey]
        this.showNotification(habit)
      }, target.getTime() - Date.now())
    }
  },

  showNotification(habit) {
    if (Notification.permission !== 'granted') return
    new Notification(`Time for: ${habit.emoji} ${habit.name}`, {
      body: `Keep your streak going! 🔥 ${habit.streak} days`,
      icon: '/icons/favicon-128x128.png',
      tag: `habit-${habit.id}`
    })
  },

  cancelHabitReminder(habitId) {
    const alarmKey = `habit-alarm-${habitId}`
    if (pendingAlarms[alarmKey]) {
      clearTimeout(pendingAlarms[alarmKey])
      delete pendingAlarms[alarmKey]
    }
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_ALARM', alarmKey })
    }
  },

  async scheduleAll(habits) {
    for (const habit of habits) {
      await this.scheduleHabitReminder(habit)
    }
  }
}

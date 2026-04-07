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
      target.setDate(target.getDate() + 1)
    }

    const delay = target.getTime() - now.getTime()
    setTimeout(() => {
      this.showNotification(habit)
    }, delay)
  },

  showNotification(habit) {
    if (Notification.permission !== 'granted') return
    new Notification(`Time for: ${habit.emoji} ${habit.name}`, {
      body: `Keep your streak going! 🔥 ${habit.streak} days`,
      icon: '/icons/favicon-128x128.png',
      tag: `habit-${habit.id}`
    })
  },

  async scheduleAll(habits) {
    for (const habit of habits) {
      await this.scheduleHabitReminder(habit)
    }
  }
}

export const whatsappService = {
  formatStreakMessage(habit) {
    return `🔥 I just completed "${habit.emoji} ${habit.name}" for ${habit.streak} days in a row! Tracking my habits with Track.now 💪`
  },

  shareStreak(habit) {
    const message = encodeURIComponent(this.formatStreakMessage(habit))
    window.open(`https://wa.me/?text=${message}`, '_blank')
  },

  shareAchievement(message) {
    const encoded = encodeURIComponent(message)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  },

  inviteFriend(referralCode) {
    const message = encodeURIComponent(
      `Join me on Track.now - the best habit tracker! Use my invite code: ${referralCode}\nhttps://tracknow.app`
    )
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }
}

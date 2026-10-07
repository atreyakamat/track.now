/**
 * Pure date calculations for execution scheduling and time-aware grouping.
 * All functions accept an optional `now` parameter for pure, deterministic testing.
 */

export function getTodayDateString(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isOverdue(dueDate: string | null, now = new Date()): boolean {
  if (!dueDate) return false
  const today = getTodayDateString(now)
  return dueDate < today
}

export function isDueToday(dueDate: string | null, now = new Date()): boolean {
  if (!dueDate) return false
  const today = getTodayDateString(now)
  return dueDate === today
}

export function isUpcoming(dueDate: string | null, now = new Date()): boolean {
  if (!dueDate) return false
  const today = getTodayDateString(now)
  return dueDate > today
}

export function isHabitScheduledForToday(
  schedule: { frequency?: string; days_of_week?: number[] | null } | null | undefined,
  now = new Date(),
): boolean {
  if (!schedule) return true // Default unscheduled habit is treated as daily
  if (schedule.frequency === 'daily') return true
  if (schedule.frequency === 'weekly' || schedule.frequency === 'custom') {
    if (!schedule.days_of_week || schedule.days_of_week.length === 0) return true
    const dayOfWeek = now.getDay() // 0 = Sun, 1 = Mon, 2 = Tue, ..., 6 = Sat
    return schedule.days_of_week.includes(dayOfWeek)
  }
  return true
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function formatDateRange(start: string | null, end: string | null): string | null {
  const fmt = (v: string) =>
    new Date(`${v}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  if (end) return `Until ${fmt(end)}`
  return null
}

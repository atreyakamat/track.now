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

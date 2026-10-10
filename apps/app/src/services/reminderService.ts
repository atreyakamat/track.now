import type { ItemReminder, ReminderPreset } from '@/types/notifications'
import type { ExecutionItem } from '@/types/domain'

const REMINDERS_STORAGE_PREFIX = 'tracknow_reminders_'

export function getRemindersKey(userId: string): string {
  return `${REMINDERS_STORAGE_PREFIX}${userId}`
}

export function loadUserReminders(userId: string): ItemReminder[] {
  if (!userId || typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(getRemindersKey(userId))
    if (!raw) return []
    return JSON.parse(raw) as ItemReminder[]
  } catch (err) {
    console.warn('Failed to load reminders from localStorage:', err)
    return []
  }
}

export function saveUserReminders(userId: string, reminders: ItemReminder[]): void {
  if (!userId) return
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getRemindersKey(userId), JSON.stringify(reminders))
    }
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tracknow:reminders-updated', { detail: { userId, count: reminders.length } }),
      )
    }
  } catch (err) {
    console.error('Failed to save reminders to localStorage:', err)
  }
}

/**
 * Resolves the target scheduled or due Date for an item.
 * Supports due dates, habit schedules with reminder_time or time_of_day, and recurring day filters.
 */
export function getItemTargetTime(
  item?: Partial<ExecutionItem> | null,
  now = new Date(),
): Date | null {
  if (!item) return null

  // 1. Task/Milestone/Item with due_date
  if (item.due_date) {
    const parts = item.due_date.split('-')
    if (parts.length === 3) {
      let hours = 9
      let minutes = 0
      if (item.schedule?.reminder_time) {
        const timeParts = item.schedule.reminder_time.split(':')
        if (timeParts.length >= 2) {
          hours = parseInt(timeParts[0], 10)
          minutes = parseInt(timeParts[1], 10)
        }
      } else if (item.schedule?.time_of_day) {
        switch (item.schedule.time_of_day) {
          case 'morning':
            hours = 8
            minutes = 30
            break
          case 'afternoon':
            hours = 13
            minutes = 30
            break
          case 'evening':
            hours = 19
            minutes = 0
            break
          default:
            hours = 9
            minutes = 0
            break
        }
      }
      return new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
        hours,
        minutes,
        0,
        0,
      )
    }
  }

  // 2. Habit or recurring schedule without explicit due_date
  if (item.schedule || item.type === 'habit') {
    let hours = 9
    let minutes = 0
    if (item.schedule?.reminder_time) {
      const parts = item.schedule.reminder_time.split(':')
      if (parts.length >= 2) {
        hours = parseInt(parts[0], 10)
        minutes = parseInt(parts[1], 10)
      }
    } else if (item.schedule?.time_of_day) {
      switch (item.schedule.time_of_day) {
        case 'morning':
          hours = 8
          minutes = 30
          break
        case 'afternoon':
          hours = 13
          minutes = 30
          break
        case 'evening':
          hours = 19
          minutes = 0
          break
        default:
          hours = 9
          minutes = 0
          break
      }
    }

    const schedule = item.schedule
    const isDayActive = (date: Date) => {
      if (!schedule || schedule.frequency === 'daily' || !schedule.days_of_week) return true
      return schedule.days_of_week.includes(date.getDay())
    }

    // Check today
    const candidateToday = new Date(now)
    candidateToday.setHours(hours, minutes, 0, 0)
    if (candidateToday.getTime() > now.getTime() && isDayActive(candidateToday)) {
      return candidateToday
    }

    // Look for next active day (up to 7 days)
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(now)
      nextDate.setDate(nextDate.getDate() + i)
      nextDate.setHours(hours, minutes, 0, 0)
      if (isDayActive(nextDate)) {
        return nextDate
      }
    }

    return candidateToday
  }

  return null
}

/**
 * Calculates the exact target ISO timestamp for a given preset and item context.
 */
export function calculateReminderTime(
  preset: ReminderPreset,
  item?: Partial<ExecutionItem> | null,
  customIso?: string,
  now = new Date(),
): string | null {
  if (preset === 'none') return null

  if (preset === 'exact_time') {
    if (!customIso) return null
    const parsed = new Date(customIso)
    return isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  // In X minutes/hours from NOW
  if (preset === '10m_in') {
    return new Date(now.getTime() + 10 * 60 * 1000).toISOString()
  }
  if (preset === '30m_in') {
    return new Date(now.getTime() + 30 * 60 * 1000).toISOString()
  }
  if (preset === '1h_in') {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  }
  if (preset === '2h_in') {
    return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
  }

  // Relative to target DUE / SCHEDULED TIME
  const target = getItemTargetTime(item, now)

  if (preset === '10m_before') {
    if (target) {
      return new Date(target.getTime() - 10 * 60 * 1000).toISOString()
    }
    return new Date(now.getTime() + 10 * 60 * 1000).toISOString()
  }

  if (preset === '30m_before') {
    if (target) {
      return new Date(target.getTime() - 30 * 60 * 1000).toISOString()
    }
    return new Date(now.getTime() + 30 * 60 * 1000).toISOString()
  }

  if (preset === '1h_before') {
    if (target) {
      return new Date(target.getTime() - 60 * 60 * 1000).toISOString()
    }
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  }

  if (preset === '2h_before') {
    if (target) {
      return new Date(target.getTime() - 2 * 60 * 60 * 1000).toISOString()
    }
    return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
  }

  // Legacy preset compatibility
  if (preset === '10m') {
    return new Date(now.getTime() + 10 * 60 * 1000).toISOString()
  }
  if (preset === '30m') {
    return new Date(now.getTime() + 30 * 60 * 1000).toISOString()
  }
  if (preset === '1h') {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  }
  if (preset === '2h') {
    return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
  }

  if (preset === 'scheduled_time') {
    if (target) {
      // If target time is today and has already passed, advance to tomorrow/next occurrence
      if (target.getTime() <= now.getTime()) {
        const next = new Date(target)
        next.setDate(next.getDate() + 1)
        return next.toISOString()
      }
      return target.toISOString()
    }

    // Schedule for today at 09:00 fallback
    const fallback = new Date(now)
    fallback.setHours(9, 0, 0, 0)
    if (fallback.getTime() <= now.getTime()) {
      fallback.setDate(fallback.getDate() + 1)
    }
    return fallback.toISOString()
  }

  return null
}

/**
 * Retrieves the active or upcoming reminder for a specific item.
 */
export function getReminderForItem(userId: string, itemId: string): ItemReminder | null {
  const all = loadUserReminders(userId)
  return all.find((r) => r.itemId === itemId && (r.status === 'upcoming' || r.status === 'snoozed')) || null
}

/**
 * Creates or updates a reminder for an execution item.
 */
export function setReminderForItem(
  userId: string,
  item: ExecutionItem,
  preset: ReminderPreset,
  customTimeIso?: string,
  now = new Date(),
): ItemReminder | null {
  if (!userId || !item?.id) return null

  const all = loadUserReminders(userId).filter((r) => r.itemId !== item.id)

  if (preset === 'none') {
    saveUserReminders(userId, all)
    return null
  }

  const remindAt = calculateReminderTime(preset, item, customTimeIso, now)
  if (!remindAt) {
    saveUserReminders(userId, all)
    return null
  }

  const reminder: ItemReminder = {
    id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    itemId: item.id,
    userId,
    itemName: item.name,
    planId: item.plan_id,
    trackId: item.track_id,
    preset,
    remindAt,
    status: 'upcoming',
    snoozedUntil: null,
    deliveredAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  all.push(reminder)
  saveUserReminders(userId, all)
  return reminder
}

/**
 * Cancels a reminder for a specific item.
 */
export function cancelReminderForItem(userId: string, itemId: string): void {
  const all = loadUserReminders(userId)
  const updated = all.map((r) =>
    r.itemId === itemId && (r.status === 'upcoming' || r.status === 'snoozed')
      ? { ...r, status: 'cancelled' as const, updatedAt: new Date().toISOString() }
      : r,
  )
  saveUserReminders(userId, updated)
}

/**
 * Snoozes a reminder for a specified number of minutes (defaults to 10 min).
 */
export function snoozeReminder(userId: string, reminderId: string, minutes = 10, now = new Date()): ItemReminder | null {
  const all = loadUserReminders(userId)
  const target = all.find((r) => r.id === reminderId)
  if (!target) return null

  const snoozedUntil = new Date(now.getTime() + minutes * 60 * 1000).toISOString()
  target.status = 'snoozed'
  target.snoozedUntil = snoozedUntil
  target.remindAt = snoozedUntil
  target.updatedAt = new Date().toISOString()

  saveUserReminders(userId, all)
  return target
}

/**
 * Marks a reminder as delivered.
 */
export function markReminderDelivered(userId: string, reminderId: string, now = new Date()): void {
  const all = loadUserReminders(userId)
  const target = all.find((r) => r.id === reminderId)
  if (!target) return

  target.status = 'delivered'
  target.deliveredAt = now.toISOString()
  target.updatedAt = now.toISOString()
  saveUserReminders(userId, all)
}

/**
 * Scans for reminders that have matured and need delivery.
 * Includes catch-up handling with a flood cap.
 */
export function checkDueReminders(userId: string, now = new Date()): ItemReminder[] {
  if (!userId) return []
  const all = loadUserReminders(userId)
  const nowIso = now.toISOString()

  const due = all.filter(
    (r) => (r.status === 'upcoming' || r.status === 'snoozed') && r.remindAt <= nowIso,
  )

  if (due.length === 0) return []

  // Flood cap: Deliver at most 3 in one sweep to avoid browser notification spam upon resume
  const toDeliver = due.slice(0, 3)
  const overflow = due.slice(3)

  // Mark delivered
  toDeliver.forEach((r) => {
    r.status = 'delivered'
    r.deliveredAt = nowIso
    r.updatedAt = nowIso
  })

  // Mark older overflow as delivered/catch-up
  overflow.forEach((r) => {
    r.status = 'delivered'
    r.deliveredAt = nowIso
    r.updatedAt = nowIso
  })

  saveUserReminders(userId, all)
  return toDeliver
}

/**
 * Clears all reminders for a user (used on sign out or account switch).
 */
export function clearRemindersForUser(userId: string): void {
  if (!userId || typeof localStorage === 'undefined') return
  localStorage.removeItem(getRemindersKey(userId))
}

/**
 * Cancels all active reminders belonging to a specific plan (e.g. when plan is archived).
 */
export function cancelRemindersForPlan(userId: string, planId: string): void {
  if (!userId || !planId) return
  const all = loadUserReminders(userId)
  const updated = all.map((r) =>
    r.planId === planId && (r.status === 'upcoming' || r.status === 'snoozed')
      ? { ...r, status: 'cancelled' as const, updatedAt: new Date().toISOString() }
      : r,
  )
  saveUserReminders(userId, updated)
}

/**
 * Recalculates reminder time for an item if its reminder preset is schedule/due-relative.
 * Preserves the reminder if item is rescheduled.
 */
export function rescheduleReminderForItem(
  userId: string,
  item: ExecutionItem,
  now = new Date(),
): ItemReminder | null {
  if (!userId || !item?.id) return null
  const existing = getReminderForItem(userId, item.id)
  if (!existing) return null

  const isScheduleRelative =
    existing.preset === 'scheduled_time' ||
    existing.preset === '10m_before' ||
    existing.preset === '30m_before' ||
    existing.preset === '1h_before' ||
    existing.preset === '2h_before'

  if (isScheduleRelative) {
    return setReminderForItem(userId, item, existing.preset, undefined, now)
  }

  return existing
}

/**
 * Advances a recurring habit reminder to its next scheduled occurrence day.
 */
export function advanceHabitReminderToNextOccurrence(
  userId: string,
  item: ExecutionItem,
  now = new Date(),
): ItemReminder | null {
  if (!userId || !item?.id || item.type !== 'habit') return null
  const all = loadUserReminders(userId)
  const existing = all.find((r) => r.itemId === item.id)
  if (!existing) return null

  // Calculate starting from tomorrow
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  const nextRemindAt = calculateReminderTime(existing.preset, item, undefined, tomorrow)
  if (!nextRemindAt) return null

  const updated = all.filter((r) => r.itemId !== item.id)
  const nextReminder: ItemReminder = {
    ...existing,
    id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    remindAt: nextRemindAt,
    status: 'upcoming',
    snoozedUntil: null,
    deliveredAt: null,
    updatedAt: new Date().toISOString(),
  }
  updated.push(nextReminder)
  saveUserReminders(userId, updated)
  return nextReminder
}

/**
 * Formats a reminder's target time into a user-friendly label.
 */
export function formatReminderLabel(reminder: ItemReminder, now = new Date()): string {
  const targetDate =
    reminder.status === 'snoozed' && reminder.snoozedUntil
      ? new Date(reminder.snoozedUntil)
      : new Date(reminder.remindAt)

  const isToday =
    targetDate.getFullYear() === now.getFullYear() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getDate() === now.getDate()

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow =
    targetDate.getFullYear() === tomorrow.getFullYear() &&
    targetDate.getMonth() === tomorrow.getMonth() &&
    targetDate.getDate() === tomorrow.getDate()

  const timeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (reminder.status === 'snoozed') {
    return `Snoozed (${timeStr})`
  }

  if (isToday) {
    return `Today ${timeStr}`
  }

  if (isTomorrow) {
    return `Tomorrow ${timeStr}`
  }

  const monthStr = targetDate.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return `${monthStr}, ${timeStr}`
}


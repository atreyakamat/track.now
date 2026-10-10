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
    // Attempt schedule reminder_time first, or fall back to time_of_day defaults
    const reminderTimeStr = item?.schedule?.reminder_time
    let targetHours = 9
    let targetMinutes = 0

    if (reminderTimeStr) {
      const parts = reminderTimeStr.split(':')
      if (parts.length >= 2) {
        targetHours = parseInt(parts[0], 10)
        targetMinutes = parseInt(parts[1], 10)
      }
    } else if (item?.schedule?.time_of_day) {
      switch (item.schedule.time_of_day) {
        case 'morning':
          targetHours = 8
          targetMinutes = 30
          break
        case 'afternoon':
          targetHours = 13
          targetMinutes = 30
          break
        case 'evening':
          targetHours = 19
          targetMinutes = 0
          break
        default:
          targetHours = 9
          targetMinutes = 0
          break
      }
    } else if (item?.due_date) {
      // If task has a due date, set reminder for 09:00 AM on due date
      const dueDateParts = item.due_date.split('-')
      if (dueDateParts.length === 3) {
        const d = new Date(
          parseInt(dueDateParts[0], 10),
          parseInt(dueDateParts[1], 10) - 1,
          parseInt(dueDateParts[2], 10),
          9,
          0,
          0,
        )
        if (d.getTime() > now.getTime()) {
          return d.toISOString()
        }
      }
    }

    // Schedule for today at targetHours:targetMinutes
    const target = new Date(now)
    target.setHours(targetHours, targetMinutes, 0, 0)

    // If target has already passed today, advance to tomorrow
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1)
    }

    return target.toISOString()
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

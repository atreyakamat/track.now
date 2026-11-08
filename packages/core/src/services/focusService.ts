import { getStorage } from '../platform/storage'
import { getTodayDateString } from '../domain/dates'
import { MAX_FOCUS } from '../domain/today'

/**
 * Today's focus: up to 3 items the user picks as the day's priorities. Device-local and per day
 * (a new day starts with an empty focus), keyed by user so accounts never share it.
 */
const key = (userId: string) => `tracknow_focus_${userId}`

interface StoredFocus {
  date: string
  ids: string[]
}

export function loadFocusIds(userId: string, now = new Date()): string[] {
  try {
    const raw = getStorage()?.getItem(key(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<StoredFocus>
    if (parsed.date !== getTodayDateString(now) || !Array.isArray(parsed.ids)) return []
    return parsed.ids.filter((id): id is string => typeof id === 'string').slice(0, MAX_FOCUS)
  } catch {
    return []
  }
}

/**
 * Adds or removes an item from today's focus. Returns the new list, or null when the focus is
 * already full (the caller tells the user instead of silently replacing a choice).
 */
export function toggleFocusId(userId: string, itemId: string, now = new Date()): string[] | null {
  const current = loadFocusIds(userId, now)
  let next: string[]
  if (current.includes(itemId)) next = current.filter((id) => id !== itemId)
  else if (current.length >= MAX_FOCUS) return null
  else next = [...current, itemId]
  try {
    getStorage()?.setItem(key(userId), JSON.stringify({ date: getTodayDateString(now), ids: next }))
  } catch {
    /* storage unavailable: focus only lasts for this page view */
  }
  return next
}

export function clearFocusForUser(userId: string): void {
  try {
    getStorage()?.removeItem(key(userId))
  } catch {
    /* ignore */
  }
}

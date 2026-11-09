import { getStorage } from '../platform/storage'
import { getTodayDateString } from '../domain/dates'
import { MAX_FOCUS } from '../domain/today'

/**
 * Today's focus: up to 3 items the user picks as the day's priorities. Per day (a new day starts
 * with an empty focus) and keyed by user so accounts never share it. This is the device's copy;
 * services/syncedState.ts copies it to and from the account so the phone and the web agree.
 */
const key = (userId: string) => `tracknow_focus_${userId}`

interface StoredFocus {
  date: string
  ids: string[]
  /** ISO time of the last change (absent in copies written before focus was synced). */
  updatedAt?: string
}

export interface FocusState {
  date: string
  ids: string[]
  updatedAt: string | null
}

const cleanIds = (ids: unknown): string[] =>
  Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64).slice(0, MAX_FOCUS) : []

/** Validates a focus value read from storage or from the account; null when malformed. */
export function sanitizeFocusState(value: unknown): FocusState | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const v = value as Partial<StoredFocus>
  if (typeof v.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.date) || !Array.isArray(v.ids)) return null
  const updatedAt = typeof v.updatedAt === 'string' && !Number.isNaN(new Date(v.updatedAt).getTime()) ? v.updatedAt : null
  return { date: v.date, ids: cleanIds(v.ids), updatedAt }
}

/** The stored focus when it is for today, otherwise null. */
export function loadFocusState(userId: string, now = new Date()): FocusState | null {
  try {
    const raw = getStorage()?.getItem(key(userId))
    if (!raw) return null
    const state = sanitizeFocusState(JSON.parse(raw))
    return state && state.date === getTodayDateString(now) ? state : null
  } catch {
    return null
  }
}

/** Replaces the device's copy (used by the toggle below and by sync). */
export function saveFocusState(userId: string, state: FocusState): void {
  try {
    getStorage()?.setItem(key(userId), JSON.stringify({ date: state.date, ids: cleanIds(state.ids), ...(state.updatedAt ? { updatedAt: state.updatedAt } : {}) }))
  } catch {
    /* storage unavailable: focus only lasts for this page view */
  }
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
  saveFocusState(userId, { date: getTodayDateString(now), ids: next, updatedAt: now.toISOString() })
  return next
}

export function clearFocusForUser(userId: string): void {
  try {
    getStorage()?.removeItem(key(userId))
  } catch {
    /* ignore */
  }
}

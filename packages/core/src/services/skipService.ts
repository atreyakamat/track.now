import { getStorage } from '../platform/storage'
import { getTodayDateString } from '../domain/dates'

/**
 * Skips: "not today, and it is not a miss". A skipped (item, day) is left out of that day's
 * queue, progress, streaks and retention — like a planned rest day — and the reason is kept so
 * reviews can show it. Device-local, per user; the completion ledger is never touched.
 */
export type SkipReason = 'sick' | 'travelling' | 'rest' | 'busy' | 'other'

export const SKIP_REASONS: { value: SkipReason; label: string }[] = [
  { value: 'sick', label: 'Not well' },
  { value: 'travelling', label: 'Travelling' },
  { value: 'rest', label: 'Planned rest' },
  { value: 'busy', label: 'No time today' },
  { value: 'other', label: 'Other' },
]

export interface Skip {
  item_id: string
  date: string
  reason: SkipReason
  note?: string
}

const key = (userId: string) => `tracknow_skips_${userId}`
const MAX_SKIPS = 2000

export function loadSkips(userId: string): Skip[] {
  try {
    const raw = getStorage()?.getItem(key(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.item_id === 'string' && typeof s.date === 'string') : []
  } catch {
    return []
  }
}

function save(userId: string, skips: Skip[]): void {
  try {
    getStorage()?.setItem(key(userId), JSON.stringify(skips.slice(-MAX_SKIPS)))
  } catch {
    /* storage unavailable */
  }
}

export function addSkip(userId: string, itemId: string, reason: SkipReason, note?: string, date = getTodayDateString()): Skip[] {
  const next = loadSkips(userId).filter((s) => !(s.item_id === itemId && s.date === date))
  next.push({ item_id: itemId, date, reason, ...(note ? { note } : {}) })
  save(userId, next)
  return next
}

export function removeSkip(userId: string, itemId: string, date = getTodayDateString()): Skip[] {
  const next = loadSkips(userId).filter((s) => !(s.item_id === itemId && s.date === date))
  save(userId, next)
  return next
}

export function clearSkipsForUser(userId: string): void {
  try {
    getStorage()?.removeItem(key(userId))
  } catch {
    /* ignore */
  }
}

/** Skipped dates per item, for streak/retention calculations. */
export function skippedDatesByItem(skips: readonly Skip[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const s of skips) (out[s.item_id] ??= []).push(s.date)
  return out
}

export function isSkippedOn(skips: readonly Skip[], itemId: string, date: string): Skip | undefined {
  return skips.find((s) => s.item_id === itemId && s.date === date)
}

import type { ExecutionItem } from '@/types/domain'
import { getTodayDateString } from './dates'

type CounterFields = Pick<ExecutionItem, 'type' | 'updated_at'> &
  Partial<Pick<ExecutionItem, 'current_count' | 'count_date'>>

/**
 * True when the database exposes `count_date` (migration 20261013000000). Rows are
 * selected with `*`, so the key is present (possibly null) exactly when the column exists.
 */
export function supportsCountDate(item: object): boolean {
  return Object.prototype.hasOwnProperty.call(item, 'count_date')
}

/**
 * The local calendar day the stored `current_count` belongs to.
 * - With `count_date` (authoritative): that day.
 * - Legacy rows / un-migrated schema: the local day of `updated_at`. This is only a
 *   heuristic, because any edit bumps `updated_at`; it is why `count_date` exists.
 */
export function habitCountDay(item: CounterFields): string | null {
  if (item.count_date) return item.count_date
  if (!item.updated_at) return null
  const touched = new Date(item.updated_at)
  return Number.isNaN(touched.getTime()) ? null : getTodayDateString(touched)
}

/**
 * Habits restart their counter every day. The stored count is "stale" when it belongs to
 * an earlier day than `today` and the habit has not been completed today.
 */
export function isHabitCountStale(item: CounterFields, completedToday: boolean, now = new Date()): boolean {
  if (item.type !== 'habit' || completedToday) return false
  const day = habitCountDay(item)
  return day !== null && day < getTodayDateString(now)
}

/** The count that applies to today (0 for a habit whose stored count is from an earlier day). */
export function effectiveCurrentCount(item: CounterFields, completedToday: boolean, now = new Date()): number {
  if (isHabitCountStale(item, completedToday, now)) return 0
  return Math.max(0, item.current_count ?? 0)
}

/**
 * A habit counter never moves backwards in time: writing a count for `dateStr` when the
 * counter already belongs to a LATER day would overwrite newer progress (two devices
 * around midnight, or a request delayed past midnight). Mirrors the server-side guard.
 */
export function isStaleDayWrite(item: CounterFields, dateStr: string): boolean {
  return item.type === 'habit' && Boolean(item.count_date) && dateStr < (item.count_date as string)
}

export const STALE_DAY_MESSAGE = 'This habit was already updated for a later day. Refresh and try again.'

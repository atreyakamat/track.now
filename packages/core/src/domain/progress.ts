import type { ExecutionItemSummary, Plan, Progress, Track } from '../types/domain'
import { getTodayDateString, isHabitScheduledForToday } from './dates'
import { hasStarted, isFlexibleWeekly } from './schedule'

/**
 * Progress calculation layer.
 * A single source of truth for all progress:
 * progress = items counted as done / non-archived items.
 *
 * Never fake progress. If there are 0 items, percent is 0.
 *
 * Habits are recurring: their persisted `status` may still read 'done' from a previous
 * day. When the caller supplies `completedTodayIds` (from track_now_item_completions for
 * the current local day), a habit only counts as done if it was completed today. Without
 * that context the status is used as-is (legacy behaviour, kept for pure callers).
 *
 * A habit that is not scheduled today (e.g. a Mon/Wed/Fri habit on a Tuesday) and was
 * not completed today is not part of today's work, so it is left out of both the total
 * and the done count (only when its schedule is known and today's completions are given).
 */
export interface ProgressOptions {
  completedTodayIds?: ReadonlySet<string> | readonly string[]
  /** Reference time for "today" (defaults to now). */
  now?: Date
}

export type ProgressItem = Pick<ExecutionItemSummary, 'status'> &
  Partial<Pick<ExecutionItemSummary, 'id' | 'type' | 'schedule' | 'start_date'>>

const toIdSet = (ids: ReadonlySet<string> | readonly string[]): ReadonlySet<string> =>
  ids instanceof Set ? ids : new Set(ids as readonly string[])

/** Whether an item counts as done for progress purposes (archived never counts). */
export function isItemDone(item: ProgressItem, options?: ProgressOptions): boolean {
  if (item.status === 'archived') return false
  if (item.type === 'habit' && options?.completedTodayIds) {
    return item.id ? toIdSet(options.completedTodayIds).has(item.id) : false
  }
  return item.status === 'done'
}

/** True for a habit that is not due today and was not completed today (not today's work). */
function isHabitOffToday(item: ProgressItem, options?: ProgressOptions): boolean {
  if (item.type !== 'habit' || !options?.completedTodayIds || item.schedule === undefined) return false
  if (item.id && toIdSet(options.completedTodayIds).has(item.id)) return false
  const now = options.now ?? new Date()
  // Not started yet (e.g. a gym habit that begins next week) is not today's work.
  if (!hasStarted(item, getTodayDateString(now))) return true
  // A flexible weekly habit ("3× a week") is never required on one particular day.
  if (isFlexibleWeekly(item.schedule)) return true
  return !isHabitScheduledForToday(item.schedule, now)
}

export function calcProgress(items: ProgressItem[], options?: ProgressOptions): Progress {
  const counted = items.filter((item) => item.status !== 'archived' && !isHabitOffToday(item, options))
  const done = counted.filter((item) => isItemDone(item, options)).length
  const total = counted.length
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  }
}

export interface PlanSummary {
  plan: Plan
  progress: Progress
  itemCountsByType: Record<string, number>
  lastActivityAt: string
}

export interface TrackSummary {
  track: Track
  activePlans: PlanSummary[]
  archivedPlans: PlanSummary[]
  /** Draft, paused, completed and archived Plans (history is never hidden). */
  inactivePlans: PlanSummary[]
  progress: Progress
  lastActivityAt: string
}

const latestDate = (...dates: (string | undefined)[]): string =>
  dates.filter((d): d is string => Boolean(d)).sort().at(-1) ?? ''

export function summarizePlan(
  plan: Plan,
  items: ExecutionItemSummary[],
  options?: ProgressOptions,
): PlanSummary {
  const own = items.filter((item) => item.plan_id === plan.id)
  const itemCountsByType: Record<string, number> = {}
  own.forEach((item) => {
    if (item.status !== 'archived') {
      itemCountsByType[item.type] = (itemCountsByType[item.type] ?? 0) + 1
    }
  })
  return {
    plan,
    progress: calcProgress(own, options),
    itemCountsByType,
    lastActivityAt: latestDate(plan.updated_at, ...own.map((item) => item.updated_at)),
  }
}

/**
 * Track progress aggregates items across its active Plans only.
 * If a track has no plans or active items, progress is 0%.
 */
export function summarizeTrack(
  track: Track,
  plans: Plan[],
  items: ExecutionItemSummary[],
  options?: ProgressOptions,
): TrackSummary {
  const planSummaries = plans
    .filter((p) => p.track_id === track.id)
    .map((p) => summarizePlan(p, items, options))

  const activePlans = planSummaries.filter((s) => s.plan.status === 'active')
  const archivedPlans = planSummaries.filter((s) => s.plan.status === 'archived')
  // Every Plan that is not active stays visible under its Track (draft, paused, completed, archived).
  const inactivePlans = planSummaries.filter((s) => s.plan.status !== 'active')

  const activePlanIds = new Set(activePlans.map((s) => s.plan.id))
  const activeItems = items.filter((item) => activePlanIds.has(item.plan_id))

  return {
    track,
    activePlans,
    archivedPlans,
    inactivePlans,
    progress: calcProgress(activeItems, options),
    lastActivityAt: latestDate(track.updated_at, ...planSummaries.map((s) => s.lastActivityAt)),
  }
}

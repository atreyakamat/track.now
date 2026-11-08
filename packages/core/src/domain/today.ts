import type { ExecutionItem } from '../types/domain'
import { getTodayDateString, isDueToday, isHabitScheduledForToday, isOverdue, isUpcoming } from './dates'
import { hasStarted, weekStartOf, weeklyTargetStatus, type WeeklyTargetStatus } from './schedule'

const PRIORITY_RANK: Record<ExecutionItem['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 }

/** Sort by due date (earliest first, undated last), then priority, then name. */
function byDueThenPriority(a: ExecutionItem, b: ExecutionItem): number {
  // Habits recur on their schedule, so any stored due date is ignored for ordering.
  const da = a.type === 'habit' ? null : a.due_date
  const db = b.type === 'habit' ? null : b.due_date
  if (da !== db) {
    if (!da) return 1
    if (!db) return -1
    return da < db ? -1 : 1
  }
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  return p !== 0 ? p : a.name.localeCompare(b.name)
}

export interface TodayGroups {
  /** Skipped today on purpose (not a miss); shown muted, never counted. */
  skipped: ExecutionItem[]
  /** Up to MAX_FOCUS items the user chose as today's priorities (not yet completed). */
  focus: ExecutionItem[]
  overdue: ExecutionItem[]
  dueToday: ExecutionItem[]
  anytime: ExecutionItem[]
  upcoming: ExecutionItem[]
  completedToday: ExecutionItem[]
}

export const MAX_FOCUS = 3

export interface TodayGroupOptions {
  /** Items skipped for today (see services/skipService). */
  skippedIds?: Iterable<string>
  /** Items pinned as today's focus (device-local choice). */
  focusIds?: ReadonlySet<string> | readonly string[]
  /** Completion dates per item (needed for weekly-target habits; the current week is enough). */
  historyByItem?: Readonly<Record<string, readonly string[]>>
}

/**
 * Pure grouping for the Today view.
 * - Focus: the user's chosen priorities for today (max 3), taken out of the other sections.
 * - Fixed-day habits: "Due Today" when scheduled today, "Upcoming" otherwise; never overdue.
 * - Weekly-target habits ("3× a week"): "Anytime" while the week's target is open, "Due Today" when
 *   every remaining day of the week is needed, "Upcoming" once the target is met.
 * - Items whose start date is in the future are "Upcoming" (they are not today's work).
 * - One-off items: overdue / due today / anytime (no due date) / upcoming by due date.
 * - "Completed Today" only contains items completed on the current local day.
 */
export function groupTodayItems(
  items: ExecutionItem[],
  completedTodayIds: ReadonlySet<string>,
  now = new Date(),
  options: TodayGroupOptions = {},
): TodayGroups {
  const groups: TodayGroups = { skipped: [], focus: [], overdue: [], dueToday: [], anytime: [], upcoming: [], completedToday: [] }
  const skippedIds = new Set(options.skippedIds ?? [])
  const today = getTodayDateString(now)
  const focusIds = options.focusIds instanceof Set ? options.focusIds : new Set(options.focusIds ?? [])
  for (const item of items) {
    if (item.status === 'archived') continue
    if (completedTodayIds.has(item.id)) {
      groups.completedToday.push(item)
      continue
    }
    if (item.type !== 'habit' && item.status === 'done') continue // finished on an earlier day
    if (skippedIds.has(item.id)) {
      groups.skipped.push(item)
      continue
    }
    if (!hasStarted(item, today)) {
      groups.upcoming.push(item)
      continue
    }
    if (focusIds.has(item.id) && groups.focus.length < MAX_FOCUS) {
      groups.focus.push(item)
      continue
    }
    if (item.type === 'habit') {
      const weekly = weeklyStatusFor(item, options, today)
      if (weekly) {
        if (weekly.met) groups.upcoming.push(item)
        else if (weekly.remaining >= daysLeftInWeek(today)) groups.dueToday.push(item)
        else groups.anytime.push(item)
      } else if (isHabitScheduledForToday(item.schedule, now)) groups.dueToday.push(item)
      else groups.upcoming.push(item)
      continue
    }
    if (isOverdue(item.due_date, now)) groups.overdue.push(item)
    else if (isDueToday(item.due_date, now)) groups.dueToday.push(item)
    else if (isUpcoming(item.due_date, now)) groups.upcoming.push(item)
    else groups.anytime.push(item)
  }
  groups.overdue.sort(byDueThenPriority)
  groups.dueToday.sort(byDueThenPriority)
  groups.anytime.sort(byDueThenPriority)
  groups.upcoming.sort(byDueThenPriority)
  return groups
}

function weeklyStatusFor(item: ExecutionItem, options: TodayGroupOptions, today: string): WeeklyTargetStatus | null {
  return weeklyTargetStatus(item.schedule, options.historyByItem?.[item.id] ?? [], today)
}

/** Days left in the Mon–Sun week including today (Mon = 7 … Sun = 1). */
export function daysLeftInWeek(today: string): number {
  const start = weekStartOf(today)
  const [y1, m1, d1] = start.split('-').map(Number)
  const [y2, m2, d2] = today.split('-').map(Number)
  const elapsed = Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86_400_000)
  return 7 - elapsed
}

/** Weekly-target status for a habit on Today (null for fixed-day habits). */
export function todayWeeklyStatus(
  item: ExecutionItem,
  historyByItem: Readonly<Record<string, readonly string[]>> | undefined,
  now = new Date(),
): WeeklyTargetStatus | null {
  return weeklyTargetStatus(item.schedule, historyByItem?.[item.id] ?? [], getTodayDateString(now))
}

/** The day's progress shown at the top of Today: work that is due today (or chosen as focus). */
export function todaySummary(groups: TodayGroups): { done: number; total: number; percent: number } {
  const open = groups.focus.length + groups.overdue.length + groups.dueToday.length
  const done = groups.completedToday.length
  const total = open + done
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}

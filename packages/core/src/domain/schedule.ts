import type { ItemSchedule } from '../types/domain'
import { getTodayDateString } from './dates'

/**
 * Scheduling rules shared by Today, progress, streaks and analytics.
 *
 * - Fixed-day habits are due on their scheduled weekdays.
 * - Flexible weekly habits (`times_per_week`, e.g. "run 3× a week") are never due on one specific
 *   day: they are available every day until the Mon–Sun week's target is met, and a day without
 *   a session is never a miss on its own.
 * - Any item with a `start_date` in the future is not part of today's work yet.
 */

type ScheduleLike = Partial<Pick<ItemSchedule, 'frequency' | 'days_of_week' | 'times_per_week'>> | null | undefined

export function weeklyTarget(schedule: ScheduleLike): number | null {
  const n = schedule?.times_per_week
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 7 ? n : null
}

export function isFlexibleWeekly(schedule: ScheduleLike): boolean {
  return weeklyTarget(schedule) !== null
}

const parse = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

/** Monday (YYYY-MM-DD) of the Mon–Sun week containing `date`. */
export function weekStartOf(date: string): string {
  const d = parse(date)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return getTodayDateString(d)
}

export function addDaysTo(date: string, days: number): string {
  const d = parse(date)
  d.setDate(d.getDate() + days)
  return getTodayDateString(d)
}

/** Whether an item has begun on `date` (no start date = always). */
export function hasStarted(item: { start_date?: string | null }, date: string): boolean {
  return !item.start_date || item.start_date <= date
}

export interface WeeklyTargetStatus {
  target: number
  /** Sessions done this week up to and including `date`. */
  done: number
  met: boolean
  remaining: number
  weekStart: string
}

export function weeklyTargetStatus(
  schedule: ScheduleLike,
  completedDates: Iterable<string>,
  date: string,
): WeeklyTargetStatus | null {
  const target = weeklyTarget(schedule)
  if (target === null) return null
  const weekStart = weekStartOf(date)
  let done = 0
  for (const d of new Set(completedDates)) if (d >= weekStart && d <= date) done++
  return { target, done, met: done >= target, remaining: Math.max(0, target - done), weekStart }
}

/** Fixed-day check for one date (flexible habits are handled by the weekly rules). */
export function isFixedScheduleDay(schedule: ScheduleLike, date: string): boolean {
  if (!schedule) return true
  if (schedule.frequency === 'weekly' || schedule.frequency === 'custom') {
    if (!schedule.days_of_week || schedule.days_of_week.length === 0) return true
    return schedule.days_of_week.includes(parse(date).getDay())
  }
  return true
}

/**
 * Whether a habit is part of the work for `date`:
 * fixed-day habits on their days; flexible weekly habits while the week's target is still open
 * (or when already completed that day). Never before the habit's start date.
 */
export function isHabitDueOn(
  item: { start_date?: string | null; schedule?: ScheduleLike },
  date: string,
  completedDates: Iterable<string> = [],
): boolean {
  if (!hasStarted(item, date)) return false
  const status = weeklyTargetStatus(item.schedule, completedDates, date)
  if (status) {
    const dates = new Set(completedDates)
    return dates.has(date) || !status.met
  }
  return isFixedScheduleDay(item.schedule, date)
}

/** First day a habit is measured from: its start date, else the local day it was created. */
export function habitTrackedSince(item: { start_date?: string | null; created_at?: string | null }): string | null {
  if (item.start_date) return item.start_date
  if (!item.created_at) return null
  const d = new Date(item.created_at)
  return Number.isNaN(d.getTime()) ? null : getTodayDateString(d)
}

/**
 * Whether a habit is *required* today (counts toward "remaining" totals): started, and due on a
 * fixed scheduled day. Weekly-target habits are optional on any single day.
 */
export function isHabitRequiredToday(
  item: { start_date?: string | null; schedule?: ScheduleLike },
  now = new Date(),
): boolean {
  const today = getTodayDateString(now)
  if (!hasStarted(item, today) || isFlexibleWeekly(item.schedule)) return false
  return isFixedScheduleDay(item.schedule, today)
}

import type { ExecutionItem, Plan } from '../types/domain'
import { getTodayDateString } from './dates'
import { addDaysTo, habitTrackedSince, isFixedScheduleDay, weekStartOf, weeklyTarget } from './schedule'

/**
 * Retention: is the user actually sticking with what they planned?
 *
 * Everything is derived from real completion rows (one per item per local day):
 * - Weekly consistency: per Mon–Sun week, planned work vs work done. Planned work is every
 *   scheduled habit day, a share of each weekly-target habit's target, and every dated task /
 *   milestone due that week. The current week only counts days up to today.
 * - Habit retention: each habit is "kept", "slipping", "dropped", "new" or "not started" based on
 *   the last 14 days compared with the 14 before.
 *
 * Paused, draft and archived Plans are left out (their idle weeks are not misses). A completed
 * Plan counts up to the day it was completed; an Arc counts up to its end date.
 */

export interface RetentionCompletion {
  item_id: string
  completed_date: string
}

export interface WeekConsistency {
  weekStart: string
  planned: number
  done: number
  /** null when nothing was planned that week. */
  percent: number | null
  /** The current, unfinished week. */
  partial: boolean
}

export type HabitRetentionStatus = 'kept' | 'slipping' | 'dropped' | 'new' | 'not_started'

export interface HabitRetention {
  item: ExecutionItem
  status: HabitRetentionStatus
  trackedSince: string | null
  /** Last 14 days (ending today). null when nothing was planned. */
  recentPercent: number | null
  /** The 14 days before that. */
  previousPercent: number | null
  /** Consecutive weeks (newest first) at ≥ 70%, current week included only when already on track. */
  weeksOnTrack: number
  /** Longest such run in the loaded history. */
  bestWeeksOnTrack: number
  lastDone: string | null
}

export interface PlanRetention {
  plan: Plan
  weeks: WeekConsistency[]
  percent: number | null
}

export type RetentionTrend = 'improving' | 'steady' | 'slipping'

export interface RetentionResult {
  weeks: WeekConsistency[]
  /** Planned vs done across all loaded weeks. */
  percent: number | null
  trend: RetentionTrend | null
  byPlan: PlanRetention[]
  habits: HabitRetention[]
  /** Habits tracked for at least 14 days, and how many of them are kept. */
  established: number
  kept: number
}

export const ON_TRACK_PERCENT = 70
const WINDOW_DAYS = 14
const MEASURED_PLAN_STATUSES = new Set(['active', 'completed'])

const pct = (done: number, planned: number): number | null => (planned > 0 ? Math.round((Math.min(done, planned) / planned) * 100) : null)

const dayCount = (from: string, to: string): number => {
  if (from > to) return 0
  let n = 0
  for (let d = from; d <= to && n < 4000; d = addDaysTo(d, 1)) n++
  return n
}

/** Last day a Plan's items are measured on. */
function planMeasuredUntil(plan: Plan | undefined, today: string): string {
  let until = today
  if (plan?.status === 'completed' && plan.completed_at) {
    const d = new Date(plan.completed_at)
    if (!Number.isNaN(d.getTime())) until = getTodayDateString(d) < until ? getTodayDateString(d) : until
  }
  if (plan?.end_date && plan.end_date < until) until = plan.end_date
  return until
}

interface Tally {
  planned: number
  done: number
}

/** Planned vs done for one habit inside [from, to] (already clipped to its tracked range). */
function habitTally(item: ExecutionItem, dates: Set<string>, from: string, to: string): Tally {
  if (from > to) return { planned: 0, done: 0 }
  const target = weeklyTarget(item.schedule)
  if (target === null) {
    let planned = 0
    let done = 0
    for (let d = from; d <= to; d = addDaysTo(d, 1)) {
      if (!isFixedScheduleDay(item.schedule, d)) continue
      planned++
      if (dates.has(d)) done++
    }
    return { planned, done }
  }
  // Weekly target: per Mon–Sun week, a share of the target proportional to the days available.
  let planned = 0
  let done = 0
  for (let ws = weekStartOf(from); ws <= to; ws = addDaysTo(ws, 7)) {
    const a = ws < from ? from : ws
    const we = addDaysTo(ws, 6)
    const b = we > to ? to : we
    const avail = dayCount(a, b)
    if (!avail) continue
    let sessions = 0
    for (let d = a; d <= b; d = addDaysTo(d, 1)) if (dates.has(d)) sessions++
    const share = Math.min(target, Math.ceil((target * avail) / 7))
    const got = Math.min(target, sessions)
    planned += Math.max(share, got)
    done += got
  }
  return { planned, done }
}

export interface RetentionInput {
  items: ExecutionItem[]
  plans: Plan[]
  completions: RetentionCompletion[]
  now: Date
  /** Number of Mon–Sun weeks to report, current week included (default 12). */
  weeks?: number
  /** Restrict to these Plans (e.g. one Arc). */
  planIds?: Set<string>
  /** Never count before this date (e.g. an Arc's start). */
  since?: string | null
}

export function buildRetention(input: RetentionInput): RetentionResult {
  const today = getTodayDateString(input.now)
  const weekCount = Math.max(1, Math.min(52, input.weeks ?? 12))
  const firstWeek = addDaysTo(weekStartOf(today), -7 * (weekCount - 1))
  const floor = input.since && input.since > firstWeek ? input.since : firstWeek

  const planById = new Map(input.plans.map((p) => [p.id, p]))
  const measuredPlans = input.plans.filter(
    (p) => MEASURED_PLAN_STATUSES.has(p.status) && (!input.planIds || input.planIds.has(p.id)),
  )
  const measuredPlanIds = new Set(measuredPlans.map((p) => p.id))
  const items = input.items.filter((i) => measuredPlanIds.has(i.plan_id) && i.status !== 'archived')

  const datesByItem = new Map<string, Set<string>>()
  for (const c of input.completions) {
    let set = datesByItem.get(c.item_id)
    if (!set) datesByItem.set(c.item_id, (set = new Set()))
    set.add(c.completed_date)
  }

  const weekStarts = Array.from({ length: weekCount }, (_, i) => addDaysTo(firstWeek, 7 * i))
  const emptyWeeks = () => weekStarts.map(() => ({ planned: 0, done: 0 }))
  const overall = emptyWeeks()
  const perPlan = new Map<string, Tally[]>(measuredPlans.map((p) => [p.id, emptyWeeks()]))

  for (const item of items) {
    const plan = planById.get(item.plan_id)
    const until = planMeasuredUntil(plan, today)
    const dates = datesByItem.get(item.id) ?? new Set<string>()
    const tallies = perPlan.get(item.plan_id)!
    if (item.type === 'habit') {
      const tracked = habitTrackedSince(item)
      const start = [floor, tracked, plan?.start_date].filter((d): d is string => Boolean(d)).sort().at(-1)!
      weekStarts.forEach((ws, i) => {
        const we = addDaysTo(ws, 6)
        const t = habitTally(item, dates, ws < start ? start : ws, we > until ? until : we)
        overall[i].planned += t.planned
        overall[i].done += t.done
        tallies[i].planned += t.planned
        tallies[i].done += t.done
      })
    } else if (item.due_date && item.due_date >= floor && item.due_date <= until) {
      const i = weekStarts.indexOf(weekStartOf(item.due_date))
      if (i < 0) continue
      const isDone = item.status === 'done' || dates.size > 0
      overall[i].planned += 1
      tallies[i].planned += 1
      if (isDone) {
        overall[i].done += 1
        tallies[i].done += 1
      }
    }
  }

  const currentWeek = weekStartOf(today)
  const toWeeks = (t: Tally[]): WeekConsistency[] =>
    t.map((x, i) => ({ weekStart: weekStarts[i], planned: x.planned, done: x.done, percent: pct(x.done, x.planned), partial: weekStarts[i] === currentWeek }))
  const sumPercent = (t: Tally[]) => pct(t.reduce((a, x) => a + Math.min(x.done, x.planned), 0), t.reduce((a, x) => a + x.planned, 0))

  const weeks = toWeeks(overall)
  const byPlan = measuredPlans
    .map((plan) => ({ plan, weeks: toWeeks(perPlan.get(plan.id)!), percent: sumPercent(perPlan.get(plan.id)!) }))
    .filter((p) => p.percent !== null)
    .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))

  // Trend: the last two finished weeks against the two before them.
  const finished = weeks.filter((w) => !w.partial && w.planned > 0)
  let trend: RetentionTrend | null = null
  if (finished.length >= 4) {
    const avg = (ws: WeekConsistency[]) => ws.reduce((a, w) => a + (w.percent ?? 0), 0) / ws.length
    const diff = avg(finished.slice(-2)) - avg(finished.slice(-4, -2))
    trend = diff >= 10 ? 'improving' : diff <= -10 ? 'slipping' : 'steady'
  }

  const habits = items
    .filter((i) => i.type === 'habit')
    .map((item) => habitRetention(item, datesByItem.get(item.id) ?? new Set(), planMeasuredUntil(planById.get(item.plan_id), today), today, weekStarts))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.recentPercent ?? 101) - (b.recentPercent ?? 101))

  const establishedHabits = habits.filter((h) => h.status === 'kept' || h.status === 'slipping' || h.status === 'dropped')
  return {
    weeks,
    percent: sumPercent(overall),
    trend,
    byPlan,
    habits,
    established: establishedHabits.length,
    kept: establishedHabits.filter((h) => h.status === 'kept').length,
  }
}

const STATUS_ORDER: Record<HabitRetentionStatus, number> = { dropped: 0, slipping: 1, kept: 2, new: 3, not_started: 4 }

function habitRetention(
  item: ExecutionItem,
  dates: Set<string>,
  until: string,
  today: string,
  weekStarts: string[],
): HabitRetention {
  const tracked = habitTrackedSince(item)
  const lastDone = [...dates].filter((d) => d <= today).sort().at(-1) ?? null
  const base = { item, trackedSince: tracked, lastDone }
  if (item.start_date && item.start_date > today) {
    return { ...base, status: 'not_started', recentPercent: null, previousPercent: null, weeksOnTrack: 0, bestWeeksOnTrack: 0 }
  }
  const start = tracked ?? '0000-01-01'
  const clip = (from: string, to: string) => habitTally(item, dates, from < start ? start : from, to > until ? until : to)
  const recent = clip(addDaysTo(today, -(WINDOW_DAYS - 1)), today)
  const previous = clip(addDaysTo(today, -(2 * WINDOW_DAYS - 1)), addDaysTo(today, -WINDOW_DAYS))
  const recentPercent = pct(recent.done, recent.planned)
  const previousPercent = pct(previous.done, previous.planned)

  // Weekly on-track runs.
  const current = weekStartOf(today)
  const weekly = weekStarts.map((ws) => {
    const t = clip(ws, addDaysTo(ws, 6))
    return { ws, p: pct(t.done, t.planned) }
  })
  let best = 0
  let run = 0
  for (const w of weekly) {
    if (w.p === null) continue
    run = w.p >= ON_TRACK_PERCENT ? run + 1 : 0
    best = Math.max(best, run)
  }
  let streak = 0
  for (let i = weekly.length - 1; i >= 0; i--) {
    const w = weekly[i]
    if (w.p === null) {
      if (w.ws === current) continue
      break
    }
    if (w.p >= ON_TRACK_PERCENT) streak++
    else if (w.ws === current) continue // the current week can still recover
    else break
  }

  const trackedDays = tracked ? dayCount(tracked, today) : WINDOW_DAYS
  let status: HabitRetentionStatus
  if (trackedDays < WINDOW_DAYS) status = 'new'
  else if (recent.planned >= 2 && recent.done === 0) status = 'dropped'
  else if (recentPercent === null || recentPercent >= ON_TRACK_PERCENT) status = 'kept'
  else status = 'slipping'

  return { ...base, status, recentPercent, previousPercent, weeksOnTrack: streak, bestWeeksOnTrack: best }
}

export const RETENTION_STATUS_LABEL: Record<HabitRetentionStatus, string> = {
  kept: 'Kept',
  slipping: 'Slipping',
  dropped: 'Dropped',
  new: 'New',
  not_started: 'Not started',
}

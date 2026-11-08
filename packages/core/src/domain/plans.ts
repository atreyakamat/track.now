import type { ExecutionItem, Plan, PlanKind, PlanStatus } from '../types/domain'
import { getTodayDateString } from './dates'
import { addDaysTo } from './schedule'
import { calcHabitStreak } from './streaks'
import { habitTrackedSince } from './schedule'

/**
 * Plan / Arc lifecycle. "Arc" is the user-facing name for a time-bound Plan; it is the same
 * entity (track_now_plans), never a separate concept.
 */

export function planKindOf(plan: Pick<Plan, 'end_date'> & { plan_kind?: PlanKind | null }): PlanKind {
  if (plan.plan_kind) return plan.plan_kind
  return plan.end_date ? 'time_bound' : 'ongoing'
}

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  time_bound: 'Arc',
  ongoing: 'Ongoing',
  recurring: 'Recurring',
}

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
  cancelled: 'Cancelled',
}

/** Status changes the UI offers from each state (restore is always possible). */
export function nextPlanStatuses(status: PlanStatus): PlanStatus[] {
  switch (status) {
    case 'draft':
      return ['active', 'archived']
    case 'active':
      return ['paused', 'completed', 'archived']
    case 'paused':
      return ['active', 'completed', 'archived']
    case 'completed':
      return ['active', 'archived']
    case 'archived':
    case 'cancelled':
      return ['active']
  }
}

/** Common Arc lengths offered when creating a time-bound Plan. */
export const ARC_DURATION_PRESETS = [7, 30, 60, 90, 180, 365] as const

/** Last day of an Arc that starts on `start` and lasts `days` days (inclusive). */
export function arcEndDate(start: string, days: number): string {
  return addDaysTo(start, Math.max(1, Math.round(days)) - 1)
}

const dayDiff = (a: string, b: string): number => {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

export interface PlanTimeline {
  /** 1-based day of the Arc today (clamped to the Arc). */
  day: number
  totalDays: number
  daysLeft: number
  /** Whole-number percent of the Arc's time that has elapsed. */
  elapsedPercent: number
  phase: 'not_started' | 'running' | 'ended'
  startsInDays: number
}

/** Timeline for a Plan with both dates; null for ongoing Plans. */
export function planTimeline(plan: Pick<Plan, 'start_date' | 'end_date'>, now = new Date()): PlanTimeline | null {
  if (!plan.start_date || !plan.end_date || plan.end_date < plan.start_date) return null
  const today = getTodayDateString(now)
  const totalDays = dayDiff(plan.start_date, plan.end_date) + 1
  if (today < plan.start_date) {
    return { day: 0, totalDays, daysLeft: totalDays, elapsedPercent: 0, phase: 'not_started', startsInDays: dayDiff(today, plan.start_date) }
  }
  if (today > plan.end_date) {
    return { day: totalDays, totalDays, daysLeft: 0, elapsedPercent: 100, phase: 'ended', startsInDays: 0 }
  }
  const day = dayDiff(plan.start_date, today) + 1
  return {
    day,
    totalDays,
    daysLeft: totalDays - day,
    elapsedPercent: Math.round((day / totalDays) * 100),
    phase: 'running',
    startsInDays: 0,
  }
}

/** An active or paused Plan whose target end date has passed: never auto-closed, only flagged. */
export function isDueForReview(plan: Pick<Plan, 'status' | 'end_date'>, now = new Date()): boolean {
  if (plan.status !== 'active' && plan.status !== 'paused') return false
  return Boolean(plan.end_date && plan.end_date < getTodayDateString(now))
}

export interface PlanOutcomeReport {
  milestones: { done: number; total: number }
  tasks: { done: number; total: number }
  habits: { name: string; consistency: number; longestStreak: number; unit: 'days' | 'weeks' }[]
  /** Average habit consistency (whole percent), null without habits. */
  habitConsistency: number | null
  completions: number
  activeDays: number
}

/**
 * Final statistics of a Plan from its real records: milestones/tasks finished, habit
 * consistency over the Plan's own dates, total completions and active days.
 */
export function buildPlanOutcomeReport(
  plan: Pick<Plan, 'start_date' | 'end_date' | 'created_at'>,
  items: readonly ExecutionItem[],
  completionDatesByItem: Readonly<Record<string, readonly string[]>>,
  now = new Date(),
): PlanOutcomeReport {
  const live = items.filter((i) => i.status !== 'archived')
  const count = (type: ExecutionItem['type'] | ExecutionItem['type'][]) => {
    const types = Array.isArray(type) ? type : [type]
    const list = live.filter((i) => types.includes(i.type))
    return { done: list.filter((i) => i.status === 'done').length, total: list.length }
  }
  const today = getTodayDateString(now)
  const end = plan.end_date && plan.end_date < today ? plan.end_date : today
  // For an Arc that has ended, its last day is complete (not pending): evaluate from the day after.
  const ended = end < today
  const evalDate = new Date(`${ended ? addDaysTo(end, 1) : end}T12:00:00`)
  const habits = live
    .filter((i) => i.type === 'habit')
    .map((h) => {
      const since = [plan.start_date, habitTrackedSince(h)].filter((d): d is string => Boolean(d)).sort().at(-1) ?? null
      const dates = (completionDatesByItem[h.id] ?? []).filter((d) => d <= end && (!since || d >= since))
      // calcHabitStreak's window is [end - span, end], so span = days between since and end.
      const span = since ? Math.max(0, dayDiff(since, end)) + (ended ? 1 : 0) : 90
      const s = calcHabitStreak(h.id, h.schedule, dates, evalDate, span, since)
      return { name: h.name, consistency: s.consistencyRate, longestStreak: s.longestStreak, unit: s.streakUnit ?? 'days' }
    })
  const allDates = new Set<string>()
  let completions = 0
  for (const item of live) {
    for (const d of completionDatesByItem[item.id] ?? []) {
      if (plan.start_date && d < plan.start_date) continue
      if (d > end) continue
      completions++
      allDates.add(d)
    }
  }
  return {
    milestones: count('milestone'),
    tasks: count(['task', 'checklist', 'project']),
    habits,
    habitConsistency: habits.length ? Math.round(habits.reduce((a, h) => a + h.consistency, 0) / habits.length) : null,
    completions,
    activeDays: allDates.size,
  }
}

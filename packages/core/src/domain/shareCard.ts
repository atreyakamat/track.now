import type { ExecutionItem, Plan } from '../types/domain'
import { getTodayDateString } from './dates'
import { planTimeline } from './plans'
import { buildRetention, type RetentionCompletion } from './retention'
import { weekStartOf } from './schedule'

/** The numbers on a shareable weekly card: "Week 6 of my Winter Arc: 18/22 done". */
export interface WeekCard {
  title: string
  subtitle: string
  done: number
  planned: number
  percent: number | null
  /** Active-day streak and this week's active days. */
  activeDays: number
  weekLabel: string
}

export function buildWeekCard(input: {
  items: ExecutionItem[]
  plans: Plan[]
  completions: RetentionCompletion[]
  now: Date
  arcName?: string | null
  planIds?: Set<string>
}): WeekCard {
  const today = getTodayDateString(input.now)
  const weekStart = weekStartOf(today)
  const r = buildRetention({ items: input.items, plans: input.plans, completions: input.completions, now: input.now, weeks: 1, planIds: input.planIds })
  const week = r.weeks[0] ?? { done: 0, planned: 0, percent: null }
  const activeDays = new Set(input.completions.filter((c) => c.completed_date >= weekStart && c.completed_date <= today).map((c) => c.completed_date)).size

  let title = 'My week'
  let subtitle = ''
  if (input.arcName) {
    const arcPlans = input.plans.filter((p) => input.planIds?.has(p.id))
    const starts = arcPlans.map((p) => p.start_date).filter((d): d is string => Boolean(d)).sort()
    const ends = arcPlans.map((p) => p.end_date).filter((d): d is string => Boolean(d)).sort()
    const t = starts[0] && ends.at(-1) ? planTimeline({ start_date: starts[0], end_date: ends.at(-1)! }, input.now) : null
    const weekNo = t && t.phase !== 'not_started' ? Math.floor((t.day - 1) / 7) + 1 : null
    title = weekNo ? `Week ${weekNo} of my ${input.arcName}` : `My ${input.arcName}`
    subtitle = t ? `Day ${t.day} of ${t.totalDays}` : ''
  }
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return {
    title,
    subtitle,
    done: week.done,
    planned: week.planned,
    percent: week.percent,
    activeDays,
    weekLabel: `${fmt(weekStart)} – ${fmt(today)}`,
  }
}

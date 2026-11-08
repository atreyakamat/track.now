import type { ExecutionItemSummary, Plan, Progress } from '../types/domain'
import { calcProgress, type ProgressOptions } from './progress'
import { planTimeline, type PlanTimeline } from './plans'

/**
 * An Arc groups Plans from different Tracks under one name (e.g. "Winter Arc 2026" spanning
 * Health, Work and Money). It is derived from `plan.arc_name`; there is no separate table.
 */

export interface ArcSummary {
  /** Display name (as first written). */
  name: string
  /** Stable key used in URLs: lower-cased, whitespace collapsed. */
  key: string
  plans: Plan[]
  trackIds: string[]
  start: string | null
  end: string | null
  timeline: PlanTimeline | null
  /** Progress across the Arc's active Plans (all of its Plans once none are active). */
  progress: Progress
  status: 'active' | 'completed' | 'archived'
}

export const ARC_NAME_MAX = 80

export function arcKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function groupArcs(
  plans: Plan[],
  items: ExecutionItemSummary[],
  now = new Date(),
  options?: ProgressOptions,
): ArcSummary[] {
  const groups = new Map<string, Plan[]>()
  for (const p of plans) {
    const name = p.arc_name?.trim()
    if (!name) continue
    const key = arcKey(name)
    groups.set(key, [...(groups.get(key) ?? []), p])
  }
  const out: ArcSummary[] = []
  for (const [key, arcPlans] of groups) {
    const visible = arcPlans.filter((p) => p.status !== 'archived')
    const pool = visible.length ? visible : arcPlans
    const starts = pool.map((p) => p.start_date).filter((d): d is string => Boolean(d)).sort()
    const ends = pool.map((p) => p.end_date).filter((d): d is string => Boolean(d)).sort()
    const start = starts[0] ?? null
    const end = ends.at(-1) ?? null
    const active = pool.filter((p) => p.status === 'active' || p.status === 'paused' || p.status === 'draft')
    const measured = new Set((active.length ? active : pool).map((p) => p.id))
    out.push({
      name: arcPlans[0].arc_name!.trim(),
      key,
      plans: [...arcPlans].sort((a, b) => a.name.localeCompare(b.name)),
      trackIds: [...new Set(arcPlans.map((p) => p.track_id))],
      start,
      end,
      timeline: start && end ? planTimeline({ start_date: start, end_date: end }, now) : null,
      progress: calcProgress(items.filter((i) => measured.has(i.plan_id)), options),
      status: !visible.length ? 'archived' : active.length ? 'active' : 'completed',
    })
  }
  const order = { active: 0, completed: 1, archived: 2 }
  return out.sort((a, b) => order[a.status] - order[b.status] || (b.start ?? '').localeCompare(a.start ?? ''))
}

/** Distinct Arc names in use (for suggestions when creating or editing a Plan). */
export function arcNames(plans: Pick<Plan, 'arc_name'>[]): string[] {
  const seen = new Map<string, string>()
  for (const p of plans) {
    const name = p.arc_name?.trim()
    if (name && !seen.has(arcKey(name))) seen.set(arcKey(name), name)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

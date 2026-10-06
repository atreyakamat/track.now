import type { ExecutionItemSummary, Plan, Progress, Track } from '@/types/domain'

/**
 * Progress calculation layer.
 * A single source of truth for all progress:
 * progress = items with status "done" / non-archived items.
 *
 * Never fake progress. If there are 0 items, percent is 0.
 */
export function calcProgress(items: Pick<ExecutionItemSummary, 'status'>[]): Progress {
  const counted = items.filter((item) => item.status !== 'archived')
  const done = counted.filter((item) => item.status === 'done').length
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
  progress: Progress
  lastActivityAt: string
}

const latestDate = (...dates: (string | undefined)[]): string =>
  dates.filter((d): d is string => Boolean(d)).sort().at(-1) ?? ''

export function summarizePlan(plan: Plan, items: ExecutionItemSummary[]): PlanSummary {
  const own = items.filter((item) => item.plan_id === plan.id)
  const itemCountsByType: Record<string, number> = {}
  own.forEach((item) => {
    if (item.status !== 'archived') {
      itemCountsByType[item.type] = (itemCountsByType[item.type] ?? 0) + 1
    }
  })
  return {
    plan,
    progress: calcProgress(own),
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
): TrackSummary {
  const planSummaries = plans
    .filter((p) => p.track_id === track.id)
    .map((p) => summarizePlan(p, items))

  const activePlans = planSummaries.filter((s) => s.plan.status === 'active')
  const archivedPlans = planSummaries.filter((s) => s.plan.status === 'archived')

  const activePlanIds = new Set(activePlans.map((s) => s.plan.id))
  const activeItems = items.filter((item) => activePlanIds.has(item.plan_id))

  return {
    track,
    activePlans,
    archivedPlans,
    progress: calcProgress(activeItems),
    lastActivityAt: latestDate(track.updated_at, ...planSummaries.map((s) => s.lastActivityAt)),
  }
}

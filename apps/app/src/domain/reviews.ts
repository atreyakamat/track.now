import type { ExecutionItem, ItemType, Plan, Track } from '@/types/domain'
import { getTodayDateString } from './dates'
import { summarizePlan, summarizeTrack } from './progress'
import { addDays } from './streaks'
import {
  buildLookup,
  countCompletionsByTrack,
  getOpenPriorityCandidates,
  getOverdueItems,
  isDateInRange,
  itemDisplayName,
  mondayOf,
  resolveItemContext,
  summarizeHabitsForRange,
  uniqueCompletions,
  type CompletionEntry,
  type DateRange,
  type HabitPeriodRow,
  type ItemWithContext,
  type OverdueItem,
  type TrackCompletionCount,
} from './analytics'
import type { Progress } from '@/types/domain'

/**
 * Pure review derivations (weekly review / monthly reflection). Local dates only;
 * `now` is always explicit. Nothing here invents data: empty input → empty lists, 0s and nulls.
 */

export type ReviewKind = 'weekly' | 'monthly'

/** Monday–Sunday week containing `now`, shifted by `offsetWeeks` (negative = past). */
export function getWeekRange(now: Date, offsetWeeks = 0): DateRange {
  const start = addDays(mondayOf(getTodayDateString(now)), offsetWeeks * 7)
  return { start, end: addDays(start, 6) }
}

/** Calendar month containing `now`, shifted by `offsetMonths` (negative = past). */
export function getMonthRange(now: Date, offsetMonths = 0): DateRange {
  const first = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  return { start: getTodayDateString(first), end: getTodayDateString(last) }
}

/** Storage key for a review period: `weekly:YYYY-MM-DD` (week start) or `monthly:YYYY-MM`. */
export function makePeriodKey(kind: ReviewKind, range: DateRange): string {
  return kind === 'weekly' ? `weekly:${range.start}` : `monthly:${range.start.slice(0, 7)}`
}

/** True when the range starts after today (reviews never go into the future). */
export function isFutureRange(range: DateRange, now: Date): boolean {
  return range.start > getTodayDateString(now)
}

export interface ReviewWin {
  item: ExecutionItem
  track: Track | null
  plan: Plan | null
  /** Most recent completion date in the period. */
  completedDate: string
}

export interface PlanArchiveCandidate {
  plan: Plan
  track: Track
  progress: Progress
  reason: 'ended' | 'complete'
}

export interface TrackReviewRow extends TrackCompletionCount {
  /** Current progress snapshot for active tracks; null for archived/deleted ones. */
  progress: Progress | null
}

export interface ReviewSummary {
  range: DateRange
  /** Range end capped at today (what "so far" means for the current period). */
  effectiveEnd: string
  isCurrentPeriod: boolean
  overdue: OverdueItem[]
  habits: { rows: HabitPeriodRow[]; expected: number; completed: number; rate: number | null }
  wins: ReviewWin[]
  winsByType: Partial<Record<ItemType, number>>
  completedMilestones: ReviewWin[]
  planArchiveCandidates: PlanArchiveCandidate[]
  trackCompletions: TrackReviewRow[]
  totalCompletions: number
  priorityCandidates: ItemWithContext[]
}

export interface BuildReviewSummaryInput {
  tracks: readonly Track[]
  plans: readonly Plan[]
  items: readonly ExecutionItem[]
  completions: readonly CompletionEntry[]
  range: DateRange
  now: Date
}

const WIN_TYPES: ReadonlySet<ItemType> = new Set<ItemType>(['task', 'checklist', 'milestone', 'project'])

export function buildReviewSummary(input: BuildReviewSummaryInput): ReviewSummary {
  const { tracks, plans, items, range, now } = input
  const today = getTodayDateString(now)
  const effectiveEnd = range.end < today ? range.end : today
  const lookup = buildLookup(tracks, plans, items)
  const completions = uniqueCompletions(input.completions)
  const inPeriod = completions.filter((c) => isDateInRange(c.completed_date, { start: range.start, end: effectiveEnd }))

  // Wins: non-habit items completed in the period (one entry per item, latest date).
  const latestByItem = new Map<string, string>()
  for (const c of inPeriod) {
    const prev = latestByItem.get(c.item_id)
    if (!prev || c.completed_date > prev) latestByItem.set(c.item_id, c.completed_date)
  }
  const wins: ReviewWin[] = []
  for (const [itemId, completedDate] of latestByItem) {
    const item = lookup.itemById.get(itemId)
    if (!item || !WIN_TYPES.has(item.type)) continue
    const ctx = resolveItemContext(item, lookup)
    wins.push({ item, track: ctx.track, plan: ctx.plan, completedDate })
  }
  wins.sort(
    (a, b) => b.completedDate.localeCompare(a.completedDate) || itemDisplayName(a.item).localeCompare(itemDisplayName(b.item)),
  )
  const winsByType: Partial<Record<ItemType, number>> = {}
  for (const win of wins) winsByType[win.item.type] = (winsByType[win.item.type] ?? 0) + 1

  // Plans worth archiving: active plans (in a non-archived track) that ended or are 100% done.
  const completedTodayIds = new Set(completions.filter((c) => c.completed_date === today).map((c) => c.item_id))
  const progressOptions = { completedTodayIds }
  const planArchiveCandidates: PlanArchiveCandidate[] = []
  for (const plan of plans) {
    if (plan.status !== 'active') continue
    const track = lookup.trackById.get(plan.track_id)
    if (!track || track.status !== 'active') continue
    const summary = summarizePlan(plan, [...items], progressOptions)
    if (plan.end_date && plan.end_date < today) {
      planArchiveCandidates.push({ plan, track, progress: summary.progress, reason: 'ended' })
    } else {
      // "Complete" means every one-off item is finished. Habits recur, so having done
      // today's habits never makes a plan finished.
      const oneOff = summarizePlan(plan, items.filter((i) => i.type !== 'habit'), progressOptions).progress
      if (oneOff.total > 0 && oneOff.percent === 100) {
        planArchiveCandidates.push({ plan, track, progress: oneOff, reason: 'complete' })
      }
    }
  }

  // Per-track completions for the period, with a current progress snapshot for active tracks.
  const counts = countCompletionsByTrack(inPeriod, lookup, range)
  const countByTrack = new Map(counts.map((c) => [c.trackId, c]))
  const planList = [...plans]
  const itemList = [...items]
  const trackCompletions: TrackReviewRow[] = tracks
    .filter((t) => t.status === 'active')
    .map((track) => ({
      trackId: track.id,
      name: track.name,
      color: track.color || null,
      isActive: true,
      count: countByTrack.get(track.id)?.count ?? 0,
      progress: summarizeTrack(track, planList, itemList, progressOptions).progress,
    }))
  for (const row of counts) {
    if (!row.isActive) trackCompletions.push({ ...row, progress: null })
  }

  return {
    range,
    effectiveEnd,
    isCurrentPeriod: today >= range.start && today <= range.end,
    overdue: getOverdueItems(items, lookup, now),
    habits: summarizeHabitsForRange(items, lookup, completions, range, now),
    wins,
    winsByType,
    completedMilestones: wins.filter((w) => w.item.type === 'milestone'),
    planArchiveCandidates,
    trackCompletions,
    totalCompletions: inPeriod.length,
    priorityCandidates: getOpenPriorityCandidates(items, lookup),
  }
}

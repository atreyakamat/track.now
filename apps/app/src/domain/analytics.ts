import type { ExecutionItem, ItemPriority, ItemType, Plan, Progress, Track } from '@/types/domain'
import { getTodayDateString } from './dates'
import { summarizeTrack } from './progress'
import { addDays, calcHabitStreak, isHabitScheduledForDate, parseDate } from './streaks'

/**
 * Pure analytics derivations. Every number comes from real tracks, plans, items and
 * completion rows; when there is nothing to measure the result is 0 / null / [] —
 * never an estimate. All dates are LOCAL calendar dates ('YYYY-MM-DD') and `now` is
 * always passed explicitly so results are deterministic.
 */

/** Minimal completion row shape (structurally compatible with historyService.CompletionRecord). */
export interface CompletionEntry {
  item_id: string
  completed_date: string
  completed_at?: string | null
}

export interface DateRange {
  /** Inclusive local start date. */
  start: string
  /** Inclusive local end date. */
  end: string
}

export const ANALYTICS_RANGE_OPTIONS = [7, 30, 90] as const
export type AnalyticsRangeDays = (typeof ANALYTICS_RANGE_OPTIONS)[number]
export const MAX_ANALYTICS_RANGE_DAYS = 90
/** History the Analytics page loads once: the largest range plus an equal previous period. */
export const ANALYTICS_HISTORY_DAYS = MAX_ANALYTICS_RANGE_DAYS * 2

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_ITERATIONS = 3700

export const isDateString = (value: unknown): value is string =>
  typeof value === 'string' && DATE_RE.test(value)

/** The last `days` local dates ending today (inclusive). */
export function rangeEndingToday(now: Date, days: number): DateRange {
  const span = Math.max(1, Math.floor(days))
  const end = getTodayDateString(now)
  return { start: addDays(end, -(span - 1)), end }
}

/** Every local date in the range, inclusive. Empty if start > end. */
export function eachDateInRange(range: DateRange): string[] {
  const out: string[] = []
  let cursor = range.start
  let guard = 0
  while (cursor <= range.end && guard < MAX_RANGE_ITERATIONS) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
    guard++
  }
  return out
}

export const isDateInRange = (date: string, range: DateRange): boolean =>
  date >= range.start && date <= range.end

/** Local calendar date of an ISO timestamp, or null when it cannot be parsed. */
export function localDateOf(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null
  if (DATE_RE.test(timestamp)) return timestamp
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? null : getTodayDateString(parsed)
}

export function itemDisplayName(item: { name?: string | null; title?: string | null }): string {
  return item.name?.trim() || item.title?.trim() || 'Untitled item'
}

export const PRIORITY_RANK: Record<ItemPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

const priorityRank = (priority: ItemPriority | null | undefined): number =>
  priority && priority in PRIORITY_RANK ? PRIORITY_RANK[priority] : PRIORITY_RANK.medium

/** Drops malformed rows and duplicate (item, date) pairs. */
export function uniqueCompletions<T extends CompletionEntry>(completions: readonly T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const c of completions) {
    if (!c || typeof c.item_id !== 'string' || !isDateString(c.completed_date)) continue
    const key = `${c.item_id}|${c.completed_date}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

// ---------------------------------------------------------------------------
// Item context (item → plan → track), robust to missing plans/tracks.
// ---------------------------------------------------------------------------

export interface ItemContext {
  plan: Plan | null
  track: Track | null
  /** Item, its plan and its track all exist and are active (non-archived item). */
  isActive: boolean
}

export interface EntityLookup {
  trackById: Map<string, Track>
  planById: Map<string, Plan>
  itemById: Map<string, ExecutionItem>
}

export function buildLookup(
  tracks: readonly Track[],
  plans: readonly Plan[],
  items: readonly ExecutionItem[],
): EntityLookup {
  return {
    trackById: new Map(tracks.map((t) => [t.id, t])),
    planById: new Map(plans.map((p) => [p.id, p])),
    itemById: new Map(items.map((i) => [i.id, i])),
  }
}

export function resolveItemContext(item: ExecutionItem, lookup: EntityLookup): ItemContext {
  const plan = lookup.planById.get(item.plan_id) ?? null
  const trackId = plan?.track_id ?? item.track_id
  const track = trackId ? (lookup.trackById.get(trackId) ?? null) : null
  return {
    plan,
    track,
    isActive: item.status !== 'archived' && plan?.status === 'active' && track?.status === 'active',
  }
}

// ---------------------------------------------------------------------------
// Overdue + open priorities
// ---------------------------------------------------------------------------

export interface ItemWithContext {
  item: ExecutionItem
  plan: Plan
  track: Track
}

export interface OverdueItem extends ItemWithContext {
  daysOverdue: number
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000)
}

const isOpenNonHabit = (item: ExecutionItem): boolean =>
  item.type !== 'habit' && item.status !== 'done' && item.status !== 'archived'

/** Open, non-habit items in active plans/tracks whose due date is before today. */
export function getOverdueItems(
  items: readonly ExecutionItem[],
  lookup: EntityLookup,
  now: Date,
): OverdueItem[] {
  const today = getTodayDateString(now)
  const out: OverdueItem[] = []
  for (const item of items) {
    if (!isOpenNonHabit(item)) continue
    if (!isDateString(item.due_date) || item.due_date >= today) continue
    const ctx = resolveItemContext(item, lookup)
    if (!ctx.isActive || !ctx.plan || !ctx.track) continue
    out.push({ item, plan: ctx.plan, track: ctx.track, daysOverdue: daysBetween(item.due_date, today) })
  }
  return out.sort(
    (a, b) =>
      (a.item.due_date ?? '').localeCompare(b.item.due_date ?? '') ||
      priorityRank(a.item.priority) - priorityRank(b.item.priority) ||
      itemDisplayName(a.item).localeCompare(itemDisplayName(b.item)),
  )
}

/**
 * Open non-habit items in active plans/tracks, ordered urgent > high > medium > low,
 * then by due date (undated last), then by name.
 */
export function getOpenPriorityCandidates(
  items: readonly ExecutionItem[],
  lookup: EntityLookup,
): ItemWithContext[] {
  const out: ItemWithContext[] = []
  for (const item of items) {
    if (!isOpenNonHabit(item)) continue
    const ctx = resolveItemContext(item, lookup)
    if (!ctx.isActive || !ctx.plan || !ctx.track) continue
    out.push({ item, plan: ctx.plan, track: ctx.track })
  }
  return out.sort((a, b) => {
    const byPriority = priorityRank(a.item.priority) - priorityRank(b.item.priority)
    if (byPriority) return byPriority
    const aDue = isDateString(a.item.due_date) ? a.item.due_date : null
    const bDue = isDateString(b.item.due_date) ? b.item.due_date : null
    if (aDue !== bDue) {
      if (aDue === null) return 1
      if (bDue === null) return -1
      return aDue.localeCompare(bDue)
    }
    return itemDisplayName(a.item).localeCompare(itemDisplayName(b.item))
  })
}

// ---------------------------------------------------------------------------
// Habit adherence
// ---------------------------------------------------------------------------

export interface HabitAdherence {
  /** Scheduled days (or months for monthly habits) that were due in the window. */
  expected: number
  /** Of those, how many have a completion. */
  completed: number
  /** Whole-number percent, or null when nothing was expected yet. */
  rate: number | null
  unit: 'days' | 'months'
}

const lastDayOfMonth = (monthKey: string): string => {
  const [y, m] = monthKey.split('-').map(Number)
  return getTodayDateString(new Date(y, m, 0))
}

/**
 * Expected vs completed scheduled occurrences of a habit in a window.
 * - The window is capped at today and never starts before the habit was created.
 * - Today counts as expected only once it is completed (it is pending, not missed).
 * - Monthly habits are measured per calendar month: a month counts once it has a
 *   completion in the window, or once it has fully elapsed inside the window.
 */
export function calcHabitAdherence(
  habit: Pick<ExecutionItem, 'created_at' | 'schedule'>,
  completedDates: ReadonlySet<string>,
  window: DateRange,
  now: Date,
): HabitAdherence {
  const today = getTodayDateString(now)
  const created = localDateOf(habit.created_at)
  const start = created && created > window.start ? created : window.start
  const end = window.end < today ? window.end : today
  const isMonthly = habit.schedule?.frequency === 'monthly'
  let expected = 0
  let completed = 0

  if (start <= end) {
    if (isMonthly) {
      const months = new Set(eachDateInRange({ start, end }).map((d) => d.slice(0, 7)))
      const datesInWindow = Array.from(completedDates).filter((d) => d >= start && d <= end)
      for (const month of months) {
        if (datesInWindow.some((d) => d.slice(0, 7) === month)) {
          expected++
          completed++
        } else {
          const monthEnd = lastDayOfMonth(month)
          if (monthEnd <= end && monthEnd < today) expected++
        }
      }
    } else {
      for (const date of eachDateInRange({ start, end })) {
        if (!isHabitScheduledForDate(habit.schedule, date)) continue
        const done = completedDates.has(date)
        if (date === today && !done) continue
        expected++
        if (done) completed++
      }
    }
  }

  return {
    expected,
    completed,
    rate: expected > 0 ? Math.round((completed / expected) * 100) : null,
    unit: isMonthly ? 'months' : 'days',
  }
}

/** Groups completion dates by item id. */
export function completionDatesByItem(completions: readonly CompletionEntry[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const c of completions) {
    if (!isDateString(c.completed_date)) continue
    const set = map.get(c.item_id) ?? new Set<string>()
    set.add(c.completed_date)
    map.set(c.item_id, set)
  }
  return map
}

export interface HabitPeriodRow extends ItemWithContext {
  adherence: HabitAdherence
}

/** Adherence for every active habit (active item, plan and track) in a window. */
export function summarizeHabitsForRange(
  items: readonly ExecutionItem[],
  lookup: EntityLookup,
  completions: readonly CompletionEntry[],
  window: DateRange,
  now: Date,
): { rows: HabitPeriodRow[]; expected: number; completed: number; rate: number | null } {
  const datesByItem = completionDatesByItem(completions)
  const rows: HabitPeriodRow[] = []
  for (const item of items) {
    if (item.type !== 'habit') continue
    const ctx = resolveItemContext(item, lookup)
    if (!ctx.isActive || !ctx.plan || !ctx.track) continue
    const dates = datesByItem.get(item.id) ?? new Set<string>()
    rows.push({ item, plan: ctx.plan, track: ctx.track, adherence: calcHabitAdherence(item, dates, window, now) })
  }
  rows.sort(
    (a, b) =>
      (a.adherence.rate ?? 101) - (b.adherence.rate ?? 101) ||
      itemDisplayName(a.item).localeCompare(itemDisplayName(b.item)),
  )
  const expected = rows.reduce((acc, r) => acc + r.adherence.expected, 0)
  const completed = rows.reduce((acc, r) => acc + r.adherence.completed, 0)
  return { rows, expected, completed, rate: expected > 0 ? Math.round((completed / expected) * 100) : null }
}

// ---------------------------------------------------------------------------
// Track attribution
// ---------------------------------------------------------------------------

export interface TrackCompletionCount {
  /** null = completions whose item (or its plan/track) no longer exists. */
  trackId: string | null
  name: string
  color: string | null
  /** False when the track is archived/inactive or no longer exists. */
  isActive: boolean
  count: number
}

/** Completions per track in a range. Archived tracks and deleted items still count as history. */
export function countCompletionsByTrack(
  completions: readonly CompletionEntry[],
  lookup: EntityLookup,
  range: DateRange,
): TrackCompletionCount[] {
  const rows = new Map<string, TrackCompletionCount>()
  const UNKNOWN = '__unknown__'
  for (const c of completions) {
    if (!isDateInRange(c.completed_date, range)) continue
    const item = lookup.itemById.get(c.item_id)
    const track = item ? resolveItemContext(item, lookup).track : null
    const key = track ? track.id : UNKNOWN
    let row = rows.get(key)
    if (!row) {
      row = track
        ? { trackId: track.id, name: track.name, color: track.color || null, isActive: track.status === 'active', count: 0 }
        : { trackId: null, name: 'Deleted or unassigned items', color: null, isActive: false, count: 0 }
      rows.set(key, row)
    }
    row.count++
  }
  return Array.from(rows.values()).sort(
    (a, b) => Number(b.isActive) - Number(a.isActive) || b.count - a.count || a.name.localeCompare(b.name),
  )
}

// ---------------------------------------------------------------------------
// buildAnalytics
// ---------------------------------------------------------------------------

export interface DailyPoint {
  date: string
  count: number
}

export interface WeeklyBucket {
  /** First date of the bucket inside the range (a Monday unless clipped by the range). */
  start: string
  end: string
  /** Days of the bucket that fall inside the range (1–7). */
  days: number
  count: number
}

export interface PeriodComparison {
  previousRange: DateRange
  previousCompletions: number
  delta: number
  /** Whole-number percent change vs the previous period. */
  percentChange: number
}

export interface AnalyticsTotals {
  completions: number
  activeDays: number
  /** Rounded to one decimal; null when there were no active days. */
  averagePerActiveDay: number | null
  uniqueItemsCompleted: number
  /** null when the previous equal-length period has no completions to compare with. */
  comparison: PeriodComparison | null
}

export interface TrackProgressRow {
  track: Track
  progress: Progress
  activePlanCount: number
  completionsInRange: number
}

export interface HabitConsistencyRow extends HabitPeriodRow {
  completionsInRange: number
  currentStreak: number
  longestStreak: number
}

export interface DayOfWeekPoint {
  /** 0 = Sunday … 6 = Saturday (JS convention). */
  dayOfWeek: number
  label: string
  count: number
}

export interface RecentCompletion {
  itemId: string
  itemName: string
  itemType: ItemType | null
  trackName: string | null
  trackColor: string | null
  planId: string | null
  date: string
  completedAt: string | null
  /** Item, plan or track is no longer active (archived or deleted). */
  isArchivedContext: boolean
}

export interface AnalyticsResult {
  today: string
  rangeDays: number
  range: DateRange
  /** True when the user has at least one track, item or completion row. */
  hasAnyData: boolean
  daily: DailyPoint[]
  /** Monday-aligned buckets; only for ranges longer than 31 days. */
  weekly: WeeklyBucket[] | null
  totals: AnalyticsTotals
  trackProgress: TrackProgressRow[]
  completionsByTrack: TrackCompletionCount[]
  habits: HabitConsistencyRow[]
  habitTotals: { expected: number; completed: number; rate: number | null }
  dayOfWeek: DayOfWeekPoint[]
  overdue: OverdueItem[]
  recent: RecentCompletion[]
  createdVsCompleted: { created: number; completed: number }
}

export interface BuildAnalyticsInput {
  tracks: readonly Track[]
  plans: readonly Plan[]
  items: readonly ExecutionItem[]
  completions: readonly CompletionEntry[]
  completedTodayIds: ReadonlySet<string> | readonly string[]
  now: Date
  rangeDays: number
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
/** Display order Monday → Sunday. */
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** Monday (local) of the week containing `date`. */
export function mondayOf(date: string): string {
  const dow = parseDate(date).getDay()
  return addDays(date, -((dow + 6) % 7))
}

function buildWeeklyBuckets(daily: readonly DailyPoint[]): WeeklyBucket[] {
  const buckets: WeeklyBucket[] = []
  for (const point of daily) {
    const last = buckets[buckets.length - 1]
    if (last && mondayOf(last.start) === mondayOf(point.date)) {
      last.end = point.date
      last.days++
      last.count += point.count
    } else {
      buckets.push({ start: point.date, end: point.date, days: 1, count: point.count })
    }
  }
  return buckets
}

export function buildAnalytics(input: BuildAnalyticsInput): AnalyticsResult {
  const { tracks, plans, items, now } = input
  const rangeDays = Math.min(366, Math.max(1, Math.floor(input.rangeDays)))
  const today = getTodayDateString(now)
  const range = rangeEndingToday(now, rangeDays)
  const previousRange: DateRange = { start: addDays(range.start, -rangeDays), end: addDays(range.start, -1) }
  const lookup = buildLookup(tracks, plans, items)
  const completions = uniqueCompletions(input.completions)
  const inRange = completions.filter((c) => isDateInRange(c.completed_date, range))

  // Daily series (zero-filled) + weekly buckets.
  const countsByDate = new Map<string, number>()
  for (const c of inRange) countsByDate.set(c.completed_date, (countsByDate.get(c.completed_date) ?? 0) + 1)
  const daily = eachDateInRange(range).map((date) => ({ date, count: countsByDate.get(date) ?? 0 }))
  const weekly = rangeDays > 31 ? buildWeeklyBuckets(daily) : null

  // Totals and previous-period comparison.
  const activeDays = daily.filter((d) => d.count > 0).length
  const previousCompletions = completions.filter((c) => isDateInRange(c.completed_date, previousRange)).length
  const comparison: PeriodComparison | null =
    previousCompletions > 0
      ? {
          previousRange,
          previousCompletions,
          delta: inRange.length - previousCompletions,
          percentChange: Math.round(((inRange.length - previousCompletions) / previousCompletions) * 100),
        }
      : null
  const totals: AnalyticsTotals = {
    completions: inRange.length,
    activeDays,
    averagePerActiveDay: activeDays > 0 ? Math.round((inRange.length / activeDays) * 10) / 10 : null,
    uniqueItemsCompleted: new Set(inRange.map((c) => c.item_id)).size,
    comparison,
  }

  // Per-track progress for active tracks (summarizeTrack only aggregates active plans).
  const completionsByTrack = countCompletionsByTrack(inRange, lookup, range)
  const countByTrackId = new Map(completionsByTrack.map((r) => [r.trackId, r.count]))
  const progressOptions = { completedTodayIds: input.completedTodayIds }
  const planList = [...plans]
  const itemList = [...items]
  const trackProgress: TrackProgressRow[] = tracks
    .filter((t) => t.status === 'active')
    .map((track) => {
      const summary = summarizeTrack(track, planList, itemList, progressOptions)
      return {
        track,
        progress: summary.progress,
        activePlanCount: summary.activePlans.length,
        completionsInRange: countByTrackId.get(track.id) ?? 0,
      }
    })

  // Habit consistency for active habits, plus streaks from the loaded history.
  const habitSummary = summarizeHabitsForRange(items, lookup, completions, range, now)
  const datesByItem = completionDatesByItem(completions)
  const habits: HabitConsistencyRow[] = habitSummary.rows.map((row) => {
    const dates = Array.from(datesByItem.get(row.item.id) ?? [])
    const streak = calcHabitStreak(row.item.id, row.item.schedule, dates, now, rangeDays, localDateOf(row.item.created_at))
    return {
      ...row,
      completionsInRange: dates.filter((d) => isDateInRange(d, range)).length,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
    }
  })

  // Day-of-week distribution (Mon → Sun).
  const dowCounts = [0, 0, 0, 0, 0, 0, 0]
  for (const c of inRange) dowCounts[parseDate(c.completed_date).getDay()]++
  const dayOfWeek = WEEKDAY_DISPLAY_ORDER.map((dow) => ({
    dayOfWeek: dow,
    label: WEEKDAY_LABELS[dow],
    count: dowCounts[dow],
  }))

  // Recent completions (latest 10 in range).
  const recent: RecentCompletion[] = [...inRange]
    .sort(
      (a, b) =>
        b.completed_date.localeCompare(a.completed_date) ||
        (b.completed_at ?? '').localeCompare(a.completed_at ?? ''),
    )
    .slice(0, 10)
    .map((c) => {
      const item = lookup.itemById.get(c.item_id)
      const ctx = item ? resolveItemContext(item, lookup) : null
      return {
        itemId: c.item_id,
        itemName: item ? itemDisplayName(item) : 'Deleted item',
        itemType: item?.type ?? null,
        trackName: ctx?.track?.name ?? null,
        trackColor: ctx?.track?.color || null,
        planId: ctx?.plan?.id ?? null,
        date: c.completed_date,
        completedAt: c.completed_at ?? null,
        isArchivedContext: !ctx?.isActive,
      }
    })

  const created = items.filter((i) => {
    const d = localDateOf(i.created_at)
    return d !== null && isDateInRange(d, range)
  }).length

  return {
    today,
    rangeDays,
    range,
    hasAnyData: tracks.length > 0 || items.length > 0 || completions.length > 0,
    daily,
    weekly,
    totals,
    trackProgress,
    completionsByTrack,
    habits,
    habitTotals: { expected: habitSummary.expected, completed: habitSummary.completed, rate: habitSummary.rate },
    dayOfWeek,
    overdue: getOverdueItems(items, lookup, now),
    recent,
    createdVsCompleted: { created, completed: inRange.length },
  }
}

// ---------------------------------------------------------------------------
// Display helpers (locale-aware formatting of local dates)
// ---------------------------------------------------------------------------

export function formatLocalDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  if (!isDateString(date)) return date
  return parseDate(date).toLocaleDateString(undefined, options)
}

export function formatDateRangeLabel(range: DateRange): string {
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4)
  const start = formatLocalDate(range.start, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
  const end = formatLocalDate(range.end, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${start} – ${end}`
}

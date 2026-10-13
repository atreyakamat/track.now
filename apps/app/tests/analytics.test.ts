import { describe, expect, it } from 'vitest'
import {
  buildAnalytics,
  buildLookup,
  calcHabitAdherence,
  eachDateInRange,
  getOverdueItems,
  rangeEndingToday,
  type CompletionEntry,
} from '@/domain/analytics'
import type { ExecutionItem, Plan, Track } from '@/types/domain'

// Wednesday, 14 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 14, 10)
const localIso = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).toISOString()

const track = (id: string, status: Track['status'] = 'active'): Track => ({
  id,
  user_id: 'u1',
  name: `Track ${id}`,
  description: null,
  icon: 'target',
  color: '#c8f169',
  status,
  created_at: localIso(2026, 0, 1),
  updated_at: localIso(2026, 0, 1),
})

const plan = (id: string, trackId: string, status: Plan['status'] = 'active', extra: Partial<Plan> = {}): Plan => ({
  id,
  track_id: trackId,
  user_id: 'u1',
  name: `Plan ${id}`,
  description: null,
  start_date: null,
  end_date: null,
  status,
  created_at: localIso(2026, 0, 1),
  updated_at: localIso(2026, 0, 1),
  ...extra,
})

const item = (id: string, planId: string, extra: Partial<ExecutionItem> = {}): ExecutionItem => ({
  id,
  plan_id: planId,
  user_id: 'u1',
  type: 'task',
  name: `Item ${id}`,
  description: null,
  status: 'todo',
  priority: 'medium',
  due_date: null,
  schedule: null,
  created_at: localIso(2026, 0, 1),
  updated_at: localIso(2026, 0, 1),
  ...extra,
})

const done = (itemId: string, date: string): CompletionEntry => ({
  item_id: itemId,
  completed_date: date,
  completed_at: `${date}T12:00:00.000Z`,
})

const schedule = (days: number[] | null, frequency: 'daily' | 'weekly' | 'monthly' | 'custom' = 'weekly') => ({
  id: 's',
  item_id: 'x',
  frequency,
  days_of_week: days,
  time_of_day: null,
  created_at: localIso(2026, 0, 1),
})

const base = { tracks: [] as Track[], plans: [] as Plan[], items: [] as ExecutionItem[], completions: [] as CompletionEntry[], completedTodayIds: [] as string[], now: NOW }

describe('buildAnalytics — empty data', () => {
  it('returns zeros, nulls and empty lists — never fabricated values', () => {
    const result = buildAnalytics({ ...base, rangeDays: 7 })
    expect(result.hasAnyData).toBe(false)
    expect(result.daily).toHaveLength(7)
    expect(result.daily.every((d) => d.count === 0)).toBe(true)
    expect(result.weekly).toBeNull()
    expect(result.totals).toEqual({
      completions: 0,
      activeDays: 0,
      averagePerActiveDay: null,
      uniqueItemsCompleted: 0,
      comparison: null,
    })
    expect(result.trackProgress).toEqual([])
    expect(result.completionsByTrack).toEqual([])
    expect(result.habits).toEqual([])
    expect(result.habitTotals).toEqual({ expected: 0, completed: 0, rate: null })
    expect(result.dayOfWeek.map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(result.overdue).toEqual([])
    expect(result.recent).toEqual([])
    expect(result.createdVsCompleted).toEqual({ created: 0, completed: 0 })
  })

  it('a track with an empty plan shows 0% progress, not a guess', () => {
    const result = buildAnalytics({ ...base, tracks: [track('t1')], plans: [plan('p1', 't1')], rangeDays: 30 })
    expect(result.hasAnyData).toBe(true)
    expect(result.trackProgress).toHaveLength(1)
    expect(result.trackProgress[0].progress).toEqual({ total: 0, done: 0, percent: 0 })
    expect(result.trackProgress[0].completionsInRange).toBe(0)
  })
})

describe('buildAnalytics — ranges and daily series', () => {
  it('uses local dates ending today and zero-fills every day', () => {
    expect(rangeEndingToday(NOW, 7)).toEqual({ start: '2026-10-08', end: '2026-10-14' })
    const items = [item('a', 'p1'), item('b', 'p1')]
    const result = buildAnalytics({
      ...base,
      tracks: [track('t1')],
      plans: [plan('p1', 't1')],
      items,
      completions: [
        done('a', '2026-10-10'),
        done('b', '2026-10-10'),
        done('b', '2026-10-10'), // duplicate row → counted once
        done('a', '2026-10-14'),
        done('a', '2026-10-01'), // outside range
      ],
      rangeDays: 7,
    })
    expect(result.daily.map((d) => d.date)).toEqual(eachDateInRange({ start: '2026-10-08', end: '2026-10-14' }))
    expect(result.daily.map((d) => d.count)).toEqual([0, 0, 2, 0, 0, 0, 1])
    expect(result.totals.completions).toBe(3)
    expect(result.totals.activeDays).toBe(2)
    expect(result.totals.averagePerActiveDay).toBe(1.5)
    expect(result.totals.uniqueItemsCompleted).toBe(2)
  })

  it('builds Monday-aligned weekly buckets only for ranges longer than 31 days', () => {
    const completions = [done('a', '2026-07-20'), done('a', '2026-09-01'), done('a', '2026-10-14')]
    const long = buildAnalytics({ ...base, items: [item('a', 'p1')], completions, rangeDays: 90 })
    expect(long.weekly).not.toBeNull()
    const weekly = long.weekly ?? []
    expect(weekly.reduce((acc, b) => acc + b.days, 0)).toBe(90)
    expect(weekly.reduce((acc, b) => acc + b.count, 0)).toBe(3)
    for (const bucket of weekly.slice(1)) {
      expect(new Date(`${bucket.start}T00:00:00`).getDay()).toBe(1)
    }
    expect(weekly[weekly.length - 1].end).toBe('2026-10-14')
    expect(buildAnalytics({ ...base, completions, rangeDays: 30 }).weekly).toBeNull()
  })
})

describe('buildAnalytics — previous period comparison', () => {
  it('is null when the previous period has no completions', () => {
    const result = buildAnalytics({ ...base, items: [item('a', 'p1')], completions: [done('a', '2026-10-13')], rangeDays: 7 })
    expect(result.totals.comparison).toBeNull()
  })

  it('compares with the previous equal-length period when it has data', () => {
    const result = buildAnalytics({
      ...base,
      items: [item('a', 'p1'), item('b', 'p1')],
      completions: [
        done('a', '2026-10-01'), // previous window: 10-01..10-07
        done('a', '2026-10-07'),
        done('a', '2026-10-09'),
        done('b', '2026-10-09'),
        done('a', '2026-10-12'),
      ],
      rangeDays: 7,
    })
    expect(result.totals.comparison).toEqual({
      previousRange: { start: '2026-10-01', end: '2026-10-07' },
      previousCompletions: 2,
      delta: 1,
      percentChange: 50,
    })
  })
})

describe('buildAnalytics — track progress and attribution', () => {
  const tracks = [track('t1'), track('t2', 'archived')]
  const plans = [plan('p1', 't1'), plan('p2', 't1', 'archived'), plan('p3', 't2')]
  const items = [
    item('a', 'p1', { status: 'done' }),
    item('b', 'p1'),
    item('c', 'p2', { status: 'done' }), // archived plan
    item('d', 'p3', { status: 'done' }), // archived track
    item('h', 'p1', { type: 'habit', status: 'done' }), // habit 'done' from a previous day
  ]

  it('excludes archived tracks and plans from progress and counts habits only when done today', () => {
    const result = buildAnalytics({ ...base, tracks, plans, items, rangeDays: 30 })
    expect(result.trackProgress.map((r) => r.track.id)).toEqual(['t1'])
    expect(result.trackProgress[0].progress).toEqual({ total: 3, done: 1, percent: 33 })
    expect(result.trackProgress[0].activePlanCount).toBe(1)

    const withHabitToday = buildAnalytics({ ...base, tracks, plans, items, completedTodayIds: ['h'], rangeDays: 30 })
    expect(withHabitToday.trackProgress[0].progress).toEqual({ total: 3, done: 2, percent: 67 })
  })

  it('keeps history from archived tracks and deleted items, labelled as inactive', () => {
    const result = buildAnalytics({
      ...base,
      tracks,
      plans,
      items,
      completions: [done('a', '2026-10-10'), done('c', '2026-10-11'), done('d', '2026-10-12'), done('gone', '2026-10-13')],
      rangeDays: 30,
    })
    expect(result.totals.completions).toBe(4)
    expect(result.trackProgress[0].completionsInRange).toBe(2) // a + c (archived plan still belongs to t1)
    const archived = result.completionsByTrack.find((r) => r.trackId === 't2')
    expect(archived).toMatchObject({ isActive: false, count: 1 })
    const unknown = result.completionsByTrack.find((r) => r.trackId === null)
    expect(unknown).toMatchObject({ isActive: false, count: 1 })
    const deleted = result.recent.find((r) => r.itemId === 'gone')
    expect(deleted).toMatchObject({ itemName: 'Deleted item', itemType: null, isArchivedContext: true })
  })

  it('is robust to items whose plan and track no longer exist', () => {
    const result = buildAnalytics({
      ...base,
      items: [item('orphan', 'missing-plan', { due_date: '2026-10-01' }), item('oh', 'missing-plan', { type: 'habit' })],
      completions: [done('orphan', '2026-10-13')],
      rangeDays: 7,
    })
    expect(result.overdue).toEqual([])
    expect(result.habits).toEqual([])
    expect(result.recent[0]).toMatchObject({ itemName: 'Item orphan', trackName: null, isArchivedContext: true })
  })
})

describe('habit consistency', () => {
  // Mon/Wed/Fri habit created Monday 5 Oct 2026.
  const habit = item('h', 'p1', {
    type: 'habit',
    created_at: localIso(2026, 9, 5),
    schedule: schedule([1, 3, 5]),
  })
  const window = { start: '2026-09-15', end: '2026-10-14' }

  it('respects schedule days and created_at, and does not count today as missed', () => {
    const dates = new Set(['2026-10-05', '2026-10-07', '2026-10-12'])
    // Scheduled since creation: 5 (Mon), 7 (Wed), 9 (Fri), 12 (Mon); 14 (Wed, today) is pending.
    expect(calcHabitAdherence(habit, dates, window, NOW)).toEqual({ expected: 4, completed: 3, rate: 75, unit: 'days' })
  })

  it('counts today once it is completed', () => {
    const dates = new Set(['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14'])
    expect(calcHabitAdherence(habit, dates, window, NOW)).toEqual({ expected: 5, completed: 4, rate: 80, unit: 'days' })
  })

  it('returns a null rate when nothing has been due yet', () => {
    const fresh = item('n', 'p1', { type: 'habit', created_at: localIso(2026, 9, 14, 8), schedule: schedule([1]) })
    expect(calcHabitAdherence(fresh, new Set(), window, NOW)).toEqual({ expected: 0, completed: 0, rate: null, unit: 'days' })
  })

  it('measures monthly habits per elapsed calendar month', () => {
    const monthly = item('m', 'p1', { type: 'habit', created_at: localIso(2026, 7, 1), schedule: schedule(null, 'monthly') })
    const result = calcHabitAdherence(monthly, new Set(['2026-08-20']), { start: '2026-08-01', end: '2026-10-14' }, NOW)
    // August done, September elapsed and missed, October still in progress.
    expect(result).toEqual({ expected: 2, completed: 1, rate: 50, unit: 'months' })
  })

  it('lists only active habits with streaks, lowest consistency first', () => {
    const steady = item('s', 'p1', { type: 'habit', name: 'Steady', created_at: localIso(2026, 9, 10), schedule: schedule(null, 'daily') })
    const archivedPlanHabit = item('x', 'p2', { type: 'habit' })
    const result = buildAnalytics({
      ...base,
      tracks: [track('t1')],
      plans: [plan('p1', 't1'), plan('p2', 't1', 'archived')],
      items: [habit, steady, archivedPlanHabit],
      completions: [
        done('h', '2026-10-05'),
        done('s', '2026-10-10'),
        done('s', '2026-10-11'),
        done('s', '2026-10-12'),
        done('s', '2026-10-13'),
      ],
      rangeDays: 30,
    })
    expect(result.habits.map((h) => h.item.id)).toEqual(['h', 's'])
    const steadyRow = result.habits[1]
    expect(steadyRow.adherence).toEqual({ expected: 4, completed: 4, rate: 100, unit: 'days' })
    expect(steadyRow.currentStreak).toBe(4)
    expect(steadyRow.longestStreak).toBe(4)
    expect(result.habitTotals).toEqual({ expected: 8, completed: 5, rate: 63 })
  })
})

describe('overdue items', () => {
  it('excludes habits, done/archived items, archived plans/tracks and items due today; sorts by due date', () => {
    const tracks = [track('t1'), track('t2', 'archived')]
    const plans = [plan('p1', 't1'), plan('p2', 't1', 'archived'), plan('p3', 't2')]
    const items = [
      item('late2', 'p1', { due_date: '2026-10-10' }),
      item('late1', 'p1', { due_date: '2026-10-02', status: 'in_progress' }),
      item('habit', 'p1', { type: 'habit', due_date: '2026-10-01' }),
      item('done', 'p1', { due_date: '2026-10-01', status: 'done' }),
      item('archived', 'p1', { due_date: '2026-10-01', status: 'archived' }),
      item('archivedPlan', 'p2', { due_date: '2026-10-01' }),
      item('archivedTrack', 'p3', { due_date: '2026-10-01' }),
      item('today', 'p1', { due_date: '2026-10-14' }),
      item('undated', 'p1'),
    ]
    const overdue = getOverdueItems(items, buildLookup(tracks, plans, items), NOW)
    expect(overdue.map((o) => o.item.id)).toEqual(['late1', 'late2'])
    expect(overdue[0].daysOverdue).toBe(12)
    expect(overdue[1].daysOverdue).toBe(4)
  })
})

describe('day-of-week, recent and created-vs-completed', () => {
  it('distributes completions Monday → Sunday and lists the latest 10', () => {
    const items = [item('a', 'p1', { created_at: localIso(2026, 9, 12) }), item('b', 'p1', { created_at: localIso(2026, 5, 1) })]
    const completions = [
      done('a', '2026-10-12'), // Mon
      done('b', '2026-10-12'), // Mon
      done('a', '2026-10-14'), // Wed
      done('a', '2026-10-11'), // Sun
    ]
    const result = buildAnalytics({ ...base, tracks: [track('t1')], plans: [plan('p1', 't1')], items, completions, rangeDays: 7 })
    expect(result.dayOfWeek.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(result.dayOfWeek.map((d) => d.count)).toEqual([2, 0, 1, 0, 0, 0, 1])
    expect(result.recent[0]).toMatchObject({ itemId: 'a', date: '2026-10-14', trackName: 'Track t1', isArchivedContext: false })
    expect(result.createdVsCompleted).toEqual({ created: 1, completed: 4 })

    const many = Array.from({ length: 14 }, (_, i) => done(`i${i}`, '2026-10-13'))
    expect(buildAnalytics({ ...base, completions: many, rangeDays: 7 }).recent).toHaveLength(10)
  })
})

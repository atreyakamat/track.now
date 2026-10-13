import { describe, expect, it } from 'vitest'
import {
  buildReviewSummary,
  getMonthRange,
  getWeekRange,
  isFutureRange,
  makePeriodKey,
} from '@/domain/reviews'
import type { CompletionEntry } from '@/domain/analytics'
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
  color: '#9fd3ff',
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

const done = (itemId: string, date: string): CompletionEntry => ({ item_id: itemId, completed_date: date, completed_at: null })

describe('getWeekRange', () => {
  it('returns Monday–Sunday for a midweek day', () => {
    expect(getWeekRange(NOW)).toEqual({ start: '2026-10-12', end: '2026-10-18' })
  })

  it('treats Sunday as the last day of its week, and Monday as the first', () => {
    expect(getWeekRange(new Date(2026, 9, 18, 23, 30))).toEqual({ start: '2026-10-12', end: '2026-10-18' })
    expect(getWeekRange(new Date(2026, 9, 12, 0, 5))).toEqual({ start: '2026-10-12', end: '2026-10-18' })
    expect(getWeekRange(new Date(2026, 9, 19, 0, 5))).toEqual({ start: '2026-10-19', end: '2026-10-25' })
  })

  it('shifts by whole weeks and crosses year boundaries', () => {
    expect(getWeekRange(NOW, -1)).toEqual({ start: '2026-10-05', end: '2026-10-11' })
    expect(getWeekRange(new Date(2026, 0, 1, 12))).toEqual({ start: '2025-12-29', end: '2026-01-04' })
  })
})

describe('getMonthRange', () => {
  it('returns the calendar month, including month lengths and leap years', () => {
    expect(getMonthRange(NOW)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(getMonthRange(NOW, -1)).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(getMonthRange(new Date(2028, 1, 10))).toEqual({ start: '2028-02-01', end: '2028-02-29' })
    expect(getMonthRange(new Date(2026, 0, 31), -1)).toEqual({ start: '2025-12-01', end: '2025-12-31' })
  })

  it('builds period keys and detects future ranges', () => {
    expect(makePeriodKey('weekly', getWeekRange(NOW))).toBe('weekly:2026-10-12')
    expect(makePeriodKey('monthly', getMonthRange(NOW))).toBe('monthly:2026-10')
    expect(isFutureRange(getWeekRange(NOW, 1), NOW)).toBe(true)
    expect(isFutureRange(getWeekRange(NOW), NOW)).toBe(false)
  })
})

describe('buildReviewSummary', () => {
  it('returns empty results for empty data', () => {
    const summary = buildReviewSummary({ tracks: [], plans: [], items: [], completions: [], range: getWeekRange(NOW), now: NOW })
    expect(summary.overdue).toEqual([])
    expect(summary.wins).toEqual([])
    expect(summary.winsByType).toEqual({})
    expect(summary.completedMilestones).toEqual([])
    expect(summary.planArchiveCandidates).toEqual([])
    expect(summary.trackCompletions).toEqual([])
    expect(summary.priorityCandidates).toEqual([])
    expect(summary.totalCompletions).toBe(0)
    expect(summary.habits).toEqual({ rows: [], expected: 0, completed: 0, rate: null })
    expect(summary.isCurrentPeriod).toBe(true)
    expect(summary.effectiveEnd).toBe('2026-10-14')
  })

  const tracks = [track('t1'), track('t2', 'archived')]
  const plans = [
    plan('p1', 't1'),
    plan('ended', 't1', 'active', { end_date: '2026-10-01' }),
    plan('complete', 't1'),
    plan('empty', 't1'),
    plan('old', 't1', 'archived', { end_date: '2026-01-01' }),
    plan('p3', 't2'),
  ]
  const items = [
    item('overdue', 'p1', { due_date: '2026-10-09', priority: 'high' }),
    item('habitOverdue', 'p1', { type: 'habit', due_date: '2026-10-01', created_at: localIso(2026, 9, 1), schedule: { id: 's', item_id: 'habitOverdue', frequency: 'daily', days_of_week: null, time_of_day: null, created_at: localIso(2026, 9, 1) } }),
    item('archivedTrackItem', 'p3', { due_date: '2026-10-01' }),
    item('milestone', 'p1', { type: 'milestone', status: 'done' }),
    item('task', 'p1', { status: 'done' }),
    item('lastWeekTask', 'p1', { status: 'done' }),
    item('finished', 'complete', { status: 'done' }),
    item('low', 'p1', { priority: 'low', due_date: '2026-10-20' }),
    item('urgentLater', 'p1', { priority: 'urgent', due_date: '2026-11-01' }),
    item('urgentSoon', 'p1', { priority: 'urgent', due_date: '2026-10-15' }),
    item('urgentUndated', 'p1', { priority: 'urgent' }),
  ]
  const completions = [
    done('milestone', '2026-10-12'),
    done('task', '2026-10-13'),
    done('lastWeekTask', '2026-10-08'),
    done('habitOverdue', '2026-10-12'),
    done('habitOverdue', '2026-10-13'),
    done('finished', '2026-09-20'),
  ]

  it('lists overdue open non-habit items in active plans only', () => {
    const summary = buildReviewSummary({ tracks, plans, items, completions, range: getWeekRange(NOW), now: NOW })
    expect(summary.overdue.map((o) => o.item.id)).toEqual(['overdue'])
  })

  it('collects wins for the week (non-habit), counts by type, and milestones', () => {
    const summary = buildReviewSummary({ tracks, plans, items, completions, range: getWeekRange(NOW), now: NOW })
    expect(summary.wins.map((w) => w.item.id)).toEqual(['task', 'milestone'])
    expect(summary.winsByType).toEqual({ task: 1, milestone: 1 })
    expect(summary.completedMilestones.map((w) => w.item.id)).toEqual(['milestone'])
    expect(summary.totalCompletions).toBe(4)
  })

  it('caps habit consistency at today and does not count today as missed', () => {
    const summary = buildReviewSummary({ tracks, plans, items, completions, range: getWeekRange(NOW), now: NOW })
    // Mon 12 and Tue 13 done; Wed 14 (today) pending; Thu–Sun are in the future.
    expect(summary.habits.expected).toBe(2)
    expect(summary.habits.completed).toBe(2)
    expect(summary.habits.rate).toBe(100)

    const lastWeek = buildReviewSummary({ tracks, plans, items, completions, range: getWeekRange(NOW, -1), now: NOW })
    expect(lastWeek.habits.expected).toBe(7)
    expect(lastWeek.habits.completed).toBe(0)
    expect(lastWeek.isCurrentPeriod).toBe(false)
    expect(lastWeek.wins.map((w) => w.item.id)).toEqual(['lastWeekTask'])
  })

  it('suggests (never archives) plans that ended or are fully done, skipping empty and archived plans', () => {
    const summary = buildReviewSummary({ tracks, plans, items, completions, range: getMonthRange(NOW), now: NOW })
    const candidates = summary.planArchiveCandidates.map((c) => [c.plan.id, c.reason])
    expect(candidates).toEqual([
      ['ended', 'ended'],
      ['complete', 'complete'],
    ])
    expect(plans.find((p) => p.id === 'complete')?.status).toBe('active')
  })

  it('reports per-track completions for the period, keeping archived history separate', () => {
    const summary = buildReviewSummary({
      tracks,
      plans,
      items,
      completions: [...completions, done('archivedTrackItem', '2026-10-05')],
      range: getMonthRange(NOW),
      now: NOW,
    })
    const active = summary.trackCompletions.find((r) => r.trackId === 't1')
    expect(active?.count).toBe(5)
    expect(active?.progress).not.toBeNull()
    const archived = summary.trackCompletions.find((r) => r.trackId === 't2')
    expect(archived).toMatchObject({ isActive: false, count: 1, progress: null })
  })

  it('orders priority candidates urgent > high > medium > low, then by due date (undated last)', () => {
    const summary = buildReviewSummary({ tracks, plans, items, completions, range: getWeekRange(NOW), now: NOW })
    expect(summary.priorityCandidates.map((c) => c.item.id)).toEqual([
      'urgentSoon',
      'urgentLater',
      'urgentUndated',
      'overdue',
      'low',
    ])
  })
})

describe('plan archive suggestions ignore recurring habits', () => {
  it('a habits-only plan whose habits are done today is NOT suggested as complete', () => {
    const summary = buildReviewSummary({
      tracks: [track('t1')],
      plans: [plan('p1', 't1')],
      items: [item('h1', 'p1', { type: 'habit' }), item('h2', 'p1', { type: 'habit' })],
      completions: [done('h1', '2026-10-14'), done('h2', '2026-10-14')],
      range: getWeekRange(NOW),
      now: NOW,
    })
    expect(summary.planArchiveCandidates).toEqual([])
  })

  it('a plan whose one-off items are all done is suggested even if a habit is pending', () => {
    const summary = buildReviewSummary({
      tracks: [track('t1')],
      plans: [plan('p1', 't1')],
      items: [item('a', 'p1', { status: 'done' }), item('h1', 'p1', { type: 'habit' })],
      completions: [done('a', '2026-10-13')],
      range: getWeekRange(NOW),
      now: NOW,
    })
    expect(summary.planArchiveCandidates.map((c) => [c.plan.id, c.reason, c.progress.total])).toEqual([['p1', 'complete', 1]])
  })
})

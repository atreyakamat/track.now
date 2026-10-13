import { describe, expect, it } from 'vitest'
import { calcProgress, isItemDone, summarizePlan, summarizeTrack } from '@/domain/progress'
import type { ExecutionItemSummary, Plan, Track } from '@/types/domain'

/**
 * Habits are recurring. Their persisted status can read 'done' from a previous day,
 * which previously inflated Plan/Track/Dashboard progress forever after the first
 * completion. With `completedTodayIds` supplied, a habit counts as done only when it was
 * completed on the current local day.
 */
const plan: Plan = {
  id: 'plan-1',
  user_id: 'u',
  track_id: 'track-1',
  name: 'Winter Arc',
  description: null,
  status: 'active',
  start_date: null,
  end_date: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}

const track: Track = {
  id: 'track-1',
  user_id: 'u',
  name: 'Fitness',
  description: null,
  icon: 'Activity',
  color: '#c8f169',
  status: 'active',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}

const items: ExecutionItemSummary[] = [
  { id: 'h-1', plan_id: 'plan-1', type: 'habit', status: 'done', updated_at: '2026-10-11T07:00:00Z' },
  { id: 'h-2', plan_id: 'plan-1', type: 'habit', status: 'done', updated_at: '2026-10-12T07:00:00Z' },
  { id: 't-1', plan_id: 'plan-1', type: 'task', status: 'done', updated_at: '2026-10-10T07:00:00Z' },
  { id: 't-2', plan_id: 'plan-1', type: 'task', status: 'todo', updated_at: '2026-10-10T07:00:00Z' },
  { id: 'a-1', plan_id: 'plan-1', type: 'task', status: 'archived', updated_at: '2026-10-10T07:00:00Z' },
]

describe('habit-aware progress', () => {
  it('keeps legacy status-based behaviour when no completion context is supplied', () => {
    expect(calcProgress(items)).toEqual({ total: 4, done: 3, percent: 75 })
  })

  it('counts a habit as done only when it was completed today', () => {
    const completedTodayIds = new Set(['h-2'])
    // h-1 was done yesterday (stale status) -> not done; h-2 done today; t-1 done; t-2 todo
    expect(calcProgress(items, { completedTodayIds })).toEqual({ total: 4, done: 2, percent: 50 })
  })

  it('accepts a plain array of ids as the completion context', () => {
    expect(calcProgress(items, { completedTodayIds: ['h-1', 'h-2'] })).toEqual({ total: 4, done: 3, percent: 75 })
  })

  it('never counts archived items, even if listed as completed today', () => {
    expect(isItemDone({ id: 'a-1', type: 'habit', status: 'archived' }, { completedTodayIds: ['a-1'] })).toBe(false)
  })

  it('a habit with no completion today is not done regardless of its stale status', () => {
    expect(isItemDone({ id: 'h-1', type: 'habit', status: 'done' }, { completedTodayIds: [] })).toBe(false)
    expect(isItemDone({ id: 'h-1', type: 'habit', status: 'todo' }, { completedTodayIds: ['h-1'] })).toBe(true)
  })

  it('threads the completion context through plan and track rollups consistently', () => {
    const options = { completedTodayIds: new Set(['h-2']) }
    const planSummary = summarizePlan(plan, items, options)
    const trackSummary = summarizeTrack(track, [plan], items, options)
    expect(planSummary.progress).toEqual({ total: 4, done: 2, percent: 50 })
    expect(trackSummary.progress).toEqual(planSummary.progress)
  })

  it('an empty plan or track is 0% with or without context', () => {
    expect(summarizePlan(plan, [], { completedTodayIds: ['h-1'] }).progress).toEqual({ total: 0, done: 0, percent: 0 })
    expect(summarizeTrack(track, [], [], { completedTodayIds: ['h-1'] }).progress).toEqual({ total: 0, done: 0, percent: 0 })
  })
})

describe('habits not scheduled today are not part of today’s progress', () => {
  // Tuesday 13 Oct 2026
  const tuesday = new Date(2026, 9, 13, 10)
  const mwf = { frequency: 'weekly' as const, days_of_week: [1, 3, 5] }

  it('a Mon/Wed/Fri habit on a Tuesday does not drag a plan below 100%', () => {
    const p = calcProgress(
      [
        { id: 't', type: 'task', status: 'done' },
        { id: 'h', type: 'habit', status: 'todo', schedule: mwf },
      ],
      { completedTodayIds: new Set<string>(), now: tuesday },
    )
    expect(p).toEqual({ total: 1, done: 1, percent: 100 })
  })

  it('it still counts when it was completed today anyway, and on its scheduled days', () => {
    expect(
      calcProgress([{ id: 'h', type: 'habit', status: 'done', schedule: mwf }], { completedTodayIds: new Set(['h']), now: tuesday }),
    ).toEqual({ total: 1, done: 1, percent: 100 })
    const wednesday = new Date(2026, 9, 14, 10)
    expect(
      calcProgress([{ id: 'h', type: 'habit', status: 'todo', schedule: mwf }], { completedTodayIds: new Set<string>(), now: wednesday }),
    ).toEqual({ total: 1, done: 0, percent: 0 })
  })

  it('an unscheduled (null) habit is daily, and an empty list is 0%', () => {
    expect(calcProgress([{ id: 'h', type: 'habit', status: 'todo', schedule: null }], { completedTodayIds: [], now: tuesday }).total).toBe(1)
    expect(calcProgress([], { completedTodayIds: [] })).toEqual({ total: 0, done: 0, percent: 0 })
  })
})

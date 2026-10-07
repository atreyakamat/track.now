import { describe, expect, it } from 'vitest'
import { calcProgress, summarizePlan, summarizeTrack } from '@/domain/progress'
import type { ExecutionItemSummary, Plan, Track } from '@/types/domain'

describe('calcProgress', () => {
  it('returns 0% when there are no items', () => {
    expect(calcProgress([])).toEqual({ total: 0, done: 0, percent: 0 })
  })

  it('calculates completion percent correctly', () => {
    const items = [
      { status: 'done' as const },
      { status: 'todo' as const },
      { status: 'in_progress' as const },
      { status: 'done' as const },
    ]
    expect(calcProgress(items)).toEqual({ total: 4, done: 2, percent: 50 })
  })

  it('excludes archived items from total and percentage', () => {
    const items = [
      { status: 'done' as const },
      { status: 'archived' as const },
      { status: 'todo' as const },
    ]
    expect(calcProgress(items)).toEqual({ total: 2, done: 1, percent: 50 })
  })

  it('treats in_progress items as not done', () => {
    // in_progress items must not be counted as done
    expect(calcProgress([{ status: 'in_progress' }])).toEqual({ total: 1, done: 0, percent: 0 })
    expect(calcProgress([{ status: 'todo' }, { status: 'in_progress' }])).toEqual({ total: 2, done: 0, percent: 0 })
  })

  it('handles exact QA ratio specifications (0/0, 0/1, 1/1, 1/2, 2/3)', () => {
    // 0/0 -> 0%
    expect(calcProgress([])).toEqual({ total: 0, done: 0, percent: 0 })
    // 0/1 -> 0%
    expect(calcProgress([{ status: 'todo' }])).toEqual({ total: 1, done: 0, percent: 0 })
    // 1/1 -> 100%
    expect(calcProgress([{ status: 'done' }])).toEqual({ total: 1, done: 1, percent: 100 })
    // 1/2 -> 50%
    expect(calcProgress([{ status: 'done' }, { status: 'todo' }])).toEqual({ total: 2, done: 1, percent: 50 })
    // 2/3 -> 67%
    expect(calcProgress([{ status: 'done' }, { status: 'done' }, { status: 'todo' }])).toEqual({ total: 3, done: 2, percent: 67 })
  })
})

describe('summarizePlan', () => {
  const mockPlan: Plan = {
    id: 'plan-1',
    user_id: 'user-1',
    track_id: 'track-1',
    title: 'Half Marathon 2026',
    description: 'Training block',
    status: 'active',
    start_date: '2026-03-01',
    end_date: '2026-06-01',
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  }

  const mockItems: ExecutionItemSummary[] = [
    {
      id: 'item-1',
      plan_id: 'plan-1',
      type: 'habit',
      title: 'Morning stretch',
      status: 'done',
      priority: 'high',
      due_date: null,
      updated_at: '2026-01-05T00:00:00Z',
    },
    {
      id: 'item-2',
      plan_id: 'plan-1',
      type: 'task',
      title: 'Buy running shoes',
      status: 'todo',
      priority: 'medium',
      due_date: '2026-03-10',
      updated_at: '2026-01-04T00:00:00Z',
    },
    {
      id: 'item-3',
      plan_id: 'plan-other',
      type: 'task',
      title: 'Unrelated item',
      status: 'done',
      priority: 'low',
      due_date: null,
      updated_at: '2026-01-06T00:00:00Z',
    },
  ]

  it('filters items strictly belonging to the plan and counts item types', () => {
    const summary = summarizePlan(mockPlan, mockItems)
    expect(summary.plan.id).toBe('plan-1')
    expect(summary.progress).toEqual({ total: 2, done: 1, percent: 50 })
    expect(summary.itemCountsByType).toEqual({
      habit: 1,
      task: 1,
    })
    expect(summary.lastActivityAt).toBe('2026-01-05T00:00:00Z')
  })
})

describe('summarizeTrack', () => {
  const mockTrack: Track = {
    id: 'track-1',
    user_id: 'user-1',
    name: 'Fitness',
    description: 'Physical health and training',
    icon: 'activity',
    color: '#06d6a0',
    status: 'active',
    is_template: false,
    template_key: 'fitness',
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  const activePlan: Plan = {
    id: 'plan-act',
    user_id: 'user-1',
    track_id: 'track-1',
    title: 'Active Plan',
    description: null,
    status: 'active',
    start_date: null,
    end_date: null,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  const archivedPlan: Plan = {
    id: 'plan-arc',
    user_id: 'user-1',
    track_id: 'track-1',
    title: 'Old Plan',
    description: null,
    status: 'archived',
    start_date: null,
    end_date: null,
    position: 1,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  }

  const items: ExecutionItemSummary[] = [
    {
      id: 'i-1',
      plan_id: 'plan-act',
      type: 'task',
      title: 'Current item 1',
      status: 'done',
      priority: 'high',
      due_date: null,
      updated_at: '2026-01-02T00:00:00Z',
    },
    {
      id: 'i-2',
      plan_id: 'plan-act',
      type: 'task',
      title: 'Current item 2',
      status: 'todo',
      priority: 'low',
      due_date: null,
      updated_at: '2026-01-03T00:00:00Z',
    },
    {
      id: 'i-3',
      plan_id: 'plan-arc',
      type: 'task',
      title: 'Archived plan item',
      status: 'todo',
      priority: 'low',
      due_date: null,
      updated_at: '2025-01-01T00:00:00Z',
    },
  ]

  it('aggregates progress only across active plans', () => {
    const summary = summarizeTrack(mockTrack, [activePlan, archivedPlan], items)
    expect(summary.activePlans.length).toBe(1)
    expect(summary.archivedPlans.length).toBe(1)
    // Only 2 items in active plan: 1 done, 1 todo -> 50%
    expect(summary.progress).toEqual({ total: 2, done: 1, percent: 50 })
    expect(summary.lastActivityAt).toBe('2026-01-03T00:00:00Z')
  })

  it('returns 0% for an empty Track with zero plans or items', () => {
    const summary = summarizeTrack(mockTrack, [], [])
    expect(summary.activePlans.length).toBe(0)
    expect(summary.archivedPlans.length).toBe(0)
    expect(summary.progress).toEqual({ total: 0, done: 0, percent: 0 })
  })

  it('returns 0% for an empty Plan with zero items', () => {
    const summary = summarizePlan(activePlan, [])
    expect(summary.progress).toEqual({ total: 0, done: 0, percent: 0 })
    expect(summary.itemCountsByType).toEqual({})
  })

  it('aggregates across multiple active plans in the same Track', () => {
    const secondPlan: Plan = {
      id: 'plan-act-2',
      user_id: 'user-1',
      track_id: 'track-1',
      title: 'Nutrition Arc',
      status: 'active',
      start_date: null,
      end_date: null,
      position: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const extraItem: ExecutionItemSummary = {
      id: 'i-4',
      plan_id: 'plan-act-2',
      type: 'habit',
      title: 'Drink 2L water',
      status: 'done',
      priority: 'medium',
      due_date: null,
      updated_at: '2026-01-04T00:00:00Z',
    }
    const summary = summarizeTrack(mockTrack, [activePlan, secondPlan], [...items, extraItem])
    expect(summary.activePlans.length).toBe(2)
    // Active plan 1: 2 items (1 done), Active plan 2: 1 item (1 done) => 2 done / 3 total => 67%
    expect(summary.progress).toEqual({ total: 3, done: 2, percent: 67 })
  })
})

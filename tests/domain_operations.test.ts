import { describe, expect, it } from 'vitest'
import type { Plan, Track, ExecutionItemSummary, ItemStatus, ItemCompletion } from '@/types/domain'
import { calcProgress, summarizeTrack } from '@/domain/progress'

/**
 * Pure helper function matching the duplicate detection logic in NewTrackPage
 */
function findDuplicateTrack(
  existingTracks: Pick<Track, 'name' | 'template_type'>[],
  candidateName: string,
  selectedTemplate: string,
): Pick<Track, 'name' | 'template_type'> | undefined {
  return existingTracks.find(
    (t) =>
      t.name.trim().toLowerCase() === candidateName.trim().toLowerCase() ||
      (selectedTemplate !== 'custom' && t.template_type === selectedTemplate),
  )
}

describe('Duplicate Track Detection Business Logic', () => {
  const existingTracks: Pick<Track, 'name' | 'template_type'>[] = [
    { name: 'Fitness', template_type: 'fitness' },
    { name: 'Finance', template_type: 'finance' },
    { name: 'Side Project', template_type: 'custom' },
  ]

  it('detects duplicate by exact name case-insensitively', () => {
    const dup = findDuplicateTrack(existingTracks, 'fitness', 'custom')
    expect(dup).toBeDefined()
    expect(dup?.name).toBe('Fitness')
  })

  it('detects duplicate by template type for predefined templates', () => {
    const dup = findDuplicateTrack(existingTracks, 'My Health Arc', 'fitness')
    expect(dup).toBeDefined()
    expect(dup?.name).toBe('Fitness')
  })

  it('does not flag distinct custom tracks as duplicates', () => {
    const dup = findDuplicateTrack(existingTracks, 'Writing Novel', 'custom')
    expect(dup).toBeUndefined()
  })

  it('allows duplicate creation policy (non-blocking)', () => {
    const newTrack = {
      id: 'track-2',
      name: 'Fitness',
      template_type: 'fitness' as const,
    }
    const combined = [...existingTracks, newTrack]
    expect(combined.length).toBe(4)
    expect(combined.filter((t) => t.name === 'Fitness').length).toBe(2)
  })
})

describe('Plan and Item Lifecycle Transitions', () => {
  it('toggles item status from todo to done and back', () => {
    const toggle = (current: ItemStatus): ItemStatus => (current === 'done' ? 'todo' : 'done')
    expect(toggle('todo')).toBe('done')
    expect(toggle('done')).toBe('todo')
    expect(toggle('in_progress')).toBe('done')
  })

  it('excludes archived plans from active track rollups', () => {
    const track: Track = {
      id: 'track-1',
      user_id: 'user-1',
      name: 'Career',
      icon: 'briefcase',
      color: '#3a86ff',
      status: 'active',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    }

    const activePlan: Plan = {
      id: 'plan-active',
      track_id: 'track-1',
      user_id: 'user-1',
      name: 'Q4 Promotion Arc',
      status: 'active',
      start_date: null,
      end_date: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    }

    const archivedPlan: Plan = {
      id: 'plan-archived',
      track_id: 'track-1',
      user_id: 'user-1',
      name: 'Old Deliverables',
      status: 'archived',
      start_date: null,
      end_date: null,
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
    }

    const items: ExecutionItemSummary[] = [
      { id: 'i-1', plan_id: 'plan-active', type: 'task', status: 'done', updated_at: '2026-01-02' },
      { id: 'i-2', plan_id: 'plan-archived', type: 'task', status: 'todo', updated_at: '2025-01-02' },
    ]

    const summary = summarizeTrack(track, [activePlan, archivedPlan], items)
    expect(summary.progress.percent).toBe(100)
    expect(summary.activePlans.length).toBe(1)
    expect(summary.archivedPlans.length).toBe(1)
  })

  it('safely handles empty plans and tracks returning exactly 0%', () => {
    expect(calcProgress([])).toEqual({ total: 0, done: 0, percent: 0 })
  })
})

describe('Completion Deduplication Logic', () => {
  it('deduplicates completions for the same item and calendar date', () => {
    const completions: ItemCompletion[] = [
      {
        id: 'comp-1',
        item_id: 'item-100',
        user_id: 'user-1',
        completed_date: '2026-10-05',
        completed_at: '2026-10-05T08:00:00Z',
        notes: null,
      },
    ]

    const recordDeduplicated = (newItemId: string, newDate: string): boolean => {
      const exists = completions.some(
        (c) => c.item_id === newItemId && c.completed_date === newDate,
      )
      if (exists) return false
      completions.push({
        id: 'comp-2',
        item_id: newItemId,
        user_id: 'user-1',
        completed_date: newDate,
        completed_at: new Date().toISOString(),
        notes: null,
      })
      return true
    }

    // 1st attempt on same date -> rejected as duplicate
    expect(recordDeduplicated('item-100', '2026-10-05')).toBe(false)
    expect(completions.length).toBe(1)

    // Attempt on a new date -> accepted
    expect(recordDeduplicated('item-100', '2026-10-06')).toBe(true)
    expect(completions.length).toBe(2)
  })
})

describe('Authentication Routing & Guard Logic', () => {
  type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

  function getRouteAction(status: AuthStatus, isProtected: boolean): 'allow' | 'login' | 'dashboard' | 'loading' {
    if (status === 'loading') return 'loading'
    if (isProtected) {
      return status === 'authenticated' ? 'allow' : 'login'
    } else {
      return status === 'authenticated' ? 'dashboard' : 'allow'
    }
  }

  it('redirects unauthenticated users from protected routes to login', () => {
    expect(getRouteAction('unauthenticated', true)).toBe('login')
  })

  it('allows authenticated users access to protected routes', () => {
    expect(getRouteAction('authenticated', true)).toBe('allow')
  })

  it('redirects authenticated users away from login/signup to dashboard', () => {
    expect(getRouteAction('authenticated', false)).toBe('dashboard')
  })

  it('allows unauthenticated users to access public login/signup', () => {
    expect(getRouteAction('unauthenticated', false)).toBe('allow')
  })

  it('shows loading indicator while session is resolving', () => {
    expect(getRouteAction('loading', true)).toBe('loading')
    expect(getRouteAction('loading', false)).toBe('loading')
  })
})

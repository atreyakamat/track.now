import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExecutionItem } from '@/types/domain'
import {
  createExecutionItem,
  editExecutionItem,
  isMissingRpcError,
  shouldResetHabitCount,
  stepItemCount,
  toggleItemStatus,
  updateItemProgress,
} from '@/services/executionService'
import { setTrackArchived } from '@/services/tracksService'
import { setPlanArchived } from '@/services/plansService'
import { supabase } from '@/lib/supabase/client'

/**
 * Regression suite for the security + data-integrity fixes in the execution service:
 *  - RPC contract no longer sends a client-supplied user id (IDOR remediation)
 *  - fallback to the RLS-protected client path happens ONLY when the RPC is missing
 *  - schedule insert failures never produce a half-created item
 *  - completion-log failures are surfaced instead of swallowed
 *  - archive/restore never writes the non-existent archived_at column
 */
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

type Result = { data: unknown; error: { message: string; code?: string } | null }

/**
 * Builds a thenable fluent query stub: every builder method returns the same chain and
 * awaiting it resolves to `result`. Calls are recorded so payloads can be asserted.
 */
function chain(result: Result) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const obj: Record<string, unknown> = { calls }
  const methods = [
    'select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'gte',
    'maybeSingle', 'single', 'limit',
  ]
  for (const m of methods) {
    obj[m] = vi.fn((...args: unknown[]) => {
      calls.push({ method: m, args })
      return obj
    })
  }
  obj.then = (onFulfilled: (v: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return obj as Record<string, ReturnType<typeof vi.fn>> & { calls: typeof calls; then: unknown }
}

const baseRow = {
  id: 'item-1',
  plan_id: 'plan-1',
  track_id: 'track-1',
  user_id: 'user-1',
  type: 'task',
  name: 'Ship it',
  description: null,
  status: 'todo',
  priority: 'medium',
  due_date: null,
  target_count: 3,
  current_count: 1,
  unit: null,
  created_at: '2026-10-12T08:00:00.000Z',
  updated_at: '2026-10-12T08:00:00.000Z',
  track_now_item_schedules: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('stepItemCount — RPC contract (IDOR remediation)', () => {
  it('calls the RPC with item, delta, date and reset flag only — never a client-supplied user id', async () => {
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseRow, current_count: 2 },
      error: null,
    })

    const updated = await stepItemCount('item-1', 1, 'user-1', '2026-10-12', false)

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    const [fn, args] = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(fn).toBe('track_now_increment_item_count')
    expect(args).toEqual({
      p_item_id: 'item-1',
      p_delta: 1,
      p_completed_date: '2026-10-12',
      p_reset_count: false,
    })
    expect(args).not.toHaveProperty('p_user_id')
    expect(updated.current_count).toBe(2)
    // RPC success never touches the table builder
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('passes p_reset_count=true when the caller flags a new-day habit reset', async () => {
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseRow, error: null })
    await stepItemCount('item-1', 1, 'user-1', '2026-10-12', true)
    const [, args] = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(args.p_reset_count).toBe(true)
  })

  it('surfaces authorization/validation errors from the RPC instead of silently falling back', async () => {
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'Execution item not found or unauthorized', code: '42501' },
    })

    await expect(stepItemCount('item-1', 1, 'user-1', '2026-10-12')).rejects.toThrow(
      'Execution item not found or unauthorized',
    )
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('falls back to the RLS-protected client path only when PostgREST reports the function is missing', async () => {
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: {
        message: 'Could not find the function public.track_now_increment_item_count(p_completed_date, p_delta, p_item_id, p_reset_count) in the schema cache',
        code: 'PGRST202',
      },
    })

    const getChain = chain({ data: baseRow, error: null })
    const updateChain = chain({ data: { ...baseRow, current_count: 2 }, error: null })
    const completionLookup = chain({ data: null, error: null })
    const fromMock = supabase.from as ReturnType<typeof vi.fn>
    let itemCalls = 0
    fromMock.mockImplementation((table: string) => {
      if (table === 'track_now_execution_items') {
        itemCalls += 1
        return itemCalls === 1 ? getChain : updateChain
      }
      if (table === 'track_now_item_completions') return completionLookup
      throw new Error(`unexpected table ${table}`)
    })

    const updated = await stepItemCount('item-1', 1, 'user-1', '2026-10-12')
    expect(updated.current_count).toBe(2)
    expect(updateChain.update).toHaveBeenCalledWith({ current_count: 2, status: 'todo' })
  })

  it('rejects non-integer or zero deltas before touching the network', async () => {
    await expect(stepItemCount('item-1', 0, 'user-1')).rejects.toThrow('non-zero whole number')
    await expect(stepItemCount('item-1', 1.5, 'user-1')).rejects.toThrow('non-zero whole number')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('classifies missing-function errors precisely', () => {
    expect(isMissingRpcError({ code: 'PGRST202', message: 'x' })).toBe(true)
    expect(isMissingRpcError({ message: 'Could not find the function public.track_now_increment_item_count' })).toBe(true)
    expect(isMissingRpcError({ code: '42501', message: 'unauthorized' })).toBe(false)
    expect(isMissingRpcError(null)).toBe(false)
  })
})

describe('shouldResetHabitCount — daily habit counter semantics', () => {
  const now = new Date(2026, 9, 12, 9, 0, 0) // 2026-10-12 local

  it('resets a habit touched on a previous local day that is not completed today', () => {
    const item = { type: 'habit' as const, updated_at: new Date(2026, 9, 11, 23, 30).toISOString() }
    expect(shouldResetHabitCount(item, false, now)).toBe(true)
  })

  it('does not reset when the habit was already completed today', () => {
    const item = { type: 'habit' as const, updated_at: new Date(2026, 9, 11, 23, 30).toISOString() }
    expect(shouldResetHabitCount(item, true, now)).toBe(false)
  })

  it('does not reset a habit touched today, nor any non-habit item', () => {
    expect(shouldResetHabitCount({ type: 'habit', updated_at: new Date(2026, 9, 12, 1, 0).toISOString() }, false, now)).toBe(false)
    expect(shouldResetHabitCount({ type: 'task', updated_at: '2026-01-01T00:00:00.000Z' }, false, now)).toBe(false)
  })
})

describe('createExecutionItem — no silent partial success', () => {
  it('rolls back the item and throws when the schedule insert fails', async () => {
    const planLookup = chain({ data: { id: 'plan-1' }, error: null })
    const insertItem = chain({ data: { ...baseRow, type: 'habit' }, error: null })
    const schedInsert = chain({ data: null, error: { message: 'schedule insert denied' } })
    const rollback = chain({ data: null, error: null })

    const fromMock = supabase.from as ReturnType<typeof vi.fn>
    let itemCalls = 0
    fromMock.mockImplementation((table: string) => {
      if (table === 'track_now_plans') return planLookup
      if (table === 'track_now_execution_items') {
        itemCalls += 1
        return itemCalls === 1 ? insertItem : rollback
      }
      if (table === 'track_now_item_schedules') return schedInsert
      throw new Error(`unexpected table ${table}`)
    })

    await expect(
      createExecutionItem('user-1', { plan_id: 'plan-1', type: 'habit', name: 'Stretch' }),
    ).rejects.toThrow(/could not be created because its schedule failed to save/)

    expect(rollback.delete).toHaveBeenCalled()
    expect(rollback.eq).toHaveBeenCalledWith('id', 'item-1')
  })

  it('returns the item with its schedule when everything succeeds', async () => {
    const planLookup = chain({ data: { id: 'plan-1' }, error: null })
    const insertItem = chain({ data: { ...baseRow, type: 'habit' }, error: null })
    const schedInsert = chain({
      data: { id: 'sched-1', item_id: 'item-1', frequency: 'daily', days_of_week: [0, 1, 2, 3, 4, 5, 6], time_of_day: 'anytime', reminder_time: null, created_at: '' },
      error: null,
    })
    ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'track_now_plans') return planLookup
      if (table === 'track_now_execution_items') return insertItem
      if (table === 'track_now_item_schedules') return schedInsert
      throw new Error(`unexpected table ${table}`)
    })

    const created = await createExecutionItem('user-1', { plan_id: 'plan-1', type: 'habit', name: 'Stretch' })
    expect(created.schedule?.id).toBe('sched-1')
  })
})

describe('completion-log consistency is surfaced, never swallowed', () => {
  it('updateItemProgress throws a descriptive error when the completion insert fails after the status update', async () => {
    const getChain = chain({ data: baseRow, error: null })
    const updateChain = chain({ data: { ...baseRow, current_count: 3, status: 'done' }, error: null })
    // recordCompletion: item existence check -> ok; existing completion -> none; insert -> error
    const itemExists = chain({ data: { id: 'item-1' }, error: null })
    const noExisting = chain({ data: null, error: null })
    const insertFail = chain({ data: null, error: { message: 'insert failed', code: '42501' } })

    let itemCalls = 0
    let completionCalls = 0
    ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'track_now_execution_items') {
        itemCalls += 1
        if (itemCalls === 1) return getChain
        if (itemCalls === 2) return updateChain
        return itemExists
      }
      if (table === 'track_now_item_completions') {
        completionCalls += 1
        return completionCalls === 1 ? noExisting : insertFail
      }
      throw new Error(`unexpected table ${table}`)
    })

    await expect(updateItemProgress('item-1', 3, 'user-1', '2026-10-12')).rejects.toThrow(
      /completion history could not be updated/,
    )
  })

  it('toggleItemStatus surfaces a failed completion delete on uncomplete', async () => {
    const doneRow = { ...baseRow, status: 'done', current_count: 3 }
    const getChain = chain({ data: doneRow, error: null })
    const updateChain = chain({ data: { ...baseRow, status: 'todo', current_count: 0 }, error: null })
    const deleteFail = chain({ data: null, error: { message: 'delete denied' } })
    let itemCalls = 0
    ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'track_now_execution_items') {
        itemCalls += 1
        return itemCalls === 1 ? getChain : updateChain
      }
      if (table === 'track_now_item_completions') return deleteFail
      throw new Error(`unexpected table ${table}`)
    })

    await expect(toggleItemStatus('item-1', 'done', 'user-1', '2026-10-12')).rejects.toThrow(
      /completion history could not be updated \(delete denied\)/,
    )
  })
})

describe('archive/restore writes only columns that exist in the schema', () => {
  it('setTrackArchived sends status only (no archived_at)', async () => {
    const c = chain({ data: { id: 'track-1' }, error: null })
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(c)
    await setTrackArchived('track-1', true)
    expect(c.update).toHaveBeenCalledWith({ status: 'archived' })
    await setTrackArchived('track-1', false)
    expect(c.update).toHaveBeenLastCalledWith({ status: 'active' })
  })

  it('setPlanArchived sends status only (no archived_at)', async () => {
    const c = chain({ data: { id: 'plan-1' }, error: null })
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(c)
    await setPlanArchived('plan-1', true)
    expect(c.update).toHaveBeenCalledWith({ status: 'archived' })
    const payload = c.update.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(payload)).toEqual(['status'])
  })
})

describe('type guard: ExecutionItem fixtures compile without non-schema columns', () => {
  it('accepts an item without start_date', () => {
    const item: ExecutionItem = {
      id: 'x',
      plan_id: 'p',
      user_id: 'u',
      type: 'task',
      name: 'n',
      description: null,
      status: 'todo',
      priority: 'medium',
      due_date: null,
      created_at: '',
      updated_at: '',
    }
    expect(item.start_date).toBeUndefined()
  })
})

describe('history and status semantics for one-off items', () => {
  it('un-completing a task deletes ALL of its completion rows (not only today), so history is not overstated', async () => {
    const doneRow = { ...baseRow, status: 'done', current_count: 3 }
    const getChain = chain({ data: doneRow, error: null })
    const updateChain = chain({ data: { ...baseRow, status: 'todo', current_count: 0 }, error: null })
    const deleteAll = chain({ data: null, error: null })
    let itemCalls = 0
    ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'track_now_execution_items') {
        itemCalls += 1
        return itemCalls === 1 ? getChain : updateChain
      }
      if (table === 'track_now_item_completions') return deleteAll
      throw new Error(`unexpected table ${table}`)
    })

    await toggleItemStatus('item-1', 'done', 'user-1', '2026-10-12')
    expect(deleteAll.delete).toHaveBeenCalled()
    const eqCalls = deleteAll.calls.filter((c) => c.method === 'eq').map((c) => c.args)
    expect(eqCalls).toEqual([['item_id', 'item-1']])
  })

  it('toggleItemStatus derives the transition from the fresh row, not a stale caller status', async () => {
    // Caller believes the item is 'todo' (stale), but it is already 'done' in the database.
    const getChain = chain({ data: { ...baseRow, status: 'done', current_count: 3 }, error: null })
    const updateChain = chain({ data: { ...baseRow, status: 'todo', current_count: 0 }, error: null })
    let itemCalls = 0
    ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'track_now_execution_items') {
        itemCalls += 1
        return itemCalls === 1 ? getChain : updateChain
      }
      return chain({ data: null, error: null })
    })
    await toggleItemStatus('item-1', 'todo')
    expect(updateChain.update).toHaveBeenCalledWith({ status: 'todo', current_count: 0 })
  })
})

describe('editExecutionItem invariants', () => {
  it('keeps an in_progress status when an edit does not complete the item', async () => {
    const getChain = chain({ data: { ...baseRow, status: 'in_progress', current_count: 1 }, error: null })
    const updateChain = chain({ data: { ...baseRow, status: 'in_progress' }, error: null })
    let itemCalls = 0
    ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'track_now_execution_items') {
        itemCalls += 1
        return itemCalls === 1 ? getChain : updateChain
      }
      throw new Error(`unexpected table ${table}`)
    })
    await editExecutionItem('item-1', { name: 'Renamed', target_count: 5 })
    expect(updateChain.update.mock.calls[0][0]).toMatchObject({ status: 'in_progress', name: 'Renamed', target_count: 5 })
  })

  it('a plain rename never rewrites count, status or completion history', async () => {
    const getChain = chain({ data: { ...baseRow, status: 'in_progress', current_count: 1 }, error: null })
    const updateChain = chain({ data: { ...baseRow, status: 'in_progress', name: 'Renamed' }, error: null })
    let itemCalls = 0
    ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'track_now_execution_items') {
        itemCalls += 1
        return itemCalls === 1 ? getChain : updateChain
      }
      throw new Error(`unexpected table ${table}`)
    })
    await editExecutionItem('item-1', { name: 'Renamed' }, 'user-1', '2026-10-13')
    expect(updateChain.update.mock.calls[0][0]).toEqual({ name: 'Renamed' })
  })

  it('removes the recurrence schedule when a habit is converted to a task', async () => {
    const habitRow = { ...baseRow, type: 'habit', target_count: 1, current_count: 0 }
    const getChain = chain({ data: habitRow, error: null })
    const updateChain = chain({ data: { ...habitRow, type: 'task' }, error: null })
    const schedDelete = chain({ data: null, error: null })
    let itemCalls = 0
    ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'track_now_execution_items') {
        itemCalls += 1
        return itemCalls === 1 ? getChain : updateChain
      }
      if (table === 'track_now_item_schedules') return schedDelete
      throw new Error(`unexpected table ${table}`)
    })
    const updated = await editExecutionItem('item-1', { type: 'task', schedule: null })
    expect(schedDelete.delete).toHaveBeenCalled()
    expect(updated.schedule).toBeNull()
  })
})

describe('test environment safety rail', () => {
  it('points the Supabase URL at an unroutable loopback address during unit tests', () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBe('http://127.0.0.1:9')
    expect(String(import.meta.env.VITE_SUPABASE_URL)).not.toContain('supabase.co')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STALE_DAY_MESSAGE,
  effectiveCurrentCount,
  habitCountDay,
  isHabitCountStale,
  isStaleDayWrite,
  supportsCountDate,
} from '@/domain/habitCounter'
import {
  editExecutionItem,
  listCompletionsForItems,
  setItemDone,
  stepItemCount,
  updateItemProgress,
} from '@/services/executionService'
import { supabase } from '@/lib/supabase/client'

/**
 * Regression suite for the habit daily-counter edge case: a habit edited/renamed on a
 * new day before its counter is pressed must not continue (or complete with) the
 * previous day's count. `count_date` (migration 20261013000000) records which local day
 * `current_count` belongs to; legacy rows fall back to the `updated_at` heuristic.
 */
vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

type Result = { data: unknown; error: { message: string; code?: string } | null }

function chain(result: Result | ((calls: Array<{ method: string; args: unknown[] }>) => Result)) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const obj: Record<string, unknown> = { calls }
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'gte', 'lte', 'range', 'maybeSingle', 'single', 'limit']) {
    obj[m] = vi.fn((...args: unknown[]) => {
      calls.push({ method: m, args })
      return obj
    })
  }
  obj.then = (ok: (v: Result) => unknown, bad?: (e: unknown) => unknown) =>
    Promise.resolve(typeof result === 'function' ? result(calls) : result).then(ok, bad)
  return obj as Record<string, ReturnType<typeof vi.fn>> & { calls: typeof calls }
}

const from = () => supabase.from as ReturnType<typeof vi.fn>
const rpc = () => supabase.rpc as ReturnType<typeof vi.fn>

const habitRow = {
  id: 'h1',
  plan_id: 'p1',
  track_id: 't1',
  user_id: 'u1',
  type: 'habit',
  name: 'Drink water',
  description: null,
  status: 'done',
  priority: 'medium',
  due_date: null,
  target_count: 3,
  current_count: 3,
  count_date: '2026-10-12',
  unit: 'glasses',
  created_at: '2026-10-01T08:00:00.000Z',
  // Renamed this morning: updated_at is TODAY, the count is YESTERDAY's.
  updated_at: '2026-10-13T07:00:00.000Z',
  track_now_item_schedules: [],
} as const satisfies Record<string, unknown> & { type: 'habit' }

/** Routes item reads/writes and completion lookups to separate stubs. */
function wire(row: Record<string, unknown>, opts: { completedToday?: boolean } = {}) {
  const read = chain({ data: row, error: null })
  const write = chain((calls) => {
    const payload = calls.find((c) => c.method === 'update')?.args[0] as Record<string, unknown> | undefined
    return { data: { ...row, ...payload }, error: null }
  })
  const completions = chain({ data: opts.completedToday ? { id: 'c1' } : null, error: null })
  let itemCalls = 0
  from().mockImplementation((table: string) => {
    if (table === 'track_now_execution_items') {
      itemCalls += 1
      return itemCalls === 1 ? read : write
    }
    if (table === 'track_now_item_completions') return completions
    if (table === 'track_now_item_schedules') return chain({ data: null, error: null })
    throw new Error(`unexpected table ${table}`)
  })
  return { read, write, completions }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('habitCounter domain rules', () => {
  const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

  it('uses count_date, not updated_at, when the column exists', () => {
    expect(habitCountDay(habitRow)).toBe('2026-10-12')
    expect(isHabitCountStale(habitRow, false, at(2026, 10, 13))).toBe(true)
    expect(effectiveCurrentCount(habitRow, false, at(2026, 10, 13))).toBe(0)
  })

  it('same-day edits keep the count', () => {
    const today = { ...habitRow, count_date: '2026-10-13' }
    expect(isHabitCountStale(today, false, at(2026, 10, 13, 23, 59))).toBe(false)
    expect(effectiveCurrentCount(today, false, at(2026, 10, 13))).toBe(3)
  })

  it('midnight boundary: 23:59 is the same day, 00:00 is the next', () => {
    const row = { ...habitRow, count_date: '2026-10-13' }
    expect(isHabitCountStale(row, false, at(2026, 10, 13, 23, 59))).toBe(false)
    expect(isHabitCountStale(row, false, at(2026, 10, 14, 0, 0))).toBe(true)
  })

  it('a habit already completed today is never treated as stale', () => {
    expect(isHabitCountStale(habitRow, true, at(2026, 10, 13))).toBe(false)
  })

  it('non-habits never restart', () => {
    expect(isHabitCountStale({ ...habitRow, type: 'task' }, false, at(2026, 10, 20))).toBe(false)
  })

  it('legacy rows (no count_date key) fall back to the local day of updated_at', () => {
    const { count_date: _omit, ...legacy } = habitRow
    expect(supportsCountDate(legacy)).toBe(false)
    expect(supportsCountDate(habitRow)).toBe(true)
    const touched = new Date(2026, 9, 12, 22, 0).toISOString()
    expect(isHabitCountStale({ ...legacy, updated_at: touched }, false, at(2026, 10, 13, 0, 5))).toBe(true)
    expect(isHabitCountStale({ ...legacy, updated_at: touched }, false, at(2026, 10, 12, 23, 0))).toBe(false)
  })

  it('flags writes for an older day than the counter already belongs to', () => {
    expect(isStaleDayWrite({ ...habitRow, count_date: '2026-10-14' }, '2026-10-13')).toBe(true)
    expect(isStaleDayWrite({ ...habitRow, count_date: '2026-10-13' }, '2026-10-13')).toBe(false)
    expect(isStaleDayWrite({ ...habitRow, count_date: null }, '2026-10-13')).toBe(false)
    expect(isStaleDayWrite({ ...habitRow, type: 'task', count_date: '2026-10-14' }, '2026-10-13')).toBe(false)
  })
})

describe('editExecutionItem — habit edited on a new day before the first counter press', () => {
  it('rename only: writes just the name, never count/status/history', async () => {
    const { write, completions } = wire(habitRow)
    await editExecutionItem('h1', { name: 'Drink more water' }, 'u1', '2026-10-13')
    expect(write.update.mock.calls[0][0]).toEqual({ name: 'Drink more water' })
    expect(completions.insert).not.toHaveBeenCalled()
    expect(completions.delete).not.toHaveBeenCalled()
  })

  it('target change on a new day starts from 0 (yesterday 3/3 is not carried) and logs no completion', async () => {
    const { write, completions } = wire(habitRow)
    const updated = await editExecutionItem('h1', { name: 'Drink water', target_count: 4 }, 'u1', '2026-10-13')
    expect(write.update.mock.calls[0][0]).toMatchObject({
      target_count: 4,
      current_count: 0,
      status: 'todo',
      count_date: '2026-10-13',
    })
    expect(updated.current_count).toBe(0)
    expect(completions.insert).not.toHaveBeenCalled()
  })

  it('converting a habit completed yesterday into a task does not complete the task today', async () => {
    const { write, completions } = wire({ ...habitRow, target_count: 1, current_count: 1 })
    await editExecutionItem('h1', { type: 'task' }, 'u1', '2026-10-13')
    expect(write.update.mock.calls[0][0]).toMatchObject({ type: 'task', current_count: 0, status: 'todo' })
    expect(completions.insert).not.toHaveBeenCalled()
  })

  it('same-day edit keeps today\'s count', async () => {
    const { write } = wire({ ...habitRow, count_date: '2026-10-13', current_count: 2, status: 'todo' })
    await editExecutionItem('h1', { target_count: 5 }, 'u1', '2026-10-13')
    expect(write.update.mock.calls[0][0]).toMatchObject({ current_count: 2, target_count: 5, count_date: '2026-10-13' })
  })

  it('an explicit count from the user is respected', async () => {
    const { write } = wire(habitRow)
    await editExecutionItem('h1', { current_count: 1 }, 'u1', '2026-10-13')
    expect(write.update.mock.calls[0][0]).toMatchObject({ current_count: 1, status: 'todo' })
  })

  it('rejects a count write for an older day than the counter (stale request)', async () => {
    const { write } = wire({ ...habitRow, count_date: '2026-10-14' })
    await expect(editExecutionItem('h1', { current_count: 1 }, 'u1', '2026-10-13')).rejects.toThrow(STALE_DAY_MESSAGE)
    expect(write.update).not.toHaveBeenCalled()
  })
})

describe('count persistence paths stamp the day', () => {
  it('updateItemProgress writes count_date when the column exists', async () => {
    const { write } = wire({ ...habitRow, count_date: '2026-10-13', current_count: 0, status: 'todo' })
    await updateItemProgress('h1', 1, 'u1', '2026-10-13')
    expect(write.update.mock.calls[0][0]).toEqual({ current_count: 1, status: 'todo', count_date: '2026-10-13' })
  })

  it('updateItemProgress omits count_date on an un-migrated schema (no PGRST204)', async () => {
    const { count_date: _omit, ...legacy } = habitRow
    const { write } = wire({ ...legacy, current_count: 0, status: 'todo' })
    await updateItemProgress('h1', 1, 'u1', '2026-10-13')
    expect(write.update.mock.calls[0][0]).toEqual({ current_count: 1, status: 'todo' })
  })
})

describe('stepItemCount fallback path (RPC not deployed)', () => {
  const missing = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }

  it('restarts a stale habit from count_date even when the caller sent no reset hint', async () => {
    rpc().mockResolvedValue(missing)
    const { write } = wire(habitRow)
    const updated = await stepItemCount('h1', 1, 'u1', '2026-10-13', false)
    expect(write.update.mock.calls[0][0]).toMatchObject({ current_count: 1, status: 'todo', count_date: '2026-10-13' })
    expect(updated.current_count).toBe(1)
  })

  it('decrement on a new day floors at 0 without touching yesterday', async () => {
    rpc().mockResolvedValue(missing)
    const { write, completions } = wire({ ...habitRow, status: 'todo', current_count: 2 })
    await stepItemCount('h1', -1, 'u1', '2026-10-13', false)
    expect(write.update.mock.calls[0][0]).toMatchObject({ current_count: 0 })
    expect(completions.delete).not.toHaveBeenCalled()
  })

  it('a stale reset hint never wipes a habit completed today', async () => {
    rpc().mockResolvedValue(missing)
    const { write, completions } = wire({ ...habitRow, count_date: '2026-10-13' }, { completedToday: true })
    await stepItemCount('h1', 1, 'u1', '2026-10-13', true)
    expect(write.update.mock.calls[0][0]).toMatchObject({ current_count: 4, status: 'done' })
    expect(completions.delete).not.toHaveBeenCalled()
  })

  it('rejects a request for an older day without writing', async () => {
    rpc().mockResolvedValue(missing)
    const { write } = wire({ ...habitRow, count_date: '2026-10-14' })
    await expect(stepItemCount('h1', 1, 'u1', '2026-10-13')).rejects.toThrow(STALE_DAY_MESSAGE)
    expect(write.update).not.toHaveBeenCalled()
  })

  it('surfaces the server stale-day rejection instead of falling back', async () => {
    rpc().mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'This habit was already updated for a later day (2026-10-14). Refresh and try again.' },
    })
    await expect(stepItemCount('h1', 1, 'u1', '2026-10-13')).rejects.toThrow('later day')
    expect(from()).not.toHaveBeenCalled()
  })

  it('a persistence failure is reported, never turned into a fake success', async () => {
    rpc().mockResolvedValue(missing)
    const read = chain({ data: { ...habitRow, count_date: '2026-10-13', current_count: 0, status: 'todo' }, error: null })
    const write = chain({ data: null, error: { message: 'network down' } })
    let n = 0
    from().mockImplementation((table: string) => {
      if (table === 'track_now_execution_items') return ++n === 1 ? read : write
      return chain({ data: null, error: null })
    })
    await expect(stepItemCount('h1', 1, 'u1', '2026-10-13')).rejects.toThrow('network down')
  })
})

describe('setItemDone is idempotent', () => {
  it('does nothing when a task is already done (completed elsewhere)', async () => {
    const { write, completions } = wire({ ...habitRow, type: 'task', status: 'done' })
    const result = await setItemDone('h1', true, 'u1', '2026-10-13')
    expect(result.status).toBe('done')
    expect(write.update).not.toHaveBeenCalled()
    expect(completions.delete).not.toHaveBeenCalled()
  })
})

describe('completion history is paged (no silent 1000-row truncation)', () => {
  it('requests further pages until a short page arrives', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ item_id: 'h1', completed_date: `d${i}` }))
    const page2 = [{ item_id: 'h1', completed_date: 'last' }]
    const pages = [page1, page2]
    const ranges: unknown[][] = []
    from().mockImplementation(() =>
      chain((calls) => {
        const range = calls.find((c) => c.method === 'range')!.args
        ranges.push(range)
        return { data: pages[ranges.length - 1] ?? [], error: null }
      }),
    )
    const result = await listCompletionsForItems(['h1'], '2025-01-01')
    expect(result.h1).toHaveLength(1001)
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })
})

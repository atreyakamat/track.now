import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import { createKeyedQueue } from '@tracknow/core/utils/keyedQueue'
import { planItemAction, type ItemIntent } from '@tracknow/core/services/itemIntents'
import { supabase } from '@tracknow/core/lib/supabase'

/**
 * Instant ticks: the UI shows a prediction at once and saves in the background.
 *
 * These tests pin the two things that make that safe:
 *  1. the prediction equals what the service really stores (checked against an in-memory
 *     stand-in for the two tables, driven through the real executionService code), and
 *  2. writes for one item reach the server one at a time, in tap order.
 */

vi.mock('@tracknow/core/lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

type Call = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string; code?: string } | null }

/** A tiny stand-in for the items and completions tables of one item. */
function fakeDb(initial: Record<string, unknown>, completedDates: string[] = []) {
  const state = { row: { ...initial }, completions: new Set(completedDates), trips: 0, log: [] as string[] }

  function builder(resolve: (calls: Call[]) => Result) {
    const calls: Call[] = []
    const obj: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'maybeSingle', 'single', 'limit']) {
      obj[m] = (...args: unknown[]) => {
        calls.push({ method: m, args })
        return obj
      }
    }
    obj.then = (ok: (v: Result) => unknown, bad?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => {
          state.trips += 1
          return resolve(calls)
        })
        .then(ok, bad)
    return obj
  }

  const eqValue = (calls: Call[], column: string) => calls.find((c) => c.method === 'eq' && c.args[0] === column)?.args[1]

  ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table === 'track_now_execution_items') {
      return builder((calls) => {
        const update = calls.find((c) => c.method === 'update')
        if (update) {
          state.row = { ...state.row, ...(update.args[0] as Record<string, unknown>) }
          state.log.push(`update ${JSON.stringify(update.args[0])}`)
        }
        return { data: { ...state.row }, error: null }
      })
    }
    if (table === 'track_now_item_completions') {
      return builder((calls) => {
        const upsert = calls.find((c) => c.method === 'upsert')
        if (upsert) {
          const date = (upsert.args[0] as { completed_date: string }).completed_date
          state.completions.add(date)
          state.log.push(`complete ${date}`)
          return { data: null, error: null }
        }
        if (calls.some((c) => c.method === 'delete')) {
          const date = eqValue(calls, 'completed_date') as string | undefined
          if (date) state.completions.delete(date)
          else state.completions.clear()
          state.log.push(`uncomplete ${date ?? 'all'}`)
          return { data: null, error: null }
        }
        const date = eqValue(calls, 'completed_date') as string
        return { data: state.completions.has(date) ? { id: 'c' } : null, error: null }
      })
    }
    throw new Error(`unexpected table ${table}`)
  })
  // The counter RPC is not part of this stand-in: the service falls back to its own
  // read-calculate-write path, which follows the same rules as the RPC.
  ;(supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: null,
    error: { code: 'PGRST202', message: 'Could not find the function' },
  })
  return state
}

const NOW = new Date(2026, 9, 13, 9, 0, 0) // local morning of 2026-10-13
const TODAY = '2026-10-13'
const YESTERDAY = '2026-10-12'

const base = {
  plan_id: 'p1',
  user_id: 'u1',
  description: null,
  priority: 'medium',
  due_date: null,
  created_at: '2026-10-01T08:00:00.000Z',
  updated_at: '2026-10-12T08:00:00.000Z',
  track_now_item_schedules: [],
} as const

const habit = (over: Partial<ExecutionItem> = {}): ExecutionItem =>
  ({ ...base, id: 'h1', type: 'habit', name: 'Water', status: 'todo', target_count: 3, current_count: 0, count_date: TODAY, ...over }) as ExecutionItem
const task = (over: Partial<ExecutionItem> = {}): ExecutionItem =>
  ({ ...base, id: 't1', type: 'task', name: 'Send form', status: 'todo', target_count: 1, current_count: 0, ...over }) as ExecutionItem

/** Fields a tick can change; the prediction must agree with the stored row on all of them. */
const visible = (it: ExecutionItem) => ({
  status: it.status,
  current_count: it.current_count ?? 0,
  target_count: it.target_count ?? 1,
  count_date: it.count_date ?? null,
  checklist_entries: it.checklist_entries ?? null,
})

async function expectPredictionMatchesServer(item: ExecutionItem, intent: ItemIntent, wasDoneToday: boolean, completed: string[]) {
  const db = fakeDb(item as unknown as Record<string, unknown>, completed)
  const plan = planItemAction(item, intent, wasDoneToday, 'u1', NOW)
  if (!plan) throw new Error('expected a plan')
  const stored = await plan.commit()
  expect(visible(plan.item)).toEqual(visible(stored))
  expect(plan.doneTodayFromServer(stored)).toBe(plan.doneToday)
  // The completion log is the per-day truth for "done today".
  expect(db.completions.has(TODAY)).toBe(plan.doneToday)
  return { db, plan, stored }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('planItemAction predicts exactly what the service stores', () => {
  it('ticking a habit whose count is from yesterday completes today and keeps yesterday in history', async () => {
    const item = habit({ current_count: 3, status: 'done', count_date: YESTERDAY })
    const { db, plan } = await expectPredictionMatchesServer(item, { kind: 'toggle' }, false, [YESTERDAY])
    expect(plan.item).toMatchObject({ status: 'done', current_count: 3, count_date: TODAY })
    expect([...db.completions].sort()).toEqual([YESTERDAY, TODAY])
  })

  it('a habit tick is three round trips (read, update, completion), not six', async () => {
    const { db } = await expectPredictionMatchesServer(habit(), { kind: 'toggle' }, false, [])
    expect(db.trips).toBe(3)
  })

  it('un-ticking a habit done today clears only today', async () => {
    const item = habit({ current_count: 3, status: 'done' })
    const { db, plan } = await expectPredictionMatchesServer(item, { kind: 'toggle' }, true, [YESTERDAY, TODAY])
    expect(plan.item).toMatchObject({ status: 'todo', current_count: 0 })
    expect([...db.completions]).toEqual([YESTERDAY])
  })

  it('the first +1 of a new day restarts the counter at 1', async () => {
    const item = habit({ current_count: 2, count_date: YESTERDAY })
    const { plan } = await expectPredictionMatchesServer(item, { kind: 'step', delta: 1 }, false, [])
    expect(plan.item).toMatchObject({ current_count: 1, status: 'todo', count_date: TODAY })
    expect(plan.doneToday).toBe(false)
  })

  it('the +1 that reaches the target completes the habit', async () => {
    const { plan } = await expectPredictionMatchesServer(habit({ current_count: 2 }), { kind: 'step', delta: 1 }, false, [])
    expect(plan.item).toMatchObject({ current_count: 3, status: 'done' })
    expect(plan.doneToday).toBe(true)
  })

  it('a -1 from a completed habit re-opens today', async () => {
    const item = habit({ current_count: 3, status: 'done' })
    const { plan } = await expectPredictionMatchesServer(item, { kind: 'step', delta: -1 }, true, [TODAY])
    expect(plan.item).toMatchObject({ current_count: 2, status: 'todo' })
  })

  it('typing a count stores that count', async () => {
    const { plan } = await expectPredictionMatchesServer(habit({ current_count: 1 }), { kind: 'setCount', count: 7 }, false, [])
    expect(plan.item).toMatchObject({ current_count: 7, status: 'done' })
  })

  it('ticking and un-ticking a task', async () => {
    const done = await expectPredictionMatchesServer(task(), { kind: 'toggle' }, false, [])
    expect(done.plan.item).toMatchObject({ status: 'done', current_count: 1 })
    const undone = await expectPredictionMatchesServer(task({ status: 'done', current_count: 1 }), { kind: 'toggle' }, true, [TODAY])
    expect(undone.plan.item).toMatchObject({ status: 'todo', current_count: 0 })
  })

  it('un-ticking a task finished on an earlier day removes that completion', async () => {
    const item = task({ status: 'done', current_count: 1 })
    const { db } = await expectPredictionMatchesServer(item, { kind: 'toggle' }, false, [YESTERDAY])
    expect(db.completions.size).toBe(0)
  })

  it('the last checklist step completes the checklist; un-ticking it re-opens it', async () => {
    const entries = [{ id: 'a', label: 'Fees', done: true }, { id: 'b', label: 'Slots', done: false }]
    const list = task({ id: 'c1', type: 'checklist', checklist_entries: entries })
    const done = await expectPredictionMatchesServer(list, { kind: 'checklist', entryId: 'b' }, false, [])
    expect(done.plan.item.status).toBe('done')

    const allDone = task({ id: 'c1', type: 'checklist', status: 'done', current_count: 1, checklist_entries: entries.map((e) => ({ ...e, done: true })) })
    const reopened = await expectPredictionMatchesServer(allDone, { kind: 'checklist', entryId: 'a' }, true, [TODAY])
    expect(reopened.plan.item.status).toBe('todo')
  })

  it('routine steps: a middle step is progress, the last step completes today', async () => {
    const steps = [{ id: 'a', label: 'Stretch', done: true }, { id: 'b', label: 'Run', done: false }, { id: 'c', label: 'Log', done: false }]
    const routine = habit({ target_count: 3, current_count: 1, checklist_entries: steps })
    const middle = await expectPredictionMatchesServer(routine, { kind: 'checklist', entryId: 'b' }, false, [])
    expect(middle.plan.item).toMatchObject({ current_count: 2, status: 'todo' })

    const nearly = habit({ target_count: 3, current_count: 2, checklist_entries: steps.map((s) => ({ ...s, done: s.id !== 'c' })) })
    const last = await expectPredictionMatchesServer(nearly, { kind: 'checklist', entryId: 'c' }, false, [])
    expect(last.plan.item).toMatchObject({ current_count: 3, status: 'done' })
  })

  it('a routine ticked yesterday starts open again today', async () => {
    const steps = [{ id: 'a', label: 'Stretch', done: true }, { id: 'b', label: 'Run', done: true }]
    const routine = habit({ target_count: 2, current_count: 2, status: 'done', count_date: YESTERDAY, checklist_entries: steps })
    const { plan } = await expectPredictionMatchesServer(routine, { kind: 'checklist', entryId: 'a' }, false, [YESTERDAY])
    expect(plan.item.checklist_entries).toEqual([{ id: 'a', label: 'Stretch', done: true }, { id: 'b', label: 'Run', done: false }])
    expect(plan.item).toMatchObject({ current_count: 1, status: 'todo', count_date: TODAY })
  })

  it('returns null when nothing would change', () => {
    expect(planItemAction(habit(), { kind: 'step', delta: 0 }, false, 'u1', NOW)).toBeNull()
    expect(planItemAction(habit(), { kind: 'step', delta: -1 }, false, 'u1', NOW)).toBeNull()
    expect(planItemAction(task({ type: 'checklist', checklist_entries: [] }), { kind: 'checklist', entryId: 'zz' }, false, 'u1', NOW)).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('rapid taps on one item', () => {
  it('tick, un-tick, tick: each prediction builds on the last and the server ends in the same state', async () => {
    const start = habit()
    const db = fakeDb(start as unknown as Record<string, unknown>)
    const queue = createKeyedQueue()

    let shown = start
    let doneToday = false
    const saves: Array<Promise<ExecutionItem>> = []
    for (let tap = 0; tap < 3; tap += 1) {
      const plan = planItemAction(shown, { kind: 'toggle' }, doneToday, 'u1', NOW)
      if (!plan) throw new Error('expected a plan')
      shown = plan.item // what the user sees immediately, before any save has finished
      doneToday = plan.doneToday
      saves.push(queue.enqueue(start.id, plan.commit))
    }
    expect(doneToday).toBe(true)
    expect(db.trips).toBe(0) // nothing was awaited to update the screen

    const stored = await Promise.all(saves)
    expect(visible(stored[2])).toEqual(visible(shown))
    expect(db.completions.has(TODAY)).toBe(true)
    expect(db.log.filter((l) => !l.startsWith('update'))).toEqual([`complete ${TODAY}`, `uncomplete ${TODAY}`, `complete ${TODAY}`])
  })

  it('+1 three times reaches the target once', async () => {
    const start = habit()
    const db = fakeDb(start as unknown as Record<string, unknown>)
    const queue = createKeyedQueue()
    let shown = start
    let doneToday = false
    const saves: Array<Promise<ExecutionItem>> = []
    for (let tap = 0; tap < 3; tap += 1) {
      const plan = planItemAction(shown, { kind: 'step', delta: 1 }, doneToday, 'u1', NOW)
      if (!plan) throw new Error('expected a plan')
      shown = plan.item
      doneToday = plan.doneToday
      saves.push(queue.enqueue(start.id, plan.commit))
    }
    expect(shown).toMatchObject({ current_count: 3, status: 'done' })
    const stored = await Promise.all(saves)
    expect(stored.map((s) => s.current_count)).toEqual([1, 2, 3])
    expect(db.log.filter((l) => l.startsWith('complete'))).toEqual([`complete ${TODAY}`])
  })
})

describe('createKeyedQueue', () => {
  const deferred = <T,>() => {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
  const tick = () => new Promise((r) => setTimeout(r, 0))

  it('runs tasks for one key one at a time, in order', async () => {
    const queue = createKeyedQueue()
    const first = deferred<string>()
    const order: string[] = []
    const a = queue.enqueue('k', async () => {
      order.push('a:start')
      const v = await first.promise
      order.push('a:end')
      return v
    })
    const b = queue.enqueue('k', async () => {
      order.push('b:start')
      return 'b'
    })
    await tick()
    expect(order).toEqual(['a:start'])
    expect(queue.pending('k')).toBe(2)
    first.resolve('a')
    expect(await a).toBe('a')
    expect(await b).toBe('b')
    expect(order).toEqual(['a:start', 'a:end', 'b:start'])
    expect(queue.pending('k')).toBe(0)
    expect(queue.totalPending()).toBe(0)
  })

  it('different keys do not wait for each other', async () => {
    const queue = createKeyedQueue()
    const slow = deferred<void>()
    const started: string[] = []
    const a = queue.enqueue('a', async () => {
      started.push('a')
      await slow.promise
    })
    const b = queue.enqueue('b', async () => {
      started.push('b')
      return 2
    })
    expect(await b).toBe(2)
    expect(started).toEqual(['a', 'b'])
    expect(queue.totalPending()).toBe(1)
    slow.resolve()
    await a
    expect(queue.totalPending()).toBe(0)
  })

  it('a failed task rejects for its caller only and the next task still runs', async () => {
    const queue = createKeyedQueue()
    const failing = queue.enqueue('k', async () => {
      throw new Error('offline')
    })
    const next = queue.enqueue('k', async () => 'saved')
    await expect(failing).rejects.toThrow('offline')
    expect(await next).toBe('saved')
    expect(queue.pending('k')).toBe(0)
  })

  it('the count has already dropped when the caller hears the result', async () => {
    const queue = createKeyedQueue()
    let pendingSeenByCaller = -1
    await queue.enqueue('k', async () => 1).then(() => {
      pendingSeenByCaller = queue.pending('k')
    })
    expect(pendingSeenByCaller).toBe(0)

    let pendingSeenOnFailure = -1
    await queue
      .enqueue('k', async () => {
        throw new Error('x')
      })
      .catch(() => {
        pendingSeenOnFailure = queue.pending('k')
      })
    expect(pendingSeenOnFailure).toBe(0)
  })
})

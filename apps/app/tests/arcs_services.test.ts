import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@tracknow/core/lib/supabase'
import { createExecutionItem, setChecklistEntries } from '@tracknow/core/services/executionService'
import { completePlan, createPlan, setPlanStatus, STATUS_NEEDS_MIGRATION_MESSAGE } from '@tracknow/core/services/plansService'
import { isLegacySchema, resetSchemaCompat } from '@tracknow/core/services/schemaCompat'

/**
 * Service-level behaviour of the Plans/Arcs + flexible items release against both database
 * states: migration 20261108000000 applied, and not applied yet (the live project until the
 * owner runs it).
 */
vi.mock('@tracknow/core/lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

type Result = { data: unknown; error: { message: string; code?: string } | null }

function chain(result: Result | ((calls: Array<{ method: string; args: unknown[] }>) => Result)) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const obj: Record<string, unknown> = { calls }
  for (const m of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'gte', 'maybeSingle', 'single', 'limit', 'range']) {
    obj[m] = vi.fn((...args: unknown[]) => {
      calls.push({ method: m, args })
      return obj
    })
  }
  obj.then = (ok: (v: Result) => unknown, bad?: (e: unknown) => unknown) =>
    Promise.resolve(typeof result === 'function' ? result(calls) : result).then(ok, bad)
  return obj as Record<string, ReturnType<typeof vi.fn>> & { calls: typeof calls }
}

const from = supabase.from as ReturnType<typeof vi.fn>
const payloadOf = (c: { calls: Array<{ method: string; args: unknown[] }> }, method: 'insert' | 'update' | 'upsert') =>
  c.calls.find((x) => x.method === method)?.args[0] as Record<string, unknown>
const missingColumn = { message: "Could not find the 'plan_kind' column of 'track_now_plans' in the schema cache", code: 'PGRST204' }

beforeEach(() => {
  vi.clearAllMocks()
  resetSchemaCompat()
})

describe('createPlan', () => {
  it('stores kind, outcome and success criteria (blank text becomes NULL)', async () => {
    const track = chain({ data: { id: 't1' }, error: null })
    const insert = chain({ data: { id: 'p1' }, error: null })
    from.mockReturnValueOnce(track).mockReturnValueOnce(insert)
    await createPlan('u1', { track_id: 't1', name: 'Winter Arc', description: '  ', start_date: '2026-11-09', end_date: '2027-02-06', plan_kind: 'time_bound', outcome: ' Fit ', success_criteria: '' })
    expect(payloadOf(insert, 'insert')).toMatchObject({ plan_kind: 'time_bound', outcome: 'Fit', success_criteria: null, description: null, user_id: 'u1' })
  })

  it('on a database without the migration, retries once without the new columns', async () => {
    const track = chain({ data: { id: 't1' }, error: null })
    const first = chain({ data: null, error: missingColumn })
    const retry = chain({ data: { id: 'p1' }, error: null })
    from.mockReturnValueOnce(track).mockReturnValueOnce(first).mockReturnValueOnce(retry)
    const plan = await createPlan('u1', { track_id: 't1', name: 'Arc', description: null, start_date: null, end_date: null, plan_kind: 'ongoing', outcome: 'x' })
    expect(plan.id).toBe('p1')
    expect(payloadOf(retry, 'insert')).not.toHaveProperty('plan_kind')
    expect(payloadOf(retry, 'insert')).not.toHaveProperty('outcome')
    expect(isLegacySchema()).toBe(true)
  })
})

describe('Plan lifecycle', () => {
  it('pausing on an old database explains why instead of failing silently', async () => {
    from.mockReturnValueOnce(chain({ data: null, error: { message: 'violates check constraint', code: '23514' } }))
    await expect(setPlanStatus('p1', 'paused')).rejects.toThrow(STATUS_NEEDS_MIGRATION_MESSAGE)
  })

  it('completing stores the review with the Plan and never touches items or completions', async () => {
    const upd = chain({ data: { id: 'p1', status: 'completed' }, error: null })
    from.mockReturnValueOnce(upd)
    await completePlan('p1', { result_notes: ' 38 sessions ', lessons_learned: '', next_decision: 'Keep going' }, new Date('2027-02-06T20:00:00Z'))
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('track_now_plans')
    expect(payloadOf(upd, 'update')).toEqual({
      status: 'completed',
      completed_at: '2027-02-06T20:00:00.000Z',
      result_notes: '38 sessions',
      lessons_learned: null,
      next_decision: 'Keep going',
    })
  })
})

describe('createExecutionItem with start date, steps and weekly target', () => {
  const row = { id: 'i1', plan_id: 'p1', type: 'habit', name: 'Run', status: 'todo', priority: 'medium', track_now_item_schedules: [] }

  it('writes start_date and times_per_week', async () => {
    const plan = chain({ data: { id: 'p1' }, error: null })
    const item = chain({ data: row, error: null })
    const sched = chain({ data: { id: 's1', times_per_week: 3 }, error: null })
    from.mockReturnValueOnce(plan).mockReturnValueOnce(item).mockReturnValueOnce(sched)
    const created = await createExecutionItem('u1', {
      plan_id: 'p1',
      type: 'habit',
      name: 'Run',
      start_date: '2026-11-16',
      schedule: { frequency: 'weekly', days_of_week: null, times_per_week: 3 },
    })
    expect(payloadOf(item, 'insert')).toMatchObject({ start_date: '2026-11-16' })
    expect(payloadOf(sched, 'insert')).toMatchObject({ frequency: 'weekly', days_of_week: null, times_per_week: 3 })
    expect(created.schedule).toMatchObject({ times_per_week: 3 })
  })

  it('still creates the item on an old database (the new fields are dropped, not the item)', async () => {
    const plan = chain({ data: { id: 'p1' }, error: null })
    const first = chain({ data: null, error: { message: "column \"start_date\" does not exist", code: '42703' } })
    const retry = chain({ data: row, error: null })
    const sched = chain({ data: { id: 's1' }, error: null })
    from.mockReturnValueOnce(plan).mockReturnValueOnce(first).mockReturnValueOnce(retry).mockReturnValueOnce(sched)
    await createExecutionItem('u1', { plan_id: 'p1', type: 'habit', name: 'Run', start_date: '2026-11-16', schedule: { frequency: 'weekly', times_per_week: 3 } })
    expect(payloadOf(retry, 'insert')).not.toHaveProperty('start_date')
    // Legacy schema is now known, so the schedule insert skips times_per_week straight away.
    expect(payloadOf(sched, 'insert')).not.toHaveProperty('times_per_week')
  })
})

describe('setChecklistEntries', () => {
  it('ticking the last step completes the checklist and records exactly one completion', async () => {
    const current = {
      id: 'c1', plan_id: 'p1', type: 'checklist', name: 'Tutoring setup', status: 'todo', priority: 'medium', target_count: 1, current_count: 0,
      checklist_entries: [{ id: 'a', label: 'Fees', done: true }, { id: 'b', label: 'Slots', done: false }], track_now_item_schedules: [],
    }
    const get = chain({ data: current, error: null })
    const upd = chain({ data: { ...current, status: 'done' }, error: null })
    const ins = chain({ data: null, error: null })
    from.mockReturnValueOnce(get).mockReturnValueOnce(upd).mockReturnValueOnce(ins)
    const updated = await setChecklistEntries('c1', current.checklist_entries.map((e) => ({ ...e, done: true })), 'u1', '2026-11-12')
    expect(updated.status).toBe('done')
    expect(payloadOf(upd, 'update')).toMatchObject({ status: 'done', current_count: 1 })
    // One duplicate-safe write, three round trips in total (read, update, completion).
    expect(payloadOf(ins, 'upsert')).toMatchObject({ item_id: 'c1', user_id: 'u1', completed_date: '2026-11-12' })
    expect(ins.upsert).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledTimes(3)
  })
})

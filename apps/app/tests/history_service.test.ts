import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HISTORY_PAGE_SIZE, listCompletionHistory } from '@/services/historyService'
import { supabase } from '@/lib/supabase/client'

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

type Result = { data: unknown; error: { message: string } | null }

/** Thenable fluent query stub; records every builder call. */
function chain(result: Result) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const obj: Record<string, unknown> = { calls }
  for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'range']) {
    obj[m] = vi.fn((...args: unknown[]) => {
      calls.push({ method: m, args })
      return obj
    })
  }
  obj.then = (onFulfilled: (v: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return obj as { calls: typeof calls }
}

const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listCompletionHistory', () => {
  it('builds a user- and date-scoped query ordered by completed_date', async () => {
    const rows = [{ item_id: 'a', completed_date: '2026-10-12', completed_at: '2026-10-12T08:00:00Z' }]
    const q = chain({ data: rows, error: null })
    fromMock.mockReturnValueOnce(q)

    await expect(listCompletionHistory('user-1', '2026-04-18', '2026-10-14')).resolves.toEqual(rows)

    expect(fromMock).toHaveBeenCalledWith('track_now_item_completions')
    expect(q.calls).toEqual([
      { method: 'select', args: ['item_id, completed_date, completed_at'] },
      { method: 'eq', args: ['user_id', 'user-1'] },
      { method: 'gte', args: ['completed_date', '2026-04-18'] },
      { method: 'lte', args: ['completed_date', '2026-10-14'] },
      { method: 'order', args: ['completed_date', { ascending: true }] },
      { method: 'order', args: ['item_id', { ascending: true }] },
      { method: 'range', args: [0, HISTORY_PAGE_SIZE - 1] },
    ])
  })

  it('omits the upper bound when no end date is given and returns [] for no rows', async () => {
    const q = chain({ data: null, error: null })
    fromMock.mockReturnValueOnce(q)
    await expect(listCompletionHistory('user-1', '2026-10-01')).resolves.toEqual([])
    expect(q.calls.some((c) => c.method === 'lte')).toBe(false)
  })

  it('throws the backend error instead of swallowing it', async () => {
    fromMock.mockReturnValueOnce(chain({ data: null, error: { message: 'permission denied' } }))
    await expect(listCompletionHistory('user-1', '2026-10-01', '2026-10-14')).rejects.toThrow('permission denied')
  })

  it('pages through results so large histories are not silently truncated', async () => {
    const page = (n: number, offset: number) =>
      Array.from({ length: n }, (_, i) => ({ item_id: `i${offset + i}`, completed_date: '2026-10-01', completed_at: null }))
    const first = chain({ data: page(HISTORY_PAGE_SIZE, 0), error: null })
    const second = chain({ data: page(2, HISTORY_PAGE_SIZE), error: null })
    fromMock.mockReturnValueOnce(first).mockReturnValueOnce(second)

    const result = await listCompletionHistory('user-1', '2026-01-01', '2026-10-14')
    expect(result).toHaveLength(HISTORY_PAGE_SIZE + 2)
    expect(first.calls.at(-1)).toEqual({ method: 'range', args: [0, HISTORY_PAGE_SIZE - 1] })
    expect(second.calls.at(-1)).toEqual({ method: 'range', args: [HISTORY_PAGE_SIZE, HISTORY_PAGE_SIZE * 2 - 1] })
  })

  it('rejects malformed dates and missing users without querying', async () => {
    await expect(listCompletionHistory('user-1', '10/01/2026')).rejects.toThrow('Invalid start date')
    await expect(listCompletionHistory('user-1', '2026-10-01', 'tomorrow')).rejects.toThrow('Invalid end date')
    await expect(listCompletionHistory('', '2026-10-01')).rejects.toThrow()
    expect(fromMock).not.toHaveBeenCalled()
  })
})

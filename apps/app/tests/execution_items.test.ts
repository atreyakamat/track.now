import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ItemType, ItemStatus, ItemPriority, ExecutionItem } from '@/types/domain'
import {
  mapExecutionItemRow,
  listCompletionsForDate,
  toggleHabitTodayCompletion,
  deleteCompletionForDate,
  recordCompletion,
} from '@/services/executionService'
import { supabase } from '@/lib/supabase/client'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  }
})

describe('Execution Items — Domain Types & Database Row Mapping', () => {
  const validTypes: ItemType[] = ['habit', 'task', 'checklist', 'milestone', 'project']
  const validStatuses: ItemStatus[] = ['todo', 'in_progress', 'done', 'archived']
  const validPriorities: ItemPriority[] = ['low', 'medium', 'high', 'urgent']

  it('supports all 5 primary execution item types', () => {
    validTypes.forEach((type) => {
      const item: Partial<ExecutionItem> = {
        id: `item-${type}`,
        plan_id: 'plan-1',
        type,
        name: `Sample ${type}`,
        status: 'todo',
        priority: 'medium',
      }
      expect(validTypes).toContain(item.type)
      expect(item.name).toBeTruthy()
    })
  })

  it('supports all 4 priorities including urgent', () => {
    expect(validPriorities).toEqual(['low', 'medium', 'high', 'urgent'])
  })

  it('maps raw PostgreSQL rows and applies default numeric and schedule fallbacks', () => {
    const rawRow = {
      id: 'item-101',
      plan_id: 'plan-1',
      track_id: 'track-1',
      user_id: 'user-1',
      name: 'Morning Cold Plunge',
      description: null,
      type: 'habit',
      status: 'todo',
      priority: 'urgent',
      due_date: null,
      target_count: null, // should default to 1
      current_count: null, // should default to 0
      unit: null,
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
      track_now_item_schedules: [
        {
          id: 'sched-1',
          item_id: 'item-101',
          frequency: 'daily',
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          time_of_day: 'morning',
          reminder_time: null,
          created_at: '2026-10-08T00:00:00Z',
          updated_at: '2026-10-08T00:00:00Z',
        },
      ],
    }

    const mapped = mapExecutionItemRow(rawRow)
    expect(mapped.id).toBe('item-101')
    expect(mapped.priority).toBe('urgent')
    expect(mapped.target_count).toBe(1)
    expect(mapped.current_count).toBe(0)
    expect(mapped.unit).toBeNull()
    expect(mapped.schedule).toBeDefined()
    expect(mapped.schedule?.frequency).toBe('daily')
    expect(mapped.schedule?.time_of_day).toBe('morning')
  })

  it('maps numeric target values and handles single object schedules', () => {
    const rawRow = {
      id: 'item-102',
      plan_id: 'plan-1',
      track_id: null,
      user_id: 'user-1',
      name: 'Hydration',
      type: 'habit',
      status: 'in_progress',
      priority: 'high',
      target_count: 8,
      current_count: 5,
      unit: 'glasses',
      schedule: {
        id: 'sched-2',
        item_id: 'item-102',
        frequency: 'daily',
        days_of_week: null,
        time_of_day: 'anytime',
        reminder_time: null,
      },
    }

    const mapped = mapExecutionItemRow(rawRow)
    expect(mapped.target_count).toBe(8)
    expect(mapped.current_count).toBe(5)
    expect(mapped.unit).toBe('glasses')
    expect(mapped.schedule?.frequency).toBe('daily')
  })
})

describe('Completion Service Operations & Habit Daily Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listCompletionsForDate queries database and extracts item IDs for the specified date', async () => {
    const mockEqDate = vi.fn().mockResolvedValue({
      data: [{ item_id: 'item-1' }, { item_id: 'item-2' }],
      error: null,
    })
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqDate })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser })

    ;(supabase.from as any).mockReturnValue({
      select: mockSelect,
    })

    const results = await listCompletionsForDate('user-test-1', '2026-10-08')

    expect(supabase.from).toHaveBeenCalledWith('track_now_item_completions')
    expect(mockSelect).toHaveBeenCalledWith('item_id')
    expect(mockEqUser).toHaveBeenCalledWith('user_id', 'user-test-1')
    expect(mockEqDate).toHaveBeenCalledWith('completed_date', '2026-10-08')
    expect(results).toEqual(['item-1', 'item-2'])
  })

  it('toggleHabitTodayCompletion removes completion when habit is already completed today', async () => {
    const mockEqDate = vi.fn().mockResolvedValue({ error: null })
    const mockEqItem = vi.fn().mockReturnValue({ eq: mockEqDate })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqItem })

    ;(supabase.from as any).mockReturnValue({
      delete: mockDelete,
    })

    const result = await toggleHabitTodayCompletion('user-1', 'item-101', true, '2026-10-08')

    expect(result).toBe(false)
    expect(supabase.from).toHaveBeenCalledWith('track_now_item_completions')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEqItem).toHaveBeenCalledWith('item_id', 'item-101')
    expect(mockEqDate).toHaveBeenCalledWith('completed_date', '2026-10-08')
  })

  it('toggleHabitTodayCompletion records completion when habit was not completed today', async () => {
    // 1. Mock item existence check
    const mockItemMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'item-101' },
      error: null,
    })
    const mockItemEq = vi.fn().mockReturnValue({ maybeSingle: mockItemMaybeSingle })
    const mockItemSelect = vi.fn().mockReturnValue({ eq: mockItemEq })

    // 2. Mock existing completion check (returns null so insert proceeds)
    const mockCompMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })
    const mockCompEqDate = vi.fn().mockReturnValue({ maybeSingle: mockCompMaybeSingle })
    const mockCompEqItem = vi.fn().mockReturnValue({ eq: mockCompEqDate })
    const mockCompSelect = vi.fn().mockReturnValue({ eq: mockCompEqItem })

    // 3. Mock insert completion
    const mockInsert = vi.fn().mockResolvedValue({ error: null })

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'track_now_execution_items') {
        return { select: mockItemSelect }
      }
      if (table === 'track_now_item_completions') {
        return {
          select: mockCompSelect,
          insert: mockInsert,
        }
      }
      return {}
    })

    const result = await toggleHabitTodayCompletion('user-1', 'item-101', false, '2026-10-08')

    expect(result).toBe(true)
    expect(supabase.from).toHaveBeenCalledWith('track_now_execution_items')
    expect(supabase.from).toHaveBeenCalledWith('track_now_item_completions')
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      item_id: 'item-101',
      completed_date: '2026-10-08',
      notes: null,
    })
  })

  it('deleteCompletionForDate deletes by item_id and calendar date', async () => {
    const mockEqDate = vi.fn().mockResolvedValue({ error: null })
    const mockEqItem = vi.fn().mockReturnValue({ eq: mockEqDate })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqItem })

    ;(supabase.from as any).mockReturnValue({
      delete: mockDelete,
    })

    await deleteCompletionForDate('item-abc', '2026-10-08')

    expect(supabase.from).toHaveBeenCalledWith('track_now_item_completions')
    expect(mockEqItem).toHaveBeenCalledWith('item_id', 'item-abc')
    expect(mockEqDate).toHaveBeenCalledWith('completed_date', '2026-10-08')
  })
})

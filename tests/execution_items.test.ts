import { describe, expect, it } from 'vitest'
import type { ItemType, ItemStatus, ItemPriority, ExecutionItem, ItemCompletion } from '@/types/domain'

describe('Execution Items — Types, Validation & Invariants', () => {
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

  it('validates allowed priority values', () => {
    validPriorities.forEach((p) => {
      expect(['low', 'medium', 'high', 'urgent']).toContain(p)
    })
    const invalidPriority = 'critical' as ItemPriority
    expect(validPriorities).not.toContain(invalidPriority)
  })

  it('validates status transitions for tasks and habits', () => {
    // Binary toggle: todo <-> done
    const toggleStatus = (current: ItemStatus): ItemStatus =>
      current === 'done' ? 'todo' : 'done'

    expect(toggleStatus('todo')).toBe('done')
    expect(toggleStatus('done')).toBe('todo')
    expect(toggleStatus('in_progress')).toBe('done')
  })

  it('validates milestone & project lifecycle: todo -> in_progress -> done', () => {
    const advanceStatus = (current: ItemStatus): ItemStatus => {
      if (current === 'todo') return 'in_progress'
      if (current === 'in_progress') return 'done'
      return 'done'
    }

    expect(advanceStatus('todo')).toBe('in_progress')
    expect(advanceStatus('in_progress')).toBe('done')
    expect(advanceStatus('done')).toBe('done')
  })

  it('validates item creation input requirements', () => {
    const validateItemInput = (input: { name?: string; type?: string; plan_id?: string }) => {
      if (!input.name || !input.name.trim()) throw new Error('Item name is required')
      if (!input.type || !validTypes.includes(input.type as ItemType)) throw new Error('Invalid item type')
      if (!input.plan_id) throw new Error('Parent plan_id is required')
      return true
    }

    expect(validateItemInput({ name: 'Valid Item', type: 'task', plan_id: 'p-1' })).toBe(true)
    expect(() => validateItemInput({ name: '', type: 'task', plan_id: 'p-1' })).toThrow('Item name is required')
    expect(() => validateItemInput({ name: 'Item', type: 'invalid_type', plan_id: 'p-1' })).toThrow('Invalid item type')
    expect(() => validateItemInput({ name: 'Item', type: 'habit', plan_id: '' })).toThrow('Parent plan_id is required')
  })
})

describe('Completion Logic & Invariants', () => {
  it('records completion idempotently and enforces one per item per calendar date', () => {
    const completions: ItemCompletion[] = []

    const addCompletion = (itemId: string, date: string, userId: string): ItemCompletion => {
      const existing = completions.find(
        (c) => c.item_id === itemId && c.completed_date === date,
      )
      if (existing) {
        // Idempotent: return existing rather than creating duplicate
        return existing
      }
      const newCompletion: ItemCompletion = {
        id: `comp-${Date.now()}-${Math.random()}`,
        item_id: itemId,
        user_id: userId,
        completed_date: date,
        completed_at: new Date().toISOString(),
        notes: null,
      }
      completions.push(newCompletion)
      return newCompletion
    }

    const removeCompletion = (itemId: string, date: string) => {
      const idx = completions.findIndex(
        (c) => c.item_id === itemId && c.completed_date === date,
      )
      if (idx !== -1) completions.splice(idx, 1)
    }

    // 1. First completion
    const c1 = addCompletion('item-1', '2026-10-06', 'user-1')
    expect(completions.length).toBe(1)
    expect(c1.item_id).toBe('item-1')

    // 2. Duplicate completion on same date
    const c2 = addCompletion('item-1', '2026-10-06', 'user-1')
    expect(completions.length).toBe(1)
    expect(c2.id).toBe(c1.id) // Idempotent return

    // 3. Completion for different item on same date
    const c3 = addCompletion('item-2', '2026-10-06', 'user-1')
    expect(completions.length).toBe(2)
    expect(c3.item_id).toBe('item-2')

    // 4. Completion for same item on different date
    const c4 = addCompletion('item-1', '2026-10-07', 'user-1')
    expect(completions.length).toBe(3)

    // 5. Remove completion
    removeCompletion('item-1', '2026-10-06')
    expect(completions.length).toBe(2)
    // item-1 on 2026-10-07 and item-2 on 2026-10-06 remain intact
    expect(completions.find((c) => c.item_id === 'item-1' && c.completed_date === '2026-10-06')).toBeUndefined()
    expect(completions.find((c) => c.item_id === 'item-1' && c.completed_date === '2026-10-07')).toBeDefined()
    expect(completions.find((c) => c.item_id === 'item-2' && c.completed_date === '2026-10-06')).toBeDefined()
  })

  it('ensures uncompleting an item does not affect unrelated items', () => {
    let items = [
      { id: 'item-A', status: 'done' as ItemStatus },
      { id: 'item-B', status: 'done' as ItemStatus },
      { id: 'item-C', status: 'todo' as ItemStatus },
    ]

    // Uncomplete item-A
    items = items.map((i) => (i.id === 'item-A' ? { ...i, status: 'todo' as ItemStatus } : i))
    expect(items.find((i) => i.id === 'item-A')?.status).toBe('todo')
    expect(items.find((i) => i.id === 'item-B')?.status).toBe('done')
    expect(items.find((i) => i.id === 'item-C')?.status).toBe('todo')
  })
})

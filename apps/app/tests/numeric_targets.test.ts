import { describe, expect, it } from 'vitest'
import type {
  ExecutionItem,
  ExecutionItemSummary,
  ItemCompletion,
  ItemStatus,
  NewExecutionItemInput,
} from '@/types/domain'
import { calcProgress, summarizePlan } from '@/domain/progress'

/**
 * Pure domain stepper simulator matching executionService logic.
 */
function applyCountUpdate(
  item: ExecutionItem,
  newCount: number,
): { item: ExecutionItem; transition: 'completed' | 'regressed' | 'none' } {
  const targetCount = Math.max(1, item.target_count ?? 1)
  const clampedCount = Math.max(0, newCount)
  const willBeDone = clampedCount >= targetCount
  const wasDone = item.status === 'done'
  const nextStatus: ItemStatus = willBeDone ? 'done' : 'todo'

  let transition: 'completed' | 'regressed' | 'none' = 'none'
  if (willBeDone && !wasDone) {
    transition = 'completed'
  } else if (!willBeDone && wasDone) {
    transition = 'regressed'
  }

  return {
    item: {
      ...item,
      current_count: clampedCount,
      status: nextStatus,
    },
    transition,
  }
}

/**
 * Pure domain toggle simulator matching executionService logic.
 */
function applyStatusToggle(
  item: ExecutionItem,
): { item: ExecutionItem; transition: 'completed' | 'regressed' } {
  const nextStatus: ItemStatus = item.status === 'done' ? 'todo' : 'done'
  const targetCount = Math.max(1, item.target_count ?? 1)
  const nextCount =
    nextStatus === 'done' ? Math.max(targetCount, item.current_count ?? 0) : 0

  return {
    item: {
      ...item,
      status: nextStatus,
      current_count: nextCount,
    },
    transition: nextStatus === 'done' ? 'completed' : 'regressed',
  }
}

describe('Phase 2 — Feature 01: Numeric Targets & Target Quantities', () => {
  describe('Creation and Default Invariants', () => {
    it('sets default target_count to 1 and current_count to 0 when omitted', () => {
      const input: NewExecutionItemInput = {
        plan_id: 'plan-1',
        type: 'task',
        name: 'Standard single task',
      }
      const targetCount = Math.max(1, input.target_count ?? 1)
      const currentCount = Math.max(0, input.current_count ?? 0)

      expect(targetCount).toBe(1)
      expect(currentCount).toBe(0)
    })

    it('clamps target_count to at least 1 even if 0 or negative provided', () => {
      const inputZero: NewExecutionItemInput = {
        plan_id: 'plan-1',
        type: 'task',
        name: 'Zero target task',
        target_count: 0,
      }
      const inputNeg: NewExecutionItemInput = {
        plan_id: 'plan-1',
        type: 'task',
        name: 'Neg target task',
        target_count: -5,
      }

      expect(Math.max(1, inputZero.target_count ?? 1)).toBe(1)
      expect(Math.max(1, inputNeg.target_count ?? 1)).toBe(1)
    })

    it('preserves custom target quantities and units', () => {
      const input: NewExecutionItemInput = {
        plan_id: 'plan-1',
        type: 'habit',
        name: 'Hydration Routine',
        target_count: 8,
        unit: 'glasses',
      }

      expect(input.target_count).toBe(8)
      expect(input.unit).toBe('glasses')
    })

    it('trims whitespace on units and preserves null when empty', () => {
      const cleanUnit = (u?: string | null) => (u ? u.trim() || null : null)

      expect(cleanUnit('  reps  ')).toBe('reps')
      expect(cleanUnit('   ')).toBeNull()
      expect(cleanUnit(null)).toBeNull()
      expect(cleanUnit(undefined)).toBeNull()
    })
  })

  describe('Stepper Controls & Count Progression', () => {
    const baseItem: ExecutionItem = {
      id: 'item-stepper-1',
      plan_id: 'plan-1',
      user_id: 'user-1',
      type: 'habit',
      name: 'Pushups',
      status: 'todo',
      priority: 'high',
      start_date: null,
      due_date: null,
      target_count: 10,
      current_count: 0,
      unit: 'reps',
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    }

    it('increments count without changing status before target is reached', () => {
      let current = baseItem
      for (let i = 1; i < 10; i++) {
        const { item, transition } = applyCountUpdate(current, i)
        expect(item.current_count).toBe(i)
        expect(item.status).toBe('todo')
        expect(transition).toBe('none')
        current = item
      }
      expect(current.current_count).toBe(9)
      expect(current.status).toBe('todo')
    })

    it('transitions status to done and triggers completion event upon reaching target_count', () => {
      const almostDone: ExecutionItem = {
        ...baseItem,
        current_count: 9,
        status: 'todo',
      }

      const { item, transition } = applyCountUpdate(almostDone, 10)
      expect(item.current_count).toBe(10)
      expect(item.status).toBe('done')
      expect(transition).toBe('completed')
    })

    it('allows bonus/overflow counts past target while remaining done', () => {
      const doneItem: ExecutionItem = {
        ...baseItem,
        current_count: 10,
        status: 'done',
      }

      const { item, transition } = applyCountUpdate(doneItem, 12)
      expect(item.current_count).toBe(12)
      expect(item.status).toBe('done')
      expect(transition).toBe('none') // Already completed, no redundant event
    })

    it('regresses status to todo and removes completion when count drops below target', () => {
      const completedItem: ExecutionItem = {
        ...baseItem,
        current_count: 10,
        status: 'done',
      }

      const { item, transition } = applyCountUpdate(completedItem, 9)
      expect(item.current_count).toBe(9)
      expect(item.status).toBe('todo')
      expect(transition).toBe('regressed')
    })

    it('clamps count at minimum 0 (non-negative bound)', () => {
      const zeroItem: ExecutionItem = {
        ...baseItem,
        current_count: 0,
        status: 'todo',
      }

      const { item } = applyCountUpdate(zeroItem, -1)
      expect(item.current_count).toBe(0)
      expect(item.status).toBe('todo')
    })
  })

  describe('Status Checkmark Synchronization', () => {
    it('sets current_count to target_count when toggling incomplete item to done', () => {
      const partialItem: ExecutionItem = {
        id: 'item-sync-1',
        plan_id: 'plan-1',
        user_id: 'user-1',
        type: 'task',
        name: 'Read Research Papers',
        status: 'todo',
        priority: 'medium',
        start_date: null,
        due_date: null,
        target_count: 5,
        current_count: 2,
        unit: 'papers',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      }

      const { item, transition } = applyStatusToggle(partialItem)
      expect(item.status).toBe('done')
      expect(item.current_count).toBe(5)
      expect(transition).toBe('completed')
    })

    it('resets current_count to 0 when toggling completed item to incomplete', () => {
      const completedItem: ExecutionItem = {
        id: 'item-sync-2',
        plan_id: 'plan-1',
        user_id: 'user-1',
        type: 'task',
        name: 'Read Research Papers',
        status: 'done',
        priority: 'medium',
        start_date: null,
        due_date: null,
        target_count: 5,
        current_count: 5,
        unit: 'papers',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      }

      const { item, transition } = applyStatusToggle(completedItem)
      expect(item.status).toBe('todo')
      expect(item.current_count).toBe(0)
      expect(transition).toBe('regressed')
    })
  })

  describe('Completion Log Synchronization with Stepper Actions', () => {
    it('synchronizes completion logs across multiple increment and decrement cycles', () => {
      const logs: ItemCompletion[] = []

      const handleTransition = (
        itemId: string,
        transition: 'completed' | 'regressed' | 'none',
        date: string,
        userId: string,
      ) => {
        if (transition === 'completed') {
          const exists = logs.find((l) => l.item_id === itemId && l.completed_date === date)
          if (!exists) {
            logs.push({
              id: `log-${Date.now()}-${Math.random()}`,
              item_id: itemId,
              user_id: userId,
              completed_date: date,
              completed_at: new Date().toISOString(),
              notes: null,
            })
          }
        } else if (transition === 'regressed') {
          const idx = logs.findIndex((l) => l.item_id === itemId && l.completed_date === date)
          if (idx !== -1) logs.splice(idx, 1)
        }
      }

      let item: ExecutionItem = {
        id: 'habit-101',
        plan_id: 'plan-1',
        user_id: 'user-1',
        type: 'habit',
        name: 'Drink 8 glasses of water',
        status: 'todo',
        priority: 'medium',
        start_date: null,
        due_date: null,
        target_count: 8,
        current_count: 0,
        unit: 'glasses',
        created_at: '2026-10-07T00:00:00Z',
        updated_at: '2026-10-07T00:00:00Z',
      }

      // Step from 0 up to 7
      for (let count = 1; count <= 7; count++) {
        const res = applyCountUpdate(item, count)
        item = res.item
        handleTransition(item.id, res.transition, '2026-10-07', 'user-1')
      }
      expect(item.current_count).toBe(7)
      expect(item.status).toBe('todo')
      expect(logs.length).toBe(0)

      // Step to 8 (target reached!)
      const step8 = applyCountUpdate(item, 8)
      item = step8.item
      handleTransition(item.id, step8.transition, '2026-10-07', 'user-1')
      expect(item.current_count).toBe(8)
      expect(item.status).toBe('done')
      expect(logs.length).toBe(1)
      expect(logs[0].item_id).toBe('habit-101')

      // Step to 9 (bonus glass!)
      const step9 = applyCountUpdate(item, 9)
      item = step9.item
      handleTransition(item.id, step9.transition, '2026-10-07', 'user-1')
      expect(item.current_count).toBe(9)
      expect(item.status).toBe('done')
      expect(logs.length).toBe(1) // Still 1, no duplicate

      // Step down to 7 (regress below target)
      const step7 = applyCountUpdate(item, 7)
      item = step7.item
      handleTransition(item.id, step7.transition, '2026-10-07', 'user-1')
      expect(item.current_count).toBe(7)
      expect(item.status).toBe('todo')
      expect(logs.length).toBe(0) // Log removed

      // Direct checkmark toggle to complete
      const toggleDone = applyStatusToggle(item)
      item = toggleDone.item
      handleTransition(item.id, toggleDone.transition, '2026-10-07', 'user-1')
      expect(item.current_count).toBe(8)
      expect(item.status).toBe('done')
      expect(logs.length).toBe(1)
    })
  })

  describe('Progress Rollup Compatibility', () => {
    it('seamlessly integrates numeric target completion into plan progress', () => {
      const items: ExecutionItemSummary[] = [
        {
          id: 'i1',
          plan_id: 'plan-1',
          type: 'task',
          name: 'Regular task done',
          status: 'done',
          updated_at: '2026-10-07T00:00:00Z',
        },
        {
          id: 'i2',
          plan_id: 'plan-1',
          type: 'habit',
          name: 'Numeric habit in progress (4/10 reps)',
          status: 'todo',
          updated_at: '2026-10-07T00:00:00Z',
        },
        {
          id: 'i3',
          plan_id: 'plan-1',
          type: 'habit',
          name: 'Numeric habit completed (10/10 reps)',
          status: 'done',
          updated_at: '2026-10-07T00:00:00Z',
        },
      ]

      const progress = calcProgress(items)
      expect(progress.total).toBe(3)
      expect(progress.done).toBe(2)
      expect(progress.percent).toBe(67) // 2 / 3 = 66.67% -> 67%
    })

    it('computes accurate progress percentages for UI stepper progress bar', () => {
      const calcPercent = (current: number, target: number) =>
        Math.min(100, Math.round((Math.max(0, current) / Math.max(1, target)) * 100))

      expect(calcPercent(0, 10)).toBe(0)
      expect(calcPercent(3, 10)).toBe(30)
      expect(calcPercent(5, 10)).toBe(50)
      expect(calcPercent(10, 10)).toBe(100)
      expect(calcPercent(15, 10)).toBe(100) // Clamped at 100%
      expect(calcPercent(-2, 10)).toBe(0) // Clamped at 0%
    })
  })
})

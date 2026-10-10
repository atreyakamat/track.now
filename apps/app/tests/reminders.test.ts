import { beforeEach, describe, expect, it } from 'vitest'
import {
  calculateReminderTime,
  cancelReminderForItem,
  checkDueReminders,
  clearRemindersForUser,
  getReminderForItem,
  loadUserReminders,
  setReminderForItem,
  snoozeReminder,
} from '../src/services/reminderService'
import type { ExecutionItem } from '../src/types/domain'

if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

describe('Smart Reminder Engine - calculateReminderTime', () => {
  const baseTime = new Date('2026-10-10T08:00:00.000Z')

  it('returns null for "none" preset', () => {
    expect(calculateReminderTime('none', null, undefined, baseTime)).toBeNull()
  })

  it('calculates 10m preset accurately', () => {
    const res = calculateReminderTime('10m', null, undefined, baseTime)
    expect(res).toBe(new Date('2026-10-10T08:10:00.000Z').toISOString())
  })

  it('calculates 30m preset accurately', () => {
    const res = calculateReminderTime('30m', null, undefined, baseTime)
    expect(res).toBe(new Date('2026-10-10T08:30:00.000Z').toISOString())
  })

  it('calculates 1h preset accurately', () => {
    const res = calculateReminderTime('1h', null, undefined, baseTime)
    expect(res).toBe(new Date('2026-10-10T09:00:00.000Z').toISOString())
  })

  it('calculates 2h preset accurately', () => {
    const res = calculateReminderTime('2h', null, undefined, baseTime)
    expect(res).toBe(new Date('2026-10-10T10:00:00.000Z').toISOString())
  })

  it('calculates exact_time preset with custom ISO', () => {
    const custom = '2026-10-12T14:30:00.000Z'
    expect(calculateReminderTime('exact_time', null, custom, baseTime)).toBe(custom)
    expect(calculateReminderTime('exact_time', null, 'invalid-date', baseTime)).toBeNull()
    expect(calculateReminderTime('exact_time', null, undefined, baseTime)).toBeNull()
  })

  it('calculates scheduled_time preset with habit schedule reminder_time', () => {
    const item: Partial<ExecutionItem> = {
      schedule: {
        id: 's1',
        item_id: 'i1',
        frequency: 'daily',
        days_of_week: null,
        time_of_day: 'morning',
        reminder_time: '11:15',
        created_at: '',
      },
    }
    const res = calculateReminderTime('scheduled_time', item, undefined, baseTime)
    expect(res).not.toBeNull()
    const parsed = new Date(res!)
    expect(parsed.getHours()).toBe(11)
    expect(parsed.getMinutes()).toBe(15)
  })

  it('calculates scheduled_time preset with time_of_day morning fallback', () => {
    const item: Partial<ExecutionItem> = {
      schedule: {
        id: 's1',
        item_id: 'i1',
        frequency: 'daily',
        days_of_week: null,
        time_of_day: 'morning',
        reminder_time: null,
        created_at: '',
      },
    }
    const res = calculateReminderTime('scheduled_time', item, undefined, baseTime)
    expect(res).not.toBeNull()
    const parsed = new Date(res!)
    expect(parsed.getHours()).toBe(8)
    expect(parsed.getMinutes()).toBe(30)
  })

  it('calculates scheduled_time with task due_date fallback', () => {
    const item: Partial<ExecutionItem> = {
      due_date: '2026-10-15',
    }
    const res = calculateReminderTime('scheduled_time', item, undefined, baseTime)
    expect(res).not.toBeNull()
    const parsed = new Date(res!)
    expect(parsed.getDate()).toBe(15)
    expect(parsed.getHours()).toBe(9)
  })
})

describe('Smart Reminder Storage & Lifecycle', () => {
  const userId = 'user-test-uuid'
  const mockItem: ExecutionItem = {
    id: 'item-101',
    user_id: userId,
    plan_id: 'plan-1',
    type: 'task',
    name: 'Deploy security audit',
    status: 'todo',
    priority: 'high',
    start_date: null,
    due_date: '2026-10-10',
    target_count: 1,
    current_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  beforeEach(() => {
    localStorage.clear()
  })

  it('sets and retrieves a reminder', () => {
    const reminder = setReminderForItem(userId, mockItem, '10m')
    expect(reminder).not.toBeNull()
    expect(reminder?.itemId).toBe('item-101')
    expect(reminder?.status).toBe('upcoming')

    const retrieved = getReminderForItem(userId, 'item-101')
    expect(retrieved).not.toBeNull()
    expect(retrieved?.id).toBe(reminder?.id)
  })

  it('clears previous reminder if preset is none', () => {
    setReminderForItem(userId, mockItem, '10m')
    expect(getReminderForItem(userId, 'item-101')).not.toBeNull()

    const cleared = setReminderForItem(userId, mockItem, 'none')
    expect(cleared).toBeNull()
    expect(getReminderForItem(userId, 'item-101')).toBeNull()
  })

  it('cancels an active reminder when item is completed or deleted', () => {
    setReminderForItem(userId, mockItem, '10m')
    expect(getReminderForItem(userId, 'item-101')).not.toBeNull()

    cancelReminderForItem(userId, 'item-101')
    expect(getReminderForItem(userId, 'item-101')).toBeNull()

    const all = loadUserReminders(userId)
    const cancelled = all.find((r) => r.itemId === 'item-101')
    expect(cancelled?.status).toBe('cancelled')
  })

  it('snoozes a reminder for a given duration', () => {
    const rem = setReminderForItem(userId, mockItem, '10m')
    expect(rem).not.toBeNull()

    const snoozed = snoozeReminder(userId, rem!.id, 15)
    expect(snoozed).not.toBeNull()
    expect(snoozed?.status).toBe('snoozed')
    expect(snoozed?.snoozedUntil).toBeDefined()

    const retrieved = getReminderForItem(userId, 'item-101')
    expect(retrieved?.status).toBe('snoozed')
  })

  it('checks due reminders and applies flood cap of 3', () => {
    const base = new Date('2026-10-10T12:00:00.000Z')

    // Create 5 overdue reminders
    for (let i = 1; i <= 5; i++) {
      const item: ExecutionItem = {
        ...mockItem,
        id: `item-${i}`,
        name: `Task ${i}`,
      }
      setReminderForItem(userId, item, 'exact_time', '2026-10-10T11:00:00.000Z')
    }

    const due = checkDueReminders(userId, base)
    // Flood cap prevents delivering more than 3 at once
    expect(due.length).toBe(3)
    due.forEach((r) => {
      expect(r.status).toBe('delivered')
      expect(r.deliveredAt).toBeDefined()
    })

    // After delivery, no more upcoming reminders remain
    const remaining = checkDueReminders(userId, base)
    expect(remaining.length).toBe(0)
  })

  it('wipes all user reminders upon sign-out', () => {
    setReminderForItem(userId, mockItem, '10m')
    expect(loadUserReminders(userId).length).toBe(1)

    clearRemindersForUser(userId)
    expect(loadUserReminders(userId).length).toBe(0)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import {
  advanceHabitReminderToNextOccurrence,
  calculateReminderTime,
  cancelReminderForItem,
  cancelRemindersForPlan,
  checkDueReminders,
  clearRemindersForUser,
  formatReminderLabel,
  getItemTargetTime,
  getReminderForItem,
  loadUserReminders,
  rescheduleReminderForItem,
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

describe('Smart Reminder Engine - calculateReminderTime & presets', () => {
  const baseTime = new Date('2026-10-10T08:00:00.000Z')

  it('returns null for "none" preset', () => {
    expect(calculateReminderTime('none', null, undefined, baseTime)).toBeNull()
  })

  it('calculates countdown presets relative to current time (now + delta)', () => {
    expect(calculateReminderTime('10m_in', null, undefined, baseTime)).toBe(
      new Date('2026-10-10T08:10:00.000Z').toISOString(),
    )
    expect(calculateReminderTime('30m_in', null, undefined, baseTime)).toBe(
      new Date('2026-10-10T08:30:00.000Z').toISOString(),
    )
    expect(calculateReminderTime('1h_in', null, undefined, baseTime)).toBe(
      new Date('2026-10-10T09:00:00.000Z').toISOString(),
    )
    expect(calculateReminderTime('2h_in', null, undefined, baseTime)).toBe(
      new Date('2026-10-10T10:00:00.000Z').toISOString(),
    )
  })

  it('clearly distinguishes "in 2 hours" from "2 hours before due time"', () => {
    const itemWithDue: Partial<ExecutionItem> = {
      type: 'task',
      due_date: '2026-10-10',
      schedule: {
        id: 's-due',
        item_id: 'i-due',
        frequency: 'daily',
        days_of_week: null,
        time_of_day: 'evening',
        reminder_time: '19:00',
        created_at: '',
      },
    }

    // baseTime is 08:00
    // "in 2 hours" -> 10:00
    const in2Hours = calculateReminderTime('2h_in', itemWithDue, undefined, baseTime)
    expect(in2Hours).toBe(new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString())

    // "2 hours before due time" (19:00 - 2h) -> 17:00
    const twoHoursBefore = calculateReminderTime('2h_before', itemWithDue, undefined, baseTime)
    expect(twoHoursBefore).not.toBeNull()
    const parsedTwoHoursBefore = new Date(twoHoursBefore!)
    expect(parsedTwoHoursBefore.getHours()).toBe(17)
    expect(parsedTwoHoursBefore.getMinutes()).toBe(0)

    expect(new Date(in2Hours!).getTime()).not.toBe(parsedTwoHoursBefore.getTime())
  })

  it('calculates 10m_before, 30m_before, and 1h_before relative to scheduled/due time', () => {
    const item: Partial<ExecutionItem> = {
      type: 'task',
      due_date: '2026-10-10',
      schedule: {
        id: 's1',
        item_id: 'i1',
        frequency: 'daily',
        days_of_week: null,
        time_of_day: 'afternoon',
        reminder_time: '14:00',
        created_at: '',
      },
    }

    const res10m = calculateReminderTime('10m_before', item, undefined, baseTime)
    expect(res10m).not.toBeNull()
    const parsed10m = new Date(res10m!)
    expect(parsed10m.getHours()).toBe(13)
    expect(parsed10m.getMinutes()).toBe(50)

    const res30m = calculateReminderTime('30m_before', item, undefined, baseTime)
    expect(res30m).not.toBeNull()
    const parsed30m = new Date(res30m!)
    expect(parsed30m.getHours()).toBe(13)
    expect(parsed30m.getMinutes()).toBe(30)

    const res1h = calculateReminderTime('1h_before', item, undefined, baseTime)
    expect(res1h).not.toBeNull()
    const parsed1h = new Date(res1h!)
    expect(parsed1h.getHours()).toBe(13)
    expect(parsed1h.getMinutes()).toBe(0)
  })

  it('calculates legacy presets (10m, 30m, 1h, 2h) accurately for backwards compatibility', () => {
    expect(calculateReminderTime('10m', null, undefined, baseTime)).toBe(
      new Date('2026-10-10T08:10:00.000Z').toISOString(),
    )
    expect(calculateReminderTime('30m', null, undefined, baseTime)).toBe(
      new Date('2026-10-10T08:30:00.000Z').toISOString(),
    )
    expect(calculateReminderTime('1h', null, undefined, baseTime)).toBe(
      new Date('2026-10-10T09:00:00.000Z').toISOString(),
    )
    expect(calculateReminderTime('2h', null, undefined, baseTime)).toBe(
      new Date('2026-10-10T10:00:00.000Z').toISOString(),
    )
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

  it('resolves target time for all execution item types (checklist, milestone, project)', () => {
    const checklist: Partial<ExecutionItem> = { type: 'checklist', due_date: '2026-10-12' }
    const milestone: Partial<ExecutionItem> = { type: 'milestone', due_date: '2026-10-14' }
    const project: Partial<ExecutionItem> = { type: 'project', due_date: '2026-10-20' }

    expect(getItemTargetTime(checklist, baseTime)?.getDate()).toBe(12)
    expect(getItemTargetTime(milestone, baseTime)?.getDate()).toBe(14)
    expect(getItemTargetTime(project, baseTime)?.getDate()).toBe(20)

    expect(calculateReminderTime('1h_before', checklist, undefined, baseTime)).not.toBeNull()
    expect(calculateReminderTime('1h_before', milestone, undefined, baseTime)).not.toBeNull()
    expect(calculateReminderTime('1h_before', project, undefined, baseTime)).not.toBeNull()
  })
})

describe('Smart Reminder Storage, Lifecycle & Consistency', () => {
  const userId = 'user-test-uuid'
  const mockItem: ExecutionItem = {
    id: 'item-101',
    user_id: userId,
    plan_id: 'plan-1',
    track_id: 'track-1',
    type: 'task',
    name: 'Deploy security audit',
    description: null,
    status: 'todo',
    priority: 'high',
    start_date: null,
    due_date: '2026-10-15',
    target_count: 1,
    current_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  beforeEach(() => {
    localStorage.clear()
  })

  it('sets and retrieves a reminder', () => {
    const reminder = setReminderForItem(userId, mockItem, '1h_in')
    expect(reminder).not.toBeNull()
    expect(reminder?.itemId).toBe('item-101')
    expect(reminder?.status).toBe('upcoming')

    const retrieved = getReminderForItem(userId, 'item-101')
    expect(retrieved).not.toBeNull()
    expect(retrieved?.id).toBe(reminder?.id)
  })

  it('clears previous reminder if preset is none', () => {
    setReminderForItem(userId, mockItem, '1h_in')
    expect(getReminderForItem(userId, 'item-101')).not.toBeNull()

    const cleared = setReminderForItem(userId, mockItem, 'none')
    expect(cleared).toBeNull()
    expect(getReminderForItem(userId, 'item-101')).toBeNull()
  })

  it('cancels an active reminder when item is completed or deleted', () => {
    setReminderForItem(userId, mockItem, '30m_in')
    expect(getReminderForItem(userId, 'item-101')).not.toBeNull()

    cancelReminderForItem(userId, 'item-101')
    expect(getReminderForItem(userId, 'item-101')).toBeNull()

    const all = loadUserReminders(userId)
    const cancelled = all.find((r) => r.itemId === 'item-101')
    expect(cancelled?.status).toBe('cancelled')
  })

  it('cancels all reminders for a plan when the plan is archived', () => {
    const item1: ExecutionItem = { ...mockItem, id: 'it-1', plan_id: 'target-plan' }
    const item2: ExecutionItem = { ...mockItem, id: 'it-2', plan_id: 'target-plan' }
    const itemOther: ExecutionItem = { ...mockItem, id: 'it-3', plan_id: 'other-plan' }

    setReminderForItem(userId, item1, '1h_in')
    setReminderForItem(userId, item2, '2h_in')
    setReminderForItem(userId, itemOther, '30m_in')

    expect(getReminderForItem(userId, 'it-1')).not.toBeNull()
    expect(getReminderForItem(userId, 'it-2')).not.toBeNull()
    expect(getReminderForItem(userId, 'it-3')).not.toBeNull()

    cancelRemindersForPlan(userId, 'target-plan')

    expect(getReminderForItem(userId, 'it-1')).toBeNull()
    expect(getReminderForItem(userId, 'it-2')).toBeNull()
    expect(getReminderForItem(userId, 'it-3')).not.toBeNull()
  })

  it('recalculates reminder when item is rescheduled', () => {
    const base = new Date('2026-10-10T08:00:00.000Z')
    const item: ExecutionItem = {
      ...mockItem,
      due_date: '2026-10-12',
    }
    setReminderForItem(userId, item, '1h_before', undefined, base)
    const original = getReminderForItem(userId, item.id)
    expect(original).not.toBeNull()
    expect(new Date(original!.remindAt).getDate()).toBe(12)

    // Reschedule item to Oct 16
    const rescheduledItem: ExecutionItem = {
      ...item,
      due_date: '2026-10-16',
    }
    const updated = rescheduleReminderForItem(userId, rescheduledItem, base)
    expect(updated).not.toBeNull()
    expect(new Date(updated!.remindAt).getDate()).toBe(16)
  })

  it('snoozes a reminder for a given duration (+10m, +60m)', () => {
    const rem = setReminderForItem(userId, mockItem, '10m_in')
    expect(rem).not.toBeNull()

    const snoozed10 = snoozeReminder(userId, rem!.id, 10)
    expect(snoozed10).not.toBeNull()
    expect(snoozed10?.status).toBe('snoozed')
    expect(snoozed10?.snoozedUntil).toBeDefined()

    const snoozed60 = snoozeReminder(userId, rem!.id, 60)
    expect(snoozed60?.status).toBe('snoozed')
  })

  it('advances habit reminder to next occurrence when completed today', () => {
    const habitItem: ExecutionItem = {
      ...mockItem,
      id: 'habit-1',
      type: 'habit',
      due_date: null,
      schedule: {
        id: 'hs1',
        item_id: 'habit-1',
        frequency: 'daily',
        days_of_week: null,
        time_of_day: 'morning',
        reminder_time: '09:00',
        created_at: '',
      },
    }

    const baseToday = new Date('2026-10-10T07:00:00.000Z')
    setReminderForItem(userId, habitItem, 'scheduled_time', undefined, baseToday)
    const initial = getReminderForItem(userId, habitItem.id)
    expect(initial).not.toBeNull()

    const advanced = advanceHabitReminderToNextOccurrence(userId, habitItem, baseToday)
    expect(advanced).not.toBeNull()
    expect(new Date(advanced!.remindAt).getDate()).toBe(11) // advanced to Oct 11
  })

  it('formats reminder labels accurately', () => {
    const now = new Date('2026-10-10T12:00:00.000Z')
    const remToday = {
      id: 'r1',
      itemId: 'i1',
      userId,
      itemName: 'Task',
      planId: 'p1',
      preset: '10m_in' as const,
      remindAt: new Date('2026-10-10T12:10:00.000Z').toISOString(),
      status: 'upcoming' as const,
      createdAt: '',
      updatedAt: '',
    }
    const remTomorrow = {
      ...remToday,
      remindAt: new Date('2026-10-11T09:00:00.000Z').toISOString(),
    }
    const remSnoozed = {
      ...remToday,
      status: 'snoozed' as const,
      snoozedUntil: new Date('2026-10-10T12:20:00.000Z').toISOString(),
    }

    expect(formatReminderLabel(remToday, now)).toContain('Today')
    expect(formatReminderLabel(remTomorrow, now)).toContain('Tomorrow')
    expect(formatReminderLabel(remSnoozed, now)).toContain('Snoozed')
  })

  it('checks due reminders and applies flood cap of 3', () => {
    const base = new Date('2026-10-10T12:00:00.000Z')

    // Create 5 overdue reminders
    for (let i = 1; i <= 5; i++) {
      const item: ExecutionItem = {
        ...mockItem,
        id: `item-${i}`,
        name: `Task ${i}`,
        description: null,
      }
      // Scheduled at 10:00Z for 11:00Z, then swept at 12:00Z.
      setReminderForItem(userId, item, 'exact_time', '2026-10-10T11:00:00.000Z', new Date('2026-10-10T10:00:00.000Z'))
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
    setReminderForItem(userId, mockItem, '1h_in')
    expect(loadUserReminders(userId).length).toBe(1)

    clearRemindersForUser(userId)
    expect(loadUserReminders(userId).length).toBe(0)
  })
})


import { beforeEach, describe, expect, it } from 'vitest'
import {
  advanceHabitReminderToNextOccurrence,
  calculateReminderTime,
  cancelRemindersForTrack,
  collectDueReminders,
  getRemindersKey,
  getReminderForItem,
  loadUserReminders,
  previewReminder,
  pruneReminders,
  reconcileRemindersWithActiveItems,
  saveUserReminders,
  setReminderForItem,
  snoozeReminder,
  toLocalDateTimeInputValue,
} from '../src/services/reminderService'
import type { ExecutionItem } from '../src/types/domain'
import type { ItemReminder } from '../src/types/notifications'

if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {}
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
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
  } as Storage
}

const userId = 'user-a'
// Local-time fixed clock: Monday 2026-10-12 08:00 local.
const now = new Date(2026, 9, 12, 8, 0, 0, 0)

const task: ExecutionItem = {
  id: 'task-1',
  user_id: userId,
  plan_id: 'plan-1',
  track_id: 'track-1',
  type: 'task',
  name: 'Write report',
  description: null,
  status: 'todo',
  priority: 'medium',
  due_date: '2026-10-14',
  target_count: 1,
  current_count: 0,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
}

const habit: ExecutionItem = {
  ...task,
  id: 'habit-1',
  type: 'habit',
  name: 'Stretch',
  due_date: null,
  schedule: {
    id: 's1',
    item_id: 'habit-1',
    frequency: 'daily',
    days_of_week: null,
    time_of_day: 'morning',
    reminder_time: '09:00',
    created_at: '',
  },
}

beforeEach(() => {
  localStorage.clear()
})

describe('stale and corrupted storage', () => {
  it('treats corrupted JSON and non-array payloads as empty instead of crashing', () => {
    localStorage.setItem(getRemindersKey(userId), '{not json')
    expect(loadUserReminders(userId)).toEqual([])
    localStorage.setItem(getRemindersKey(userId), JSON.stringify({ foo: 1 }))
    expect(loadUserReminders(userId)).toEqual([])
    expect(getReminderForItem(userId, 'task-1')).toBeNull()
  })

  it('drops malformed entries and entries belonging to another user', () => {
    const valid = setReminderForItem(userId, task, '1h_in', undefined, now)!
    const raw = JSON.parse(localStorage.getItem(getRemindersKey(userId))!)
    raw.push({ id: 'x' }, { ...valid, id: 'foreign', userId: 'user-b' }, { ...valid, id: 'bad-date', remindAt: 'nope' })
    localStorage.setItem(getRemindersKey(userId), JSON.stringify(raw))
    expect(loadUserReminders(userId).map((r) => r.id)).toEqual([valid.id])
  })

  it('prunes delivered/cancelled history older than 30 days but keeps active reminders', () => {
    const old = new Date(now.getTime() - 40 * 24 * 3600 * 1000).toISOString()
    const base = setReminderForItem(userId, task, '1h_in', undefined, now)!
    const list: ItemReminder[] = [
      base,
      { ...base, id: 'old-delivered', status: 'delivered', updatedAt: old },
      { ...base, id: 'recent-cancelled', status: 'cancelled', updatedAt: now.toISOString() },
    ]
    expect(pruneReminders(list, now).map((r) => r.id)).toEqual([base.id, 'recent-cancelled'])
  })

  it('keeps reminders for different users isolated', () => {
    setReminderForItem(userId, task, '1h_in', undefined, now)
    expect(loadUserReminders('user-b')).toEqual([])
  })
})

describe('validation: no silently dropped or instantly-firing reminders', () => {
  it('rejects a "before due" reminder when the item has no due date or schedule', () => {
    const noDue = { ...task, due_date: null }
    expect(calculateReminderTime('1h_before', noDue, undefined, now)).toBeNull()
    expect(previewReminder('1h_before', noDue, undefined, now).error).toMatch(/Set a due date/)
    expect(() => setReminderForItem(userId, noDue, '1h_before', undefined, now)).toThrow(/Set a due date/)
  })

  it('rejects reminders that resolve to the past (overdue task, past custom time)', () => {
    const overdue = { ...task, due_date: '2026-10-01' }
    expect(previewReminder('scheduled_time', overdue, undefined, now).error).toMatch(/already passed/)
    expect(previewReminder('exact_time', task, '2026-10-11T10:00', now).error).toMatch(/already passed/)
    expect(previewReminder('exact_time', task, '', now).error).toMatch(/Choose a date and time/)
  })

  it('accepts a future custom local time and stores the correct instant', () => {
    const rem = setReminderForItem(userId, task, 'exact_time', '2026-10-12T18:30', now)!
    expect(new Date(rem.remindAt).getHours()).toBe(18)
    expect(new Date(rem.remindAt).getMinutes()).toBe(30)
    // Round trip through the edit modal input must not shift by the UTC offset.
    expect(toLocalDateTimeInputValue(rem.remindAt)).toBe('2026-10-12T18:30')
  })

  it('distinguishes "in 2 hours" (from now) and "2 hours before" (from due time) for every item type', () => {
    for (const type of ['task', 'checklist', 'milestone', 'project'] as const) {
      const item = { ...task, type, id: `i-${type}` }
      const inTwo = new Date(calculateReminderTime('2h_in', item, undefined, now)!)
      const beforeTwo = new Date(calculateReminderTime('2h_before', item, undefined, now)!)
      expect(inTwo.getTime() - now.getTime()).toBe(2 * 3600 * 1000)
      expect(beforeTwo.getDate()).toBe(14)
      expect(beforeTwo.getHours()).toBe(7) // 09:00 default due time minus 2h
    }
    const habitBefore = new Date(calculateReminderTime('30m_before', habit, undefined, now)!)
    expect(habitBefore.getHours()).toBe(8)
    expect(habitBefore.getMinutes()).toBe(30)
  })
})

describe('snooze semantics', () => {
  it('delays a not-yet-fired reminder from its scheduled time rather than pulling it forward', () => {
    const rem = setReminderForItem(userId, task, '2h_in', undefined, now)! // fires at 10:00
    const snoozed = snoozeReminder(userId, rem.id, 10, now)!
    expect(new Date(snoozed.remindAt).getTime()).toBe(now.getTime() + 130 * 60 * 1000)
  })

  it('pushes an already-due reminder to now + minutes', () => {
    const rem = setReminderForItem(userId, task, '10m_in', undefined, now)!
    const later = new Date(now.getTime() + 60 * 60 * 1000)
    const snoozed = snoozeReminder(userId, rem.id, 10, later)!
    expect(new Date(snoozed.remindAt).getTime()).toBe(later.getTime() + 10 * 60 * 1000)
    expect(snoozed.status).toBe('snoozed')
  })
})

describe('delivery sweep: exactly once, flood cap with digest', () => {
  it('delivers the most recent 3 and reports the rest as overflow (never silently lost)', () => {
    for (let i = 1; i <= 5; i++) {
      setReminderForItem(userId, { ...task, id: `t-${i}`, name: `Task ${i}` }, 'exact_time', `2026-10-12T0${i}:00`, new Date(2026, 9, 12, 0, 0))
    }
    const sweep = collectDueReminders(userId, now)
    expect(sweep.deliver.map((r) => r.itemName)).toEqual(['Task 3', 'Task 4', 'Task 5'])
    expect(sweep.overflow.map((r) => r.itemName)).toEqual(['Task 1', 'Task 2'])
    // Exactly once: a second sweep (another tab, focus catch-up) finds nothing.
    expect(collectDueReminders(userId, now)).toEqual({ deliver: [], overflow: [] })
  })

  it('does not deliver future reminders', () => {
    setReminderForItem(userId, task, '1h_in', undefined, now)
    expect(collectDueReminders(userId, now).deliver).toHaveLength(0)
  })
})

describe('recurrence and cleanup', () => {
  it('moves a habit reminder to the next scheduled day after completion or delivery', () => {
    setReminderForItem(userId, habit, 'scheduled_time', undefined, now) // today 09:00
    const next = advanceHabitReminderToNextOccurrence(userId, habit, now)!
    const at = new Date(next.remindAt)
    expect(at.getDate()).toBe(13)
    expect(at.getHours()).toBe(9)
    expect(getReminderForItem(userId, habit.id)?.id).toBe(next.id)
  })

  it('respects custom habit days when advancing (Mon/Wed/Fri)', () => {
    const mwf = { ...habit, schedule: { ...habit.schedule!, frequency: 'custom' as const, days_of_week: [1, 3, 5] } }
    setReminderForItem(userId, mwf, 'scheduled_time', undefined, now)
    const next = advanceHabitReminderToNextOccurrence(userId, mwf, now)!
    expect(new Date(next.remindAt).getDay()).toBe(3) // Wednesday
  })

  it('cancels reminders for an archived/deleted track (by track id or plan id)', () => {
    setReminderForItem(userId, task, '1h_in', undefined, now)
    setReminderForItem(userId, { ...task, id: 'other', track_id: 'track-2', plan_id: 'plan-9' }, '1h_in', undefined, now)
    cancelRemindersForTrack(userId, 'track-1')
    expect(getReminderForItem(userId, 'task-1')).toBeNull()
    expect(getReminderForItem(userId, 'other')).not.toBeNull()
  })

  it('reconciles stale reminders whose items are no longer active', () => {
    setReminderForItem(userId, task, '1h_in', undefined, now)
    setReminderForItem(userId, { ...task, id: 'gone' }, '1h_in', undefined, now)
    expect(reconcileRemindersWithActiveItems(userId, ['task-1'])).toBe(1)
    expect(getReminderForItem(userId, 'gone')).toBeNull()
    expect(getReminderForItem(userId, 'task-1')).not.toBeNull()
  })

  it('reports storage failures instead of pretending the reminder was saved', () => {
    const original = localStorage.setItem
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    try {
      expect(saveUserReminders(userId, [])).toBe(false)
      expect(() => setReminderForItem(userId, task, '1h_in', undefined, now)).toThrow(/could not be saved/)
    } finally {
      localStorage.setItem = original
    }
  })
})

describe('recurring habit reminders survive delivery', () => {
  it('re-arms a delivered daily habit reminder for the next day', async () => {
    const { rescheduleRecurringAfterDelivery } = await import('../src/services/reminderService')
    setReminderForItem(userId, habit, 'scheduled_time', undefined, now) // 09:00 today
    const at0905 = new Date(2026, 9, 12, 9, 5)
    const sweep = collectDueReminders(userId, at0905)
    expect(sweep.deliver).toHaveLength(1)
    const rearmed = rescheduleRecurringAfterDelivery(userId, sweep.deliver, at0905)
    expect(rearmed).toHaveLength(1)
    const active = getReminderForItem(userId, habit.id)!
    expect(new Date(active.remindAt).getDate()).toBe(13)
    expect(active.status).toBe('upcoming')
  })

  it('does not re-arm one-off task reminders', async () => {
    const { rescheduleRecurringAfterDelivery } = await import('../src/services/reminderService')
    setReminderForItem(userId, task, '10m_in', undefined, now)
    const sweep = collectDueReminders(userId, new Date(now.getTime() + 11 * 60 * 1000))
    expect(rescheduleRecurringAfterDelivery(userId, sweep.deliver, now)).toHaveLength(0)
    expect(getReminderForItem(userId, task.id)).toBeNull()
  })
})

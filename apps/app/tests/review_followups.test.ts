import { describe, expect, it, vi } from 'vitest'
import {
  cancelReminderForItem,
  getReminderForItem,
  loadUserReminders,
  markReminderDelivered,
  saveUserReminders,
  setReminderForItem,
  settleRemindersAfterCompletion,
  snoozeReminder,
} from '@/services/reminderService'
import { doneTodayAfterEdit } from '@/hooks/useExecutionItemActions'
import { getTodayDateString } from '@/domain/dates'
import type { ExecutionItem } from '@/types/domain'

/**
 * Regressions found by the independent review of this change set:
 *  #1 a removed habit reminder must not come back when the habit is completed;
 *  #2 Snooze on a still-visible toast must not revive a completed/deleted item's reminder;
 *  #3 a rename must not mark a habit "done today" from an earlier day's count;
 *  #5 completing a habit cancels its countdown / custom-time reminder.
 */
vi.mock('@/features/notifications/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {}
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
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

const userId = 'user-followup'
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m, 0, 0)

const habit = (extra: Partial<ExecutionItem> = {}): ExecutionItem => ({
  id: 'h-1',
  plan_id: 'p-1',
  user_id: userId,
  type: 'habit',
  name: 'Stretch',
  description: null,
  status: 'todo',
  priority: 'medium',
  due_date: null,
  target_count: 1,
  current_count: 0,
  schedule: {
    id: 's',
    item_id: 'h-1',
    frequency: 'daily',
    days_of_week: null,
    time_of_day: 'anytime',
    reminder_time: '19:00',
    created_at: '',
  },
  created_at: '2026-10-01T08:00:00.000Z',
  updated_at: '2026-10-01T08:00:00.000Z',
  ...extra,
})

function reset() {
  localStorage.clear()
  saveUserReminders(userId, [])
}

describe('#1 removed habit reminders stay removed', () => {
  it('completing the habit after removing its reminder does not re-create one from delivered history', () => {
    reset()
    const rem = setReminderForItem(userId, habit(), 'scheduled_time', undefined, at(12, 9))!
    markReminderDelivered(userId, rem.id, at(12, 19, 1)) // fired yesterday
    cancelReminderForItem(userId, 'h-1') // user removes the reminder today
    expect(getReminderForItem(userId, 'h-1')).toBeNull()
    settleRemindersAfterCompletion(userId, habit(), at(13, 10)) // user completes the habit
    expect(getReminderForItem(userId, 'h-1')).toBeNull()
  })

  it('an active schedule reminder still moves to the next occurrence on completion', () => {
    reset()
    setReminderForItem(userId, habit(), 'scheduled_time', undefined, at(13, 9))
    settleRemindersAfterCompletion(userId, habit(), at(13, 10))
    const next = getReminderForItem(userId, 'h-1')
    expect(next).not.toBeNull()
    expect(new Date(next!.remindAt).getDate()).toBe(14)
  })
})

describe('#2 snooze cannot revive reminders of finished work', () => {
  it('a delivered reminder is retired when its item is completed/deleted, so Snooze returns null', () => {
    reset()
    const task = habit({ id: 't-1', type: 'task', schedule: null, due_date: '2026-10-13' })
    const rem = setReminderForItem(userId, task, '10m_in', undefined, at(13, 10))!
    markReminderDelivered(userId, rem.id, at(13, 10, 11))
    cancelReminderForItem(userId, 't-1')
    expect(loadUserReminders(userId).find((r) => r.id === rem.id)?.status).toBe('dismissed')
    expect(snoozeReminder(userId, rem.id, 10, at(13, 10, 12))).toBeNull()
  })
})

describe('#5 completion cancels non-recurring habit reminders', () => {
  it('an "in 1 hour" reminder on a habit does not fire after the habit is completed', () => {
    reset()
    setReminderForItem(userId, habit(), '1h_in', undefined, at(13, 9))
    settleRemindersAfterCompletion(userId, habit(), at(13, 9, 30))
    expect(getReminderForItem(userId, 'h-1')).toBeNull()
  })
})

describe('#3 a rename does not mark a habit done today', () => {
  const stale = habit({ current_count: 1, count_date: '2000-01-01', status: 'done' })

  it('rename-only edits keep the previous "done today" state', () => {
    expect(doneTodayAfterEdit({ name: 'Stretch more' }, stale, { ...stale, name: 'Stretch more' }, false)).toBe(false)
    expect(doneTodayAfterEdit({ name: 'x' }, stale, stale, true)).toBe(true)
  })

  it("progress edits use today's effective count", () => {
    expect(doneTodayAfterEdit({ target_count: 1 }, stale, stale, false)).toBe(false)
    expect(doneTodayAfterEdit({ current_count: 1 }, stale, { ...stale, count_date: getTodayDateString() }, false)).toBe(true)
  })
})

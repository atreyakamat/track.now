import { readFileSync } from 'fs'
import { resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  advanceHabitReminderToNextOccurrence,
  collectDueReminders,
  endOfLocalDay,
  formatReminderLabel,
  getItemTargetTime,
  getReminderForItem,
  getRemindersKey,
  isReminderTimingUnchanged,
  isValidReminder,
  loadUserReminders,
  previewReminder,
  reconcileRemindersWithSnapshot,
  rescheduleRecurringAfterDelivery,
  saveUserReminders,
  setReminderForItem,
  snoozeReminder,
  cancelReminderForItem,
} from '../src/services/reminderService'
import {
  reconcileRemindersFromServer,
  resolveDeliveryMode,
  runReminderSweep,
  startNotificationMonitor,
  updateVisibilityHeartbeat,
  withReminderLock,
} from '../src/services/webNotificationEngine'
import {
  buildHabitScheduleInput,
  needsActiveDays,
  resolveCreateReminderChoice,
} from '../src/components/execution/ItemFormParts'
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

const userId = 'user-r'
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m, 0, 0) // October 2026, local time
// 2026-10-11 is a Sunday, 2026-10-12 a Monday, 2026-10-13 a Tuesday.

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

const habitAt = (time: string, id = 'habit-1'): ExecutionItem => ({
  ...task,
  id,
  type: 'habit',
  name: `Habit ${time}`,
  due_date: null,
  schedule: {
    id: `s-${id}`,
    item_id: id,
    frequency: 'daily',
    days_of_week: null,
    time_of_day: 'anytime',
    reminder_time: time,
    created_at: '',
  },
})

beforeEach(() => {
  localStorage.clear()
})

describe('H1: recurring "before" reminders never re-arm into the past', () => {
  it('a 00:30 habit with "1 hour before" re-arms for tomorrow 23:30, not today 23:30 (already past)', () => {
    const habit = habitAt('00:30')
    setReminderForItem(userId, habit, '1h_before', undefined, at(11, 20)) // Sun 23:30 for Mon 00:30
    const deliveredAt = at(11, 23, 31)
    const sweep = collectDueReminders(userId, deliveredAt)
    expect(sweep.deliver).toHaveLength(1)

    rescheduleRecurringAfterDelivery(userId, sweep.deliver, deliveredAt)
    const next = getReminderForItem(userId, habit.id)!
    expect(new Date(next.remindAt).getTime()).toBe(at(12, 23, 30).getTime())
    expect(new Date(next.remindAt).getTime()).toBeGreaterThan(deliveredAt.getTime())

    // The next 20 s sweep must not deliver it again.
    expect(collectDueReminders(userId, at(11, 23, 32))).toEqual({ deliver: [], overflow: [] })
  })

  it('completing that habit after midnight moves the reminder to the following night', () => {
    const habit = habitAt('00:30')
    setReminderForItem(userId, habit, '1h_before', undefined, at(11, 20))
    const next = advanceHabitReminderToNextOccurrence(userId, habit, at(12, 0, 40))!
    expect(new Date(next.remindAt).getTime()).toBe(at(12, 23, 30).getTime())
  })

  it('creating a "1 hour before" reminder shortly after midnight targets tonight, not an instant in the past', () => {
    const preview = previewReminder('1h_before', habitAt('00:30'), undefined, at(12, 0, 10))
    expect(preview.error).toBeNull()
    expect(new Date(preview.remindAt!).getTime()).toBe(at(12, 23, 30).getTime())
  })
})

describe("L1: catch-up re-arm keeps today's later occurrence", () => {
  it("a 19:00 daily habit delivered on reopen Tuesday 09:00 re-arms for Tuesday 19:00", () => {
    const habit = habitAt('19:00')
    setReminderForItem(userId, habit, 'scheduled_time', undefined, at(12, 10)) // Mon 19:00
    const reopen = at(13, 9)
    const sweep = collectDueReminders(userId, reopen)
    expect(sweep.deliver).toHaveLength(1)
    rescheduleRecurringAfterDelivery(userId, sweep.deliver, reopen)
    expect(new Date(getReminderForItem(userId, habit.id)!.remindAt).getTime()).toBe(at(13, 19).getTime())
  })

  it('but skips today when the habit was completed today', () => {
    const habit = habitAt('19:00')
    setReminderForItem(userId, habit, 'scheduled_time', undefined, at(13, 8)) // Tue 19:00
    const next = advanceHabitReminderToNextOccurrence(userId, habit, at(13, 9))!
    expect(new Date(next.remindAt).getTime()).toBe(at(14, 19).getTime())
  })

  it('a snoozed recurring reminder re-arms after its original occurrence', () => {
    const habit = habitAt('09:00')
    const rem = setReminderForItem(userId, habit, 'scheduled_time', undefined, at(12, 8))!
    snoozeReminder(userId, rem.id, 10, at(12, 9)) // 09:10
    const sweep = collectDueReminders(userId, at(12, 9, 11))
    rescheduleRecurringAfterDelivery(userId, sweep.deliver, at(12, 9, 11))
    expect(new Date(getReminderForItem(userId, habit.id)!.remindAt).getTime()).toBe(at(13, 9).getTime())
  })
})

describe('M1: snooze never revives retired reminders', () => {
  it('returns null for cancelled and dismissed reminders and leaves them untouched', () => {
    const rem = setReminderForItem(userId, task, '1h_in', undefined, at(12, 8))!
    cancelReminderForItem(userId, task.id)
    expect(snoozeReminder(userId, rem.id, 10, at(12, 8, 5))).toBeNull()
    expect(loadUserReminders(userId)[0].status).toBe('cancelled')
    expect(getReminderForItem(userId, task.id)).toBeNull()

    const dismissed: ItemReminder = { ...rem, id: 'dismissed-1', status: 'dismissed' }
    saveUserReminders(userId, [dismissed])
    expect(snoozeReminder(userId, 'dismissed-1', 10, at(12, 8, 5))).toBeNull()
    expect(loadUserReminders(userId)[0].status).toBe('dismissed')
  })

  it('still snoozes a delivered reminder (the toast action) and never moves an upcoming one earlier', () => {
    setReminderForItem(userId, task, '10m_in', undefined, at(12, 8))
    const [delivered] = collectDueReminders(userId, at(12, 8, 11)).deliver
    const snoozed = snoozeReminder(userId, delivered.id, 10, at(12, 8, 12))!
    expect(snoozed.status).toBe('snoozed')
    expect(new Date(snoozed.remindAt).getTime()).toBe(at(12, 8, 22).getTime())

    const upcoming = setReminderForItem(userId, { ...task, id: 't2' }, '2h_in', undefined, at(12, 8))!
    const later = snoozeReminder(userId, upcoming.id, 10, at(12, 8))!
    expect(new Date(later.remindAt).getTime()).toBe(at(12, 10, 10).getTime())
  })
})

describe('M2: habits ignore due_date', () => {
  it('uses the schedule, not a stray due date, for a habit target', () => {
    const habit = { ...habitAt('09:00'), due_date: '2026-10-20' }
    expect(getItemTargetTime(habit, at(12, 8))!.getTime()).toBe(at(12, 9).getTime())
    // Non-habits still use their due date.
    expect(getItemTargetTime({ ...task, schedule: habit.schedule }, at(12, 8))!.getDate()).toBe(14)
  })
})

describe('L3: validation and resilient delivery', () => {
  const base = (): ItemReminder => ({
    id: 'r1',
    itemId: 'i1',
    userId,
    itemName: 'X',
    planId: 'plan-1',
    preset: 'scheduled_time',
    remindAt: at(12, 9).toISOString(),
    status: 'upcoming',
    createdAt: '',
    updatedAt: '',
  })

  it('rejects malformed optional fields', () => {
    expect(isValidReminder(base(), userId)).toBe(true)
    expect(isValidReminder({ ...base(), scheduleSnapshot: { frequency: 'daily', reminder_time: 'abc' } })).toBe(false)
    expect(isValidReminder({ ...base(), scheduleSnapshot: { frequency: 'daily', reminder_time: 900 } })).toBe(false)
    expect(isValidReminder({ ...base(), scheduleSnapshot: { frequency: 'hourly' } })).toBe(false)
    expect(isValidReminder({ ...base(), scheduleSnapshot: { frequency: 'custom', days_of_week: 'mon' } })).toBe(false)
    expect(isValidReminder({ ...base(), scheduleSnapshot: 'daily' })).toBe(false)
    expect(isValidReminder({ ...base(), planId: 42 })).toBe(false)
    expect(isValidReminder({ ...base(), planId: '../../evil' })).toBe(false)
    expect(isValidReminder({ ...base(), updatedAt: 5 })).toBe(false)
    expect(isValidReminder({ ...base(), snoozedUntil: 'never' })).toBe(false)
    expect(
      isValidReminder({ ...base(), scheduleSnapshot: { frequency: 'daily', days_of_week: null, time_of_day: null, reminder_time: '07:45:00' } }),
    ).toBe(true)
  })

  it('one malformed record does not stop other recurring reminders from re-arming', () => {
    setReminderForItem(userId, habitAt('08:00', 'h-other'), 'scheduled_time', undefined, at(12, 7))
    setReminderForItem(userId, habitAt('09:00', 'h-good'), 'scheduled_time', undefined, at(12, 7))
    const delivered = collectDueReminders(userId, at(12, 9, 1)).deliver
    const other = delivered.find((r) => r.itemId === 'h-other')!
    const good = delivered.find((r) => r.itemId === 'h-good')!
    // An in-memory record with a corrupted schedule (would throw while computing the next time).
    const bad = { ...other, scheduleSnapshot: { frequency: 'daily', reminder_time: 900 } } as unknown as ItemReminder
    let rearmed: ItemReminder[] = []
    expect(() => {
      rearmed = rescheduleRecurringAfterDelivery(userId, [bad, good], at(12, 9, 1))
    }).not.toThrow()
    expect(rearmed.map((r) => r.itemId)).toEqual(['h-good'])
  })

  it('shows every claimed reminder in-app synchronously, before any system notification await', async () => {
    for (let i = 1; i <= 3; i++) {
      setReminderForItem(userId, { ...task, id: `t-${i}`, name: `T${i}` }, 'exact_time', `2026-10-12T0${i}:00`, at(12, 0))
    }
    const shown: string[] = []
    let stopped = false
    const pending = new Promise<boolean>(() => undefined) // a system notification that never resolves
    const notify = vi.fn(() => {
      stopped = true // the monitor is stopped while the first notification is in flight
      return pending
    })
    void runReminderSweep(userId, {
      mode: 'inapp',
      allowBrowser: true,
      now: at(12, 8),
      isStopped: () => stopped,
      onReminder: (r) => shown.push(r.itemName),
      notify,
    })
    await vi.waitFor(() => expect(notify).toHaveBeenCalled())
    expect(shown).toEqual(['T1', 'T2', 'T3'])
  })

  it('a throwing in-app callback does not drop the remaining reminders', async () => {
    setReminderForItem(userId, { ...task, id: 'a', name: 'A' }, 'exact_time', '2026-10-12T07:00', at(12, 0))
    setReminderForItem(userId, { ...task, id: 'b', name: 'B' }, 'exact_time', '2026-10-12T07:30', at(12, 0))
    const shown: string[] = []
    await runReminderSweep(userId, {
      mode: 'inapp',
      allowBrowser: false,
      now: at(12, 8),
      onReminder: (r) => {
        shown.push(r.itemName)
        if (r.itemName === 'A') throw new Error('render failed')
      },
    })
    expect(shown).toEqual(['A', 'B'])
  })
})

describe('L4: catch-up age limit', () => {
  it('summarises reminders overdue by more than 24h instead of firing them individually', () => {
    setReminderForItem(userId, { ...task, id: 'old', name: 'Old' }, 'exact_time', '2026-10-09T10:00', at(9, 8))
    setReminderForItem(userId, { ...task, id: 'new', name: 'New' }, 'exact_time', '2026-10-12T07:00', at(12, 0))
    const sweep = collectDueReminders(userId, at(12, 8))
    expect(sweep.deliver.map((r) => r.itemName)).toEqual(['New'])
    expect(sweep.overflow.map((r) => r.itemName)).toEqual(['Old'])
  })

  it('many stale reminders become one digest, never a flood', async () => {
    for (let i = 0; i < 10; i++) {
      setReminderForItem(userId, { ...task, id: `s-${i}`, name: `S${i}` }, '10m_in', undefined, at(5, 8, i))
    }
    const shown: string[] = []
    const digests: string[] = []
    await runReminderSweep(userId, {
      mode: 'inapp',
      allowBrowser: false,
      now: at(12, 8),
      onReminder: (r) => shown.push(r.itemName),
      onDigest: (d) => digests.push(d.title),
    })
    expect(shown).toEqual([])
    expect(digests).toEqual(['10 earlier reminders while you were away'])
  })
})

describe('L9: snoozed labels include the date when not today', () => {
  const rem: ItemReminder = {
    id: 'r',
    itemId: 'i',
    userId,
    itemName: 'X',
    planId: 'p',
    preset: '10m_in',
    remindAt: at(14, 9).toISOString(),
    status: 'snoozed',
    snoozedUntil: at(14, 9).toISOString(),
    createdAt: '',
    updatedAt: '',
  }
  it('shows the day for a snooze days away, and Tomorrow for tomorrow', () => {
    const monthDay = at(14, 9).toLocaleDateString([], { month: 'short', day: 'numeric' })
    expect(formatReminderLabel(rem, at(12, 8))).toContain(monthDay)
    expect(formatReminderLabel({ ...rem, snoozedUntil: at(13, 9).toISOString() }, at(12, 8))).toContain('Tomorrow')
    expect(formatReminderLabel({ ...rem, snoozedUntil: at(12, 9).toISOString() }, at(12, 8))).not.toContain('Tomorrow')
  })
})

describe('M3: engine reconciles with server state', () => {
  it('cancels reminders for missing, archived and done items and advances habits done today', () => {
    setReminderForItem(userId, { ...task, id: 'gone' }, '1h_in', undefined, at(13, 8))
    setReminderForItem(userId, { ...task, id: 'archived' }, '1h_in', undefined, at(13, 8))
    setReminderForItem(userId, { ...task, id: 'done' }, '1h_in', undefined, at(13, 8))
    setReminderForItem(userId, { ...task, id: 'open' }, '1h_in', undefined, at(13, 8))
    const habit = habitAt('19:00')
    setReminderForItem(userId, habit, 'scheduled_time', undefined, at(13, 8))

    const result = reconcileRemindersWithSnapshot(
      userId,
      [
        { ...task, id: 'archived', status: 'archived' },
        { ...task, id: 'done', status: 'done' },
        { ...task, id: 'open' },
        habit,
      ],
      [habit.id, 'done'],
      at(13, 9),
    )
    expect(result).toEqual({ cancelled: 3, advanced: 1 })
    expect(getReminderForItem(userId, 'gone')).toBeNull()
    expect(getReminderForItem(userId, 'archived')).toBeNull()
    expect(getReminderForItem(userId, 'done')).toBeNull()
    expect(getReminderForItem(userId, 'open')).not.toBeNull()
    expect(new Date(getReminderForItem(userId, habit.id)!.remindAt).getTime()).toBe(at(14, 19).getTime())
  })

  it('a habit whose reminder already targets tomorrow is left alone (keeps its snooze)', () => {
    const habit = habitAt('00:30')
    const rem = setReminderForItem(userId, habit, '1h_before', undefined, at(13, 8))! // Tue 23:30 for Wed 00:30
    reconcileRemindersWithSnapshot(userId, [habit], [habit.id], at(13, 9))
    expect(getReminderForItem(userId, habit.id)!.id).toBe(rem.id)
  })

  it('never cancels anything when loading fails or times out', async () => {
    setReminderForItem(userId, task, '1h_in', undefined, at(12, 8))
    expect(await reconcileRemindersFromServer(userId, () => Promise.reject(new Error('offline')))).toBe(false)
    expect(
      await reconcileRemindersFromServer(userId, () => new Promise(() => undefined), { timeoutMs: 5 }),
    ).toBe(false)
    expect(getReminderForItem(userId, task.id)).not.toBeNull()

    expect(await reconcileRemindersFromServer(userId, async () => ({ items: [], completedTodayIds: [] }))).toBe(true)
    expect(getReminderForItem(userId, task.id)).toBeNull()
  })
})

describe('M3 / L2: running monitor', () => {
  let win: EventTarget & { location: { origin: string } }
  let doc: EventTarget & { visibilityState: string }
  let stop: (() => void) | null = null

  beforeEach(() => {
    win = Object.assign(new EventTarget(), { location: { origin: 'https://app.test' } })
    doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    vi.stubGlobal('window', win)
    vi.stubGlobal('document', doc)
  })
  afterEach(() => {
    stop?.()
    stop = null
    vi.unstubAllGlobals()
  })

  const dueTask = () =>
    setReminderForItem(userId, task, 'exact_time', new Date(Date.now() + 60_000).toISOString(), new Date())

  it('cancels a reminder for an item completed elsewhere before the first sweep fires it', async () => {
    const rem = dueTask()!
    // Make it due now.
    saveUserReminders(userId, [{ ...rem, remindAt: new Date(Date.now() - 1000).toISOString() }])
    const onReminder = vi.fn()
    let loaded = false
    stop = startNotificationMonitor(userId, {
      onReminder,
      loadDailySnapshot: async () => {
        loaded = true
        return { items: [{ ...task, status: 'done' }], completedTodayIds: [task.id] }
      },
    })
    await vi.waitFor(() => expect(loaded).toBe(true))
    await new Promise((r) => setTimeout(r, 20))
    expect(onReminder).not.toHaveBeenCalled()
    expect(loadUserReminders(userId)[0].status).toBe('cancelled')
  })

  it('still delivers (and cancels nothing) when the reconciliation load fails', async () => {
    const rem = dueTask()!
    saveUserReminders(userId, [{ ...rem, remindAt: new Date(Date.now() - 1000).toISOString() }])
    const onReminder = vi.fn()
    stop = startNotificationMonitor(userId, {
      onReminder,
      loadDailySnapshot: () => Promise.reject(new Error('network down')),
    })
    await vi.waitFor(() => expect(onReminder).toHaveBeenCalledTimes(1))
  })

  it('re-broadcasts reminder changes from other tabs (storage event) as tracknow:reminders-updated', () => {
    stop = startNotificationMonitor(userId, {})
    const updated = vi.fn()
    win.addEventListener('tracknow:reminders-updated', updated)
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'unrelated' }))
    expect(updated).not.toHaveBeenCalled()
    win.dispatchEvent(Object.assign(new Event('storage'), { key: getRemindersKey(userId) }))
    expect(updated).toHaveBeenCalledTimes(1)
  })
})

describe('L2: one delivery across tabs, toasts only in the visible tab', () => {
  it('chooses the delivery mode from visibility and permission', () => {
    expect(resolveDeliveryMode(userId, { visible: true, allowBrowser: false, tabId: 'A' })).toBe('inapp')
    expect(resolveDeliveryMode(userId, { visible: false, allowBrowser: false, tabId: 'A' })).toBe('skip')
    expect(resolveDeliveryMode(userId, { visible: false, allowBrowser: true, tabId: 'A' })).toBe('system')
    updateVisibilityHeartbeat(userId, true, Date.now(), 'B') // tab B is visible
    expect(resolveDeliveryMode(userId, { visible: false, allowBrowser: true, tabId: 'A' })).toBe('skip')
    updateVisibilityHeartbeat(userId, false, Date.now(), 'B') // tab B hidden again
    expect(resolveDeliveryMode(userId, { visible: false, allowBrowser: true, tabId: 'A' })).toBe('system')
  })

  it('a hidden tab delivers only a system notification, once across tabs', async () => {
    setReminderForItem(userId, task, 'exact_time', '2026-10-12T07:00', at(12, 0))
    const onReminderA = vi.fn()
    const notifyA = vi.fn(async () => true)
    const notifyB = vi.fn(async () => true)
    await runReminderSweep(userId, { mode: 'system', allowBrowser: true, now: at(12, 8), onReminder: onReminderA, notify: notifyA, tabId: 'A' })
    await runReminderSweep(userId, { mode: 'system', allowBrowser: true, now: at(12, 8), notify: notifyB, tabId: 'B' })
    expect(onReminderA).not.toHaveBeenCalled()
    expect(notifyA).toHaveBeenCalledTimes(1)
    expect(notifyB).not.toHaveBeenCalled()
  })

  it('the lock excludes a concurrent sweep (Web Locks and storage fallback)', async () => {
    let inner: unknown = 'not-run'
    await withReminderLock(userId, () => {
      // While held, another request in the same origin is refused instead of waiting.
      void withReminderLock(userId, () => 'second', 'B').then((v) => {
        inner = v
      })
      return 'first'
    }, 'A')
    await vi.waitFor(() => expect(inner).not.toBe('not-run'))
    expect(inner).toBeNull()

    vi.stubGlobal('navigator', {})
    try {
      localStorage.setItem(`tracknow_reminder_lock_${userId}`, JSON.stringify({ owner: 'B', at: Date.now() }))
      expect(await withReminderLock(userId, () => 'mine', 'A')).toBeNull()
      localStorage.setItem(`tracknow_reminder_lock_${userId}`, JSON.stringify({ owner: 'B', at: Date.now() - 60_000 }))
      expect(await withReminderLock(userId, () => 'mine', 'A')).toBe('mine')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('M4: editing keeps an unchanged reminder', () => {
  const overdueTask = { ...task, due_date: '2026-10-10' }

  it('treats an edit that does not touch timing as unchanged (no recompute, snooze kept)', () => {
    const existing: ItemReminder = {
      id: 'r',
      itemId: task.id,
      userId,
      itemName: task.name,
      planId: 'plan-1',
      preset: 'scheduled_time',
      remindAt: at(12, 9).toISOString(),
      status: 'snoozed',
      createdAt: '',
      updatedAt: '',
    }
    const renamed = { ...overdueTask, name: 'Renamed' }
    expect(isReminderTimingUnchanged({ existing, preset: 'scheduled_time', before: overdueTask, after: renamed })).toBe(true)
    // Recomputing would have blocked the save:
    expect(previewReminder('scheduled_time', renamed, undefined, at(12, 8)).error).toMatch(/already passed/)

    expect(
      isReminderTimingUnchanged({ existing, preset: 'scheduled_time', before: overdueTask, after: { ...overdueTask, due_date: '2026-10-20' } }),
    ).toBe(false)
    expect(isReminderTimingUnchanged({ existing, preset: '1h_before', before: overdueTask, after: overdueTask })).toBe(false)

    const habit = habitAt('09:00')
    const habitRem = { ...existing, preset: '30m_before' as const }
    // Form round-trip: '09:00:00' stored vs '09:00' in the input, null vs 'anytime' time of day.
    const stored = { ...habit, schedule: { ...habit.schedule!, reminder_time: '09:00:00', time_of_day: null } }
    const fromForm = { ...habit, schedule: { ...habit.schedule!, reminder_time: '09:00', time_of_day: 'anytime' } }
    expect(isReminderTimingUnchanged({ existing: habitRem, preset: '30m_before', before: stored, after: fromForm })).toBe(true)
    expect(
      isReminderTimingUnchanged({
        existing: habitRem,
        preset: '30m_before',
        before: stored,
        after: { ...fromForm, schedule: { ...fromForm.schedule, reminder_time: '10:00' } },
      }),
    ).toBe(false)
  })

  it('recomputing for a habit completed today starts from tomorrow', () => {
    const habit = habitAt('19:00')
    const rem = setReminderForItem(userId, habit, 'scheduled_time', undefined, at(13, 9), {
      occurrenceAfter: endOfLocalDay(at(13, 9)),
    })!
    expect(new Date(rem.remindAt).getTime()).toBe(at(14, 19).getTime())
  })

  it('EditItemModal uses the unchanged check and the completed-today option', () => {
    const src = readFileSync(resolve(__dirname, '../src/components/execution/EditItemModal.tsx'), 'utf-8')
    expect(src).toContain('isReminderTimingUnchanged(')
    expect(src).toMatch(/completedToday \? \{ occurrenceAfter: endOfLocalDay/)
    // The count prefill/send-only-when-changed behaviour stays intact.
    expect(src).toContain('effectiveCurrentCount(item, completedToday)')
  })
})

describe('EditItemModal: legacy monthly habits are preserved', () => {
  it('keeps frequency monthly and its stored days', () => {
    expect(
      buildHabitScheduleInput({
        frequency: 'monthly',
        daysOfWeek: [1, 2, 3, 4, 5],
        timeOfDay: 'anytime',
        habitTime: '',
        original: { frequency: 'monthly', days_of_week: [3] },
      }),
    ).toEqual({ frequency: 'monthly', days_of_week: [3], time_of_day: 'anytime', reminder_time: null })
    expect(needsActiveDays('monthly')).toBe(false)
    const src = readFileSync(resolve(__dirname, '../src/components/execution/EditItemModal.tsx'), 'utf-8')
    expect(src).not.toMatch(/=== 'monthly' \? 'custom'/)
  })

  it('switching away from monthly uses the chosen days', () => {
    expect(
      buildHabitScheduleInput({
        frequency: 'custom',
        daysOfWeek: [1, 3],
        timeOfDay: 'evening',
        habitTime: '18:00',
        original: { frequency: 'monthly', days_of_week: null },
      }),
    ).toEqual({ frequency: 'custom', days_of_week: [1, 3], time_of_day: 'evening', reminder_time: '18:00' })
  })
})

describe('L11: default reminder preset never blocks creating an undated item', () => {
  it('falls back to no reminder for an untouched default, but validates an explicit choice', () => {
    const preview = previewReminder('1h_before', { type: 'task', due_date: null, schedule: null })
    expect(preview.error).toMatch(/Set a due date/)
    expect(resolveCreateReminderChoice('1h_before', false, preview)).toEqual({
      preset: 'none',
      error: null,
      skippedDefault: true,
    })
    expect(resolveCreateReminderChoice('1h_before', true, preview).error).toMatch(/Set a due date/)
    expect(resolveCreateReminderChoice('1h_in', false, { remindAt: 'x', error: null }).preset).toBe('1h_in')
  })
})

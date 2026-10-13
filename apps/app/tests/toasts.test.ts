import { readFileSync } from 'fs'
import { resolve } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_TRANSIENT_TOASTS,
  appendToast,
  createToastStore,
  type ToastEntry,
  type ToastOptions,
} from '../src/features/notifications/ToastContext'
import { startAppShellSession } from '../src/components/layout/AppShell'
import type { NotificationMonitorHandlers } from '../src/services/webNotificationEngine'
import type { ItemReminder } from '../src/types/notifications'

const entry = (id: string, duration: number): ToastEntry => ({ id, title: id, duration })

afterEach(() => {
  vi.useRealTimers()
})

describe('M5: persistent (duration 0) toasts are never evicted', () => {
  it('caps only transient toasts', () => {
    let list: ToastEntry[] = [entry('reminder', 0)]
    for (let i = 0; i < 8; i++) list = appendToast(list, entry(`t${i}`, 5000))
    expect(list.map((t) => t.id)).toContain('reminder')
    expect(list.filter((t) => t.duration > 0)).toHaveLength(MAX_TRANSIENT_TOASTS)
    expect(list.filter((t) => t.duration > 0).map((t) => t.id)).toEqual(['t3', 't4', 't5', 't6', 't7'])
  })

  it('keeps many persistent reminders through a burst of transient toasts (store level)', () => {
    vi.useFakeTimers()
    const store = createToastStore()
    for (let i = 0; i < 6; i++) store.show({ id: `reminder-${i}`, title: `R${i}`, duration: 0 })
    for (let i = 0; i < 10; i++) store.show({ title: `info ${i}` })
    const ids = store.getSnapshot().map((t) => t.id)
    for (let i = 0; i < 6; i++) expect(ids).toContain(`reminder-${i}`)
    expect(store.getSnapshot().filter((t) => t.duration > 0)).toHaveLength(MAX_TRANSIENT_TOASTS)

    vi.advanceTimersByTime(60_000) // transient toasts expire, persistent ones stay
    expect(store.getSnapshot().map((t) => t.id)).toEqual(ids.filter((id) => id.startsWith('reminder-')))
  })
})

describe('Auth-M4: toasts do not survive sign-out or an account switch', () => {
  it('clearAll removes every toast and cancels pending timers', () => {
    vi.useFakeTimers()
    const store = createToastStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.show({ id: 'reminder-1', title: 'Reminder: Secret item', duration: 0 })
    store.show({ title: 'Saved' })
    store.clearAll()
    expect(store.getSnapshot()).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('the AppShell session cleanup (unmount / user change) stops the monitor and clears toasts', () => {
    const stopMonitor = vi.fn()
    const clearToasts = vi.fn()
    const shown: ToastOptions[] = []
    let handlers: NotificationMonitorHandlers = {}
    const cleanup = startAppShellSession('user-1', {
      showToast: (t) => shown.push(t),
      clearToasts,
      startMonitor: (_uid, h) => {
        handlers = h
        return stopMonitor
      },
      registerWorker: async () => null,
    })

    handlers.onReminder?.({ id: 'r1', itemName: 'Secret item' } as ItemReminder)
    expect(shown[0]).toMatchObject({ id: 'reminder-r1', duration: 0 })

    cleanup()
    expect(stopMonitor).toHaveBeenCalledTimes(1)
    expect(clearToasts).toHaveBeenCalledTimes(1)
  })

  it('AppShell re-runs the session effect per user id and wires clearAll into it', () => {
    const src = readFileSync(resolve(__dirname, '../src/components/layout/AppShell.tsx'), 'utf-8')
    expect(src).toMatch(/startAppShellSession\(user\.id, \{ showToast, clearToasts: clearAll \}\)/)
    expect(src).toMatch(/\[user\?\.id, showToast, clearAll\]/)
  })
})

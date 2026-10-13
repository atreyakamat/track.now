import { beforeEach, describe, expect, it } from 'vitest'
import {
  getNotificationCapabilityStatus,
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '../src/services/notificationPreferences'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../src/types/notifications'

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

describe('Notification Preferences & Capability Status', () => {
  const userId = 'pref-test-user-id'

  beforeEach(() => {
    localStorage.clear()
  })

  it('loads default preferences with explicit opt-in disabled', () => {
    const prefs = loadNotificationPreferences(userId)
    expect(prefs.masterEnabled).toBe(false)
    expect(prefs.completionAcknowledgement).toBe(true)
    expect(prefs.remindersEnabled).toBe(true)
    expect(prefs.defaultPreset).toBe('none')
    expect(prefs.dailySummaryTime).toBe('09:00')
  })

  it('saves and reloads custom preferences accurately', () => {
    const custom = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      masterEnabled: true,
      overdueRemindersEnabled: true,
      defaultPreset: '30m' as const,
      dailySummaryEnabled: true,
      dailySummaryTime: '08:30',
    }

    saveNotificationPreferences(userId, custom)
    const reloaded = loadNotificationPreferences(userId)
    expect(reloaded.masterEnabled).toBe(true)
    expect(reloaded.overdueRemindersEnabled).toBe(true)
    expect(reloaded.defaultPreset).toBe('30m')
    expect(reloaded.dailySummaryEnabled).toBe(true)
    expect(reloaded.dailySummaryTime).toBe('08:30')
  })

  it('evaluates browser notification capabilities honestly', () => {
    const status = getNotificationCapabilityStatus()
    expect(status).toBeDefined()
    expect(typeof status.isSupported).toBe('boolean')
    expect(typeof status.canDeliverForeground).toBe('boolean')
    expect(typeof status.canDeliverBackground).toBe('boolean')
    expect(typeof status.canDeliverAppClosed).toBe('boolean')
    expect(typeof status.explanation).toBe('string')
  })

  it('never claims closed-app delivery and reflects permission honestly', () => {
    const granted = getNotificationCapabilityStatus({ notificationSupported: true, permission: 'granted' })
    expect(granted.canDeliverForeground).toBe(true)
    expect(granted.canDeliverBackground).toBe(true)
    expect(granted.canDeliverAppClosed).toBe(false)
    expect(granted.explanation).toMatch(/browser is closed nothing can fire/)

    const denied = getNotificationCapabilityStatus({ notificationSupported: true, permission: 'denied' })
    expect(denied.canDeliverBackground).toBe(false)
    expect(denied.explanation).toMatch(/blocked/)

    const unsupported = getNotificationCapabilityStatus({ notificationSupported: false })
    expect(unsupported.permission).toBe('unsupported')
    expect(unsupported.canDeliverBackground).toBe(false)
    expect(unsupported.canDeliverAppClosed).toBe(false)
  })

  it('does not claim system notifications are on when the in-app switch is off (L10)', () => {
    const off = getNotificationCapabilityStatus({ notificationSupported: true, permission: 'granted', masterEnabled: false })
    expect(off.explanation).not.toMatch(/System notifications are allowed/)
    expect(off.explanation).toMatch(/switched off in Track\.now/)
    expect(off.explanation).toMatch(/browser is closed nothing can fire/)
    expect(off.canDeliverBackground).toBe(false)
    expect(off.canDeliverAppClosed).toBe(false)

    const on = getNotificationCapabilityStatus({ notificationSupported: true, permission: 'granted', masterEnabled: true })
    expect(on.explanation).toMatch(/System notifications are allowed/)
    expect(on.canDeliverBackground).toBe(true)
  })
})

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
})

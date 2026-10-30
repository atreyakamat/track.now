import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type BrowserNotificationPermission,
  type NotificationCapabilityStatus,
  type NotificationPreferences,
} from '../types/notifications'
import { emitAppEvent } from '../platform/events'
import { getStorage } from '../platform/storage'

const PREFS_STORAGE_PREFIX = 'tracknow_notification_prefs_'

export function getPreferencesKey(userId: string): string {
  return `${PREFS_STORAGE_PREFIX}${userId}`
}

export function loadNotificationPreferences(userId: string): NotificationPreferences {
  const storage = getStorage()
  if (!userId || !storage) return DEFAULT_NOTIFICATION_PREFERENCES
  try {
    const raw = storage.getItem(getPreferencesKey(userId))
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...parsed,
    }
  } catch (err) {
    console.warn('Failed to parse stored notification preferences:', err)
    return DEFAULT_NOTIFICATION_PREFERENCES
  }
}

export function saveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
): NotificationPreferences {
  if (!userId) return prefs
  try {
    getStorage()?.setItem(getPreferencesKey(userId), JSON.stringify(prefs))
    emitAppEvent('tracknow:notification-prefs-changed', { userId, prefs })
  } catch (err) {
    console.error('Failed to save notification preferences:', err)
  }
  return prefs
}

/**
 * Honest description of what this runtime can deliver.
 *
 * - Foreground / background tab: yes, while Track.now is open and permission is granted
 *   (browsers may throttle timers in background tabs; the engine catches up on focus).
 * - Browser or installed PWA fully closed: no. There is no Web Push subscription or sender.
 * - Native shells: no native project/plugin is shipped in this repository, so OS-scheduled
 *   notifications are never claimed.
 */
export function getNotificationCapabilityStatus(
  env: {
    notificationSupported?: boolean
    permission?: BrowserNotificationPermission
    /** The user's "System notifications" switch. Callers should always pass it. */
    masterEnabled?: boolean
  } = {},
): NotificationCapabilityStatus {
  const browserNotification = (globalThis as { Notification?: { permission: BrowserNotificationPermission } })
    .Notification
  const isSupported = env.notificationSupported ?? browserNotification !== undefined
  const permission: BrowserNotificationPermission | 'unsupported' = isSupported
    ? env.permission ?? browserNotification?.permission ?? 'default'
    : 'unsupported'

  let explanation: string
  if (!isSupported) {
    explanation =
      'This browser does not support system notifications. Reminders still appear inside Track.now while it is open.'
  } else if (permission === 'denied') {
    explanation =
      'Notifications are blocked for this site in your browser settings. Reminders still appear inside Track.now while it is open.'
  } else if (permission === 'default') {
    explanation =
      'Browser notifications are not enabled yet. Reminders appear inside Track.now while it is open; enable notifications to also get system alerts while the tab is in the background.'
  } else if (env.masterEnabled === false) {
    explanation =
      'Your browser allows notifications, but system notifications are switched off in Track.now, so none are sent. Reminders still appear inside Track.now while it is open. When the browser is closed nothing can fire.'
  } else {
    explanation =
      'System notifications are allowed while Track.now is open in a tab (foreground or background). When the browser is closed nothing can fire; reminders that came due are shown when you reopen the app.'
  }

  const granted = isSupported && permission === 'granted' && env.masterEnabled !== false
  return {
    isSupported,
    permission,
    canDeliverForeground: true, // in-app alerts work whenever the app is open
    canDeliverBackground: granted,
    canDeliverAppClosed: false,
    explanation,
  }
}

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationCapabilityStatus,
  type NotificationPreferences,
} from '@/types/notifications'

const PREFS_STORAGE_PREFIX = 'tracknow_notification_prefs_'

export function getPreferencesKey(userId: string): string {
  return `${PREFS_STORAGE_PREFIX}${userId}`
}

export function loadNotificationPreferences(userId: string): NotificationPreferences {
  if (!userId || typeof localStorage === 'undefined') return DEFAULT_NOTIFICATION_PREFERENCES
  try {
    const raw = localStorage.getItem(getPreferencesKey(userId))
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...parsed,
    }
  } catch (err) {
    console.warn('Failed to parse notification preferences from localStorage:', err)
    return DEFAULT_NOTIFICATION_PREFERENCES
  }
}

export function saveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
): NotificationPreferences {
  if (!userId) return prefs
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getPreferencesKey(userId), JSON.stringify(prefs))
    }
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tracknow:notification-prefs-changed', { detail: { userId, prefs } }))
    }
  } catch (err) {
    console.error('Failed to save notification preferences to localStorage:', err)
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
    permission?: NotificationPermission
    /** The user's "System notifications" switch. Callers should always pass it. */
    masterEnabled?: boolean
  } = {},
): NotificationCapabilityStatus {
  const isSupported =
    env.notificationSupported ?? (typeof window !== 'undefined' && 'Notification' in window)
  const permission: NotificationPermission | 'unsupported' = isSupported
    ? env.permission ?? Notification.permission
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

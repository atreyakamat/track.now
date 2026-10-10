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

export function getNotificationCapabilityStatus(): NotificationCapabilityStatus {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window
  const permission: NotificationPermission | 'unsupported' = isSupported
    ? Notification.permission
    : 'unsupported'

  const isStandalonePwa =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true)

  const isNative =
    typeof window !== 'undefined' &&
    Boolean((window as any).Capacitor?.isNativePlatform?.())

  let canDeliverForeground = false
  let canDeliverBackground = false
  let canDeliverAppClosed = false
  let explanation = ''

  if (!isSupported && !isNative) {
    explanation =
      'Web Notifications are not supported in this browser. In-app execution alerts and toasts will still work while the app is open.'
  } else if (permission === 'denied') {
    explanation =
      'Notifications are blocked in your browser settings. You must manually allow notifications in site permissions to receive alerts.'
  } else if (permission === 'default') {
    explanation =
      'Notifications are ready to be enabled. Click "Enable Notifications" below to grant browser permission.'
  } else {
    // Permission granted
    canDeliverForeground = true
    canDeliverBackground = true // Via active tab / service worker

    if (isNative) {
      canDeliverAppClosed = true
      explanation =
        'Full native OS scheduled delivery active. Reminders trigger via Android/iOS system alarms even when Track.now is completely closed.'
    } else if (isStandalonePwa) {
      canDeliverAppClosed = false // Web Push sender needed for closed PWA
      explanation =
        'Active PWA mode. Notifications trigger while Track.now is open or running in the background. Fully-closed offline push requires a server-side push service.'
    } else {
      canDeliverAppClosed = false
      explanation =
        'Browser tab mode. Notifications trigger while Track.now is open or running in a background tab. When the browser is closed, reminders catch up upon reopen.'
    }
  }

  return {
    isSupported,
    permission,
    canDeliverForeground,
    canDeliverBackground,
    canDeliverAppClosed,
    explanation,
  }
}

import type { WidgetDataPayload } from '@/types/widget'

export interface NativeNotificationScheduleOptions {
  id: number
  title: string
  body: string
  scheduleAt: Date
  extra?: Record<string, any>
}

/**
 * Checks if the current execution context is within a Capacitor native mobile shell.
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as any).Capacitor?.isNativePlatform?.())
}

/**
 * Returns current platform name ('android' | 'ios' | 'web').
 */
export function getPlatformName(): 'android' | 'ios' | 'web' {
  if (typeof window === 'undefined') return 'web'
  const cap = (window as any).Capacitor
  if (cap && typeof cap.getPlatform === 'function') {
    const p = cap.getPlatform()
    if (p === 'android' || p === 'ios') return p
  }
  return 'web'
}

/**
 * Schedules an OS-level local notification via native system alarms when running in native shell.
 * When in web browser, gracefully returns false so the web notification engine handles it.
 */
export async function scheduleNativeLocalNotification(
  options: NativeNotificationScheduleOptions,
): Promise<boolean> {
  if (!isNativePlatform()) {
    return false
  }

  try {
    const LocalNotifications = (window as any).Capacitor?.Plugins?.LocalNotifications
    if (LocalNotifications && typeof LocalNotifications.schedule === 'function') {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: options.id,
            title: options.title,
            body: options.body,
            schedule: { at: options.scheduleAt },
            extra: options.extra || {},
            smallIcon: 'ic_stat_tracknow',
            iconColor: '#c8f169',
          },
        ],
      })
      return true
    }
  } catch (err) {
    console.warn('Native local notification scheduling failed, falling back:', err)
  }

  return false
}

/**
 * Cancels an OS-level scheduled local notification by ID.
 */
export async function cancelNativeLocalNotification(id: number): Promise<boolean> {
  if (!isNativePlatform()) return false

  try {
    const LocalNotifications = (window as any).Capacitor?.Plugins?.LocalNotifications
    if (LocalNotifications && typeof LocalNotifications.cancel === 'function') {
      await LocalNotifications.cancel({
        notifications: [{ id }],
      })
      return true
    }
  } catch (err) {
    console.warn('Native local notification cancellation failed:', err)
  }

  return false
}

/**
 * Syncs the sanitized widget data payload to native Android SharedPreferences
 * or iOS App Group UserDefaults.
 */
export async function syncNativeWidgetData(payload: WidgetDataPayload): Promise<boolean> {
  if (!isNativePlatform()) {
    // In web environment, mock bridge sync for testing & responsive preview
    return false
  }

  try {
    const WidgetBridge = (window as any).Capacitor?.Plugins?.TrackNowWidgetBridge
    if (WidgetBridge && typeof WidgetBridge.updateWidgetData === 'function') {
      await WidgetBridge.updateWidgetData({
        payloadJson: JSON.stringify(payload),
      })
      return true
    }
  } catch (err) {
    console.warn('Native widget bridge sync failed:', err)
  }

  return false
}

/**
 * Clears native widget storage upon sign out or account switch.
 */
export async function clearNativeWidgetData(): Promise<boolean> {
  if (!isNativePlatform()) return false

  try {
    const WidgetBridge = (window as any).Capacitor?.Plugins?.TrackNowWidgetBridge
    if (WidgetBridge && typeof WidgetBridge.clearWidgetData === 'function') {
      await WidgetBridge.clearWidgetData()
      return true
    }
  } catch (err) {
    console.warn('Native widget bridge clear failed:', err)
  }

  return false
}

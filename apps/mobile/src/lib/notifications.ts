import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { loadUserReminders } from '@tracknow/core/services/reminderService'
import { onAppEvent } from '@tracknow/core/platform/events'
import type { ItemReminder } from '@tracknow/core/types/notifications'

/**
 * Native local reminders for the mobile app.
 *
 * Track.now reminders are stored device-locally by @tracknow/core (the same model the web
 * uses). On mobile we turn each upcoming reminder into a real OS-scheduled local notification
 * via expo-notifications, so it fires even when the app is closed — a step up from the web,
 * which can only alert while a tab is open.
 *
 * Note: local notifications require a development build on Android (Expo Go dropped Android
 * notification support in SDK 53+). iOS local notifications also work in Expo Go.
 */

const ANDROID_CHANNEL_ID = 'reminders'

let configured = false

// Foreground behaviour: still show the banner/sound when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/** Sets up the Android channel and asks for permission. Safe to call more than once. */
export async function configureNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#c8f169',
      })
    } catch {
      /* channel setup is best-effort */
    }
  }
  if (configured) return hasPermissionCached
  configured = true
  return requestPermission()
}

let hasPermissionCached = false

/** Reads the current OS permission state without prompting. For status UIs (e.g. Settings). */
export async function getNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync()
    hasPermissionCached = status === 'granted'
    return hasPermissionCached
  } catch {
    return false
  }
}

export async function requestPermission(): Promise<boolean> {
  // A simulator/emulator can schedule local notifications; only remote push needs a device.
  if (!Device.isDevice && Platform.OS !== 'android' && Platform.OS !== 'ios') {
    hasPermissionCached = false
    return false
  }
  try {
    const { status } = await Notifications.getPermissionsAsync()
    let granted = status === 'granted'
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync()
      granted = req.status === 'granted'
    }
    hasPermissionCached = granted
    return granted
  } catch {
    hasPermissionCached = false
    return false
  }
}

function toTrigger(remindAt: string): Notifications.NotificationTriggerInput {
  const date = new Date(remindAt)
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
    channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
  }
}

function bodyFor(reminder: ItemReminder): string {
  if (reminder.itemType === 'habit') return 'Time for your habit.'
  return 'This is your Track.now reminder.'
}

/**
 * Re-syncs the OS-scheduled notifications to exactly match the user's upcoming reminders.
 * All Track.now notifications are ours, so we clear and reschedule from the stored set.
 * Called at startup and whenever reminders change.
 */
export async function syncScheduledNotifications(userId: string | undefined): Promise<void> {
  if (!userId || !hasPermissionCached) return
  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
    const now = Date.now()
    const upcoming = loadUserReminders(userId).filter(
      (r) => (r.status === 'upcoming' || r.status === 'snoozed') && new Date(r.remindAt).getTime() > now,
    )
    for (const reminder of upcoming) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.itemName,
          body: bodyFor(reminder),
          data: { itemId: reminder.itemId, planId: reminder.planId, trackId: reminder.trackId ?? null },
        },
        trigger: toTrigger(reminder.remindAt),
      })
    }
  } catch {
    /* scheduling unavailable (e.g. Expo Go on Android); the in-app list still works */
  }
}

/**
 * Wires reminder changes to the OS scheduler and returns an unsubscribe function.
 * Keeps notifications in sync as the user adds, snoozes, removes or completes reminders.
 */
export function startReminderSync(userId: string | undefined): () => void {
  void syncScheduledNotifications(userId)
  const off = onAppEvent('tracknow:reminders-updated', () => {
    void syncScheduledNotifications(userId)
  })
  return off
}

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
 * Low-frequency "nudges" that aren't tied to a specific item reminder: a weekly review
 * prompt and a gentle evening streak check. Rescheduled on every sync (which clears all
 * scheduled notifications first), so they never pile up into duplicates.
 */
async function scheduleNudges(): Promise<void> {
  const channelId = Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined
  try {
    // Weekly review — Sunday 6pm (weekday 1 = Sunday in expo-notifications).
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your week in review',
        body: 'See your streaks, wins, and what to adjust for next week.',
        data: { nudge: 'weekly' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0, channelId },
    })
    // Evening streak check — daily 8pm.
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Keep your streak alive',
        body: 'Anything left for today? A quick check keeps your habits going.',
        data: { nudge: 'streak' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 0, channelId },
    })
  } catch {
    /* scheduling unavailable */
  }
}

/**
 * Re-syncs the OS-scheduled notifications to exactly match the user's upcoming reminders,
 * plus the recurring nudges. All Track.now notifications are ours, so we clear and
 * reschedule from the stored set. Called at startup and whenever reminders change.
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
    await scheduleNudges()
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

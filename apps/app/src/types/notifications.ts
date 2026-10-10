/**
 * Notification and Smart Reminder domain types.
 */

export type ReminderPreset =
  | 'none'
  | '10m'
  | '30m'
  | '1h'
  | '2h'
  | 'scheduled_time'
  | 'exact_time'

export type ReminderStatus = 'upcoming' | 'delivered' | 'snoozed' | 'cancelled' | 'dismissed'

export interface ItemReminder {
  id: string
  itemId: string
  userId: string
  itemName: string
  planId: string
  trackId?: string
  preset: ReminderPreset
  remindAt: string // ISO 8601 timestamp
  status: ReminderStatus
  snoozedUntil?: string | null
  deliveredAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface NotificationPreferences {
  masterEnabled: boolean
  remindersEnabled: boolean
  completionAcknowledgement: boolean
  overdueRemindersEnabled: boolean
  dailySummaryEnabled: boolean
  dailySummaryTime: string // HH:mm format, e.g. "09:00"
  defaultPreset: ReminderPreset
  soundEnabled: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  masterEnabled: false, // Explicit opt-in required by design
  remindersEnabled: true,
  completionAcknowledgement: true,
  overdueRemindersEnabled: false,
  dailySummaryEnabled: false,
  dailySummaryTime: '09:00',
  defaultPreset: 'none',
  soundEnabled: false,
}

export type DeliveryPlatformCapability =
  | 'web_foreground'
  | 'web_background_tab'
  | 'pwa_installed'
  | 'native_android'
  | 'native_ios'

export interface NotificationCapabilityStatus {
  isSupported: boolean
  permission: NotificationPermission | 'unsupported'
  canDeliverForeground: boolean
  canDeliverBackground: boolean
  canDeliverAppClosed: boolean
  explanation: string
}

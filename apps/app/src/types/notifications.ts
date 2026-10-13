/**
 * Notification and Smart Reminder domain types.
 */
import type { ItemSchedule, ItemType } from './domain'

export type ReminderPreset =
  | 'none'
  | '10m' // legacy alias
  | '30m' // legacy alias
  | '1h' // legacy alias
  | '2h' // legacy alias
  | '10m_before'
  | '30m_before'
  | '1h_before'
  | '2h_before'
  | '10m_in'
  | '30m_in'
  | '1h_in'
  | '2h_in'
  | 'scheduled_time'
  | 'exact_time'

export type ReminderStatus = 'upcoming' | 'delivered' | 'snoozed' | 'cancelled' | 'dismissed'

export interface ItemReminder {
  id: string
  itemId: string
  userId: string
  itemName: string
  /** Item type at the time the reminder was set (used for recurring habit reminders). */
  itemType?: ItemType
  /** Habit schedule snapshot so a recurring reminder can be moved to its next occurrence. */
  scheduleSnapshot?: Pick<ItemSchedule, 'frequency' | 'days_of_week' | 'time_of_day' | 'reminder_time'> | null
  planId: string
  trackId?: string
  preset: ReminderPreset
  remindAt: string // ISO 8601 timestamp
  /**
   * The due/scheduled occurrence this reminder belongs to (ISO). Set for due/schedule-relative
   * presets; kept across snoozes so a recurring reminder re-arms for the occurrence after it.
   */
  occursAt?: string | null
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

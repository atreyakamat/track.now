import type { ItemSchedule } from '../types/domain'
import type { ReminderPreset } from '../types/notifications'
import type { ReminderPreview } from '../services/reminderService'

/** Shared, platform-neutral helpers for the Create / Edit item forms. */

export const DAYS = [
  { label: 'Sun', full: 'Sunday', value: 0 },
  { label: 'Mon', full: 'Monday', value: 1 },
  { label: 'Tue', full: 'Tuesday', value: 2 },
  { label: 'Wed', full: 'Wednesday', value: 3 },
  { label: 'Thu', full: 'Thursday', value: 4 },
  { label: 'Fri', full: 'Friday', value: 5 },
  { label: 'Sat', full: 'Saturday', value: 6 },
]

/** 'monthly' only exists on legacy habits; the forms keep it but never offer it for new ones. */
export type HabitFrequency = 'daily' | 'weekly' | 'custom' | 'monthly'

export type TimeOfDayChoice = 'anytime' | 'morning' | 'afternoon' | 'evening'

export interface HabitScheduleInput {
  frequency: HabitFrequency
  days_of_week: number[] | null
  time_of_day: TimeOfDayChoice
  reminder_time: string | null
}

/**
 * Builds the schedule payload from the habit form. A legacy 'monthly' schedule keeps its stored
 * days exactly (the form never shows a day picker for it), so editing such a habit without
 * touching its frequency never rewrites it.
 */
export function buildHabitScheduleInput(args: {
  frequency: HabitFrequency
  daysOfWeek: number[]
  timeOfDay: TimeOfDayChoice
  habitTime: string
  original?: Pick<ItemSchedule, 'frequency' | 'days_of_week'> | null
}): HabitScheduleInput {
  const { frequency, daysOfWeek, timeOfDay, habitTime, original } = args
  const days =
    frequency === 'daily'
      ? null
      : frequency === 'monthly'
        ? original?.frequency === 'monthly'
          ? (original.days_of_week ?? null)
          : null
        : daysOfWeek
  return { frequency, days_of_week: days, time_of_day: timeOfDay, reminder_time: habitTime || null }
}

/** Whether the form must ask for at least one active day. */
export function needsActiveDays(frequency: HabitFrequency): boolean {
  return frequency === 'weekly' || frequency === 'custom'
}

/**
 * Create flow: a reminder preset that came from the Settings default (not chosen by the user)
 * must never block creating an item that has nothing to remind about (e.g. an undated task with
 * a "1 hour before" default). It falls back to no reminder instead; an explicit choice is still
 * validated.
 */
export function resolveCreateReminderChoice(
  preset: ReminderPreset,
  presetTouched: boolean,
  preview: ReminderPreview | null,
): { preset: ReminderPreset; error: string | null; skippedDefault: boolean } {
  if (preset === 'none' || !preview?.error) return { preset, error: null, skippedDefault: false }
  if (!presetTouched) return { preset: 'none', error: null, skippedDefault: true }
  return { preset, error: preview.error, skippedDefault: false }
}

export function reminderHint(
  preset: ReminderPreset,
  hasDueDate: boolean,
  isHabit: boolean,
  isUntouchedDefault = false,
): string | undefined {
  if (preset.endsWith('_before') || preset === 'scheduled_time') {
    if (isHabit) return 'Uses the habit time (or its time of day). Repeats on each scheduled day.'
    if (hasDueDate) return 'Uses the due date at 09:00 unless the item has a set time.'
    return isUntouchedDefault
      ? 'Your default reminder needs a due date. Without one this item is added with no reminder.'
      : 'Needs a due date: this reminder counts back from the due time.'
  }
  if (preset.endsWith('_in')) return 'Counts from the moment you save.'
  return undefined
}

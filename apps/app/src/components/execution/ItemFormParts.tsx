import { useId } from 'react'
import type { ItemSchedule } from '@/types/domain'
import type { ReminderPreset } from '@/types/notifications'
import type { ReminderPreview } from '@/services/reminderService'
import { Input, Select } from '@/components/ui'

/** Shared pieces of the Create / Edit item forms. */

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
          ? original.days_of_week ?? null
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

export function DayPicker({ value, onToggle }: { value: number[]; onToggle: (day: number) => void }) {
  const labelId = useId()
  return (
    <div>
      <span id={labelId} className="field__label" style={{ display: 'block', marginBottom: '6px' }}>
        Active days
      </span>
      <div role="group" aria-labelledby={labelId} className="row" style={{ gap: '6px' }}>
        {DAYS.map((day) => {
          const selected = value.includes(day.value)
          return (
            <button
              key={day.value}
              type="button"
              onClick={() => onToggle(day.value)}
              aria-pressed={selected}
              aria-label={day.full}
              className={`btn btn--sm ${selected ? 'btn--primary' : 'btn--secondary'}`}
              style={{ minWidth: '44px', padding: '4px 8px', fontSize: 'var(--text-caption)' }}
            >
              {day.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ReminderFields({
  preset,
  onPresetChange,
  exactTime,
  onExactTimeChange,
  showHabitTime,
  habitTime,
  onHabitTimeChange,
  hint,
}: {
  preset: ReminderPreset
  onPresetChange: (preset: ReminderPreset) => void
  exactTime: string
  onExactTimeChange: (value: string) => void
  showHabitTime: boolean
  habitTime: string
  onHabitTimeChange: (value: string) => void
  hint?: string
}) {
  return (
    <div
      className="stack"
      style={{
        padding: 'var(--space-3)',
        background: 'var(--surface-muted)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        gap: 'var(--space-3)',
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="t-meta" style={{ fontWeight: 600 }}>
          Reminder
        </span>
        <span className="t-caption">Stored on this device · fires while Track.now is open</span>
      </div>

      <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
        <Select
          label="Reminder timing"
          value={preset}
          onChange={(e) => onPresetChange(e.target.value as ReminderPreset)}
          hint={hint}
        >
          <option value="none">No reminder</option>
          <optgroup label="From now">
            <option value="10m_in">In 10 minutes</option>
            <option value="30m_in">In 30 minutes</option>
            <option value="1h_in">In 1 hour</option>
            <option value="2h_in">In 2 hours</option>
          </optgroup>
          <optgroup label="Relative to due / scheduled time">
            <option value="scheduled_time">At the scheduled time</option>
            <option value="10m_before">10 minutes before</option>
            <option value="30m_before">30 minutes before</option>
            <option value="1h_before">1 hour before</option>
            <option value="2h_before">2 hours before</option>
          </optgroup>
          <optgroup label="Custom">
            <option value="exact_time">Custom date and time…</option>
          </optgroup>
        </Select>

        {preset === 'exact_time' && (
          <Input
            label="Reminder date and time"
            type="datetime-local"
            value={exactTime}
            onChange={(e) => onExactTimeChange(e.target.value)}
            required
          />
        )}
      </div>

      {showHabitTime && (
        <div style={{ maxWidth: '220px' }}>
          <Input
            label="Habit time (optional)"
            type="time"
            value={habitTime}
            onChange={(e) => onHabitTimeChange(e.target.value)}
            hint="Used for “at the scheduled time” and “before” reminders."
          />
        </div>
      )}
    </div>
  )
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

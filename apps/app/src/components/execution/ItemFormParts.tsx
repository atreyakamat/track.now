import { useId } from 'react'
import type { ReminderPreset } from '@tracknow/core/types/notifications'
import {
  DAYS,
  buildHabitScheduleInput,
  needsActiveDays,
  reminderHint,
  resolveCreateReminderChoice,
  type HabitFrequency,
  type HabitScheduleInput,
  type TimeOfDayChoice,
} from '@tracknow/core/domain/habitSchedule'
import { Input, Select } from '@/components/ui'

/** Shared pieces of the Create / Edit item forms. */

// Pure schedule/reminder helpers moved to @tracknow/core/domain/habitSchedule (shared with
// the mobile app); re-exported here so existing imports keep working.
export {
  DAYS,
  buildHabitScheduleInput,
  needsActiveDays,
  reminderHint,
  resolveCreateReminderChoice,
  type HabitFrequency,
  type HabitScheduleInput,
  type TimeOfDayChoice,
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

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

// ---------------------------------------------------------------------------
// Arc-era additions: weekly targets, start dates and checklist steps.
// ---------------------------------------------------------------------------

/** The habit "Repeat" choice: fixed days, or a weekly target on any days ("3× a week"). */
export type RepeatChoice = HabitFrequency | 'flexible'

export function repeatChoiceOf(schedule: { frequency: HabitFrequency; times_per_week?: number | null } | null | undefined): RepeatChoice {
  if (!schedule) return 'daily'
  return schedule.times_per_week ? 'flexible' : schedule.frequency
}

export function buildScheduleFromForm(args: {
  repeat: RepeatChoice
  daysOfWeek: number[]
  timeOfDay: TimeOfDayChoice
  habitTime: string
  timesPerWeek: number
  original?: { frequency: HabitFrequency; days_of_week: number[] | null } | null
}): HabitScheduleInput & { times_per_week: number | null } {
  if (args.repeat === 'flexible') {
    return {
      frequency: 'weekly',
      days_of_week: null,
      time_of_day: args.timeOfDay,
      reminder_time: args.habitTime || null,
      times_per_week: Math.min(7, Math.max(1, Math.round(args.timesPerWeek))),
    }
  }
  return {
    ...buildHabitScheduleInput({
      frequency: args.repeat,
      daysOfWeek: args.daysOfWeek,
      timeOfDay: args.timeOfDay,
      habitTime: args.habitTime,
      original: args.original,
    }),
    times_per_week: null,
  }
}

export function TimesPerWeekField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Select
      label="Sessions per week"
      value={String(value)}
      onChange={(e) => onChange(Number(e.target.value))}
      hint="Any days, Monday to Sunday. Rest days never break the streak."
    >
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <option key={n} value={n}>
          {n}× a week
        </option>
      ))}
    </Select>
  )
}

export function ChecklistStepsEditor({
  value,
  onChange,
  routine,
}: {
  value: { id: string; label: string; done: boolean }[]
  onChange: (next: { id: string; label: string; done: boolean }[]) => void
  /** A habit's steps: ticked off again every day, so the editor has no done boxes. */
  routine?: boolean
}) {
  const labelId = useId()
  const add = () => onChange([...value, { id: `new-${Date.now()}-${value.length}`, label: '', done: false }])
  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      <span id={labelId} className="field__label">
        {routine ? 'Routine steps (optional)' : 'Steps (optional)'}
      </span>
      {routine && <span className="field__hint">Tick these off each day. The habit is done for the day when every step is ticked.</span>}
      <ul className="checklist-editor" aria-labelledby={labelId}>
        {value.map((step, i) => (
          <li key={step.id} className="row" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
            {!routine && (
              <input
                type="checkbox"
                checked={step.done}
                aria-label={`Step ${i + 1} done`}
                onChange={() => onChange(value.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s)))}
              />
            )}
            <input
              className="control"
              style={{ flex: 1, minWidth: 0 }}
              value={step.label}
              maxLength={200}
              placeholder={`Step ${i + 1}`}
              aria-label={`Step ${i + 1}`}
              onChange={(e) => onChange(value.map((s) => (s.id === step.id ? { ...s, label: e.target.value } : s)))}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              aria-label={`Remove step ${i + 1}`}
              onClick={() => onChange(value.filter((s) => s.id !== step.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {value.length < 50 && (
        <button type="button" className="btn btn--secondary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={add}>
          + Add step
        </button>
      )}
    </div>
  )
}

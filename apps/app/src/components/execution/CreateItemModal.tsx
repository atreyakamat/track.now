import { useEffect, useId, useState } from 'react'
import type { ItemPriority, ItemType, NewExecutionItemInput } from '@tracknow/core/types/domain'
import type { ReminderPreset } from '@tracknow/core/types/notifications'
import { Button, Input, Modal, Select, Textarea } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { loadNotificationPreferences } from '@tracknow/core/services/notificationPreferences'
import { previewReminder } from '@tracknow/core/services/reminderService'
import { parseQuickAdd } from '@tracknow/core/domain/quickAdd'
import { useToast } from '@/features/notifications/ToastContext'
import {
  ChecklistStepsEditor,
  DayPicker,
  ReminderFields,
  TimesPerWeekField,
  buildScheduleFromForm,
  needsActiveDays,
  reminderHint,
  resolveCreateReminderChoice,
  type RepeatChoice,
} from './ItemFormParts'

interface CreateItemModalProps {
  open: boolean
  onClose: () => void
  /** Fixed Plan (Plan page). Omit and pass `plans` to let the user pick (Today quick add). */
  planId?: string
  trackId?: string
  plans?: { id: string; label: string; track_id: string }[]
  defaultType?: ItemType
  onSubmit: (
    input: NewExecutionItemInput,
    reminderOptions?: { preset: ReminderPreset; exactTime?: string },
  ) => Promise<void>
}

const MAX_NAME = 200
const MAX_TARGET = 100000

export function CreateItemModal({
  open,
  onClose,
  planId,
  trackId,
  plans,
  defaultType = 'task',
  onSubmit,
}: CreateItemModalProps) {
  const [pickedPlanId, setPickedPlanId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [timesPerWeek, setTimesPerWeek] = useState(3)
  const [steps, setSteps] = useState<{ id: string; label: string; done: boolean }[]>([])
  const { user } = useAuth()
  const { showToast } = useToast()
  const formId = useId()
  const [type, setType] = useState<ItemType>(defaultType)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<ItemPriority>('medium')
  const [frequency, setFrequency] = useState<RepeatChoice>('daily')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5])
  const [timeOfDay, setTimeOfDay] = useState<'anytime' | 'morning' | 'afternoon' | 'evening'>('anytime')
  const [dueDate, setDueDate] = useState('')
  const [targetInput, setTargetInput] = useState('1')
  const [unit, setUnit] = useState('')
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>('none')
  // False while the preset is still the Settings default (the user has not picked one).
  const [presetTouched, setPresetTouched] = useState(false)
  const [exactReminderTime, setExactReminderTime] = useState('')
  const [habitReminderTime, setHabitReminderTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [quick, setQuick] = useState('')
  const [quickHint, setQuickHint] = useState<string | null>(null)

  /** "Gym Mon Wed Fri 6am" → fills type, name, days, time, due date. The fields stay editable. */
  const applyQuick = (text: string) => {
    setQuick(text)
    if (!text.trim()) return setQuickHint(null)
    const q = parseQuickAdd(text)
    setName(q.name)
    setType(q.type)
    setPriority(q.priority)
    if (q.dueDate && q.type !== 'habit') setDueDate(q.dueDate)
    if (q.type === 'habit') {
      if (q.timesPerWeek) {
        setFrequency('flexible')
        setTimesPerWeek(q.timesPerWeek)
      } else if (q.daysOfWeek && q.daysOfWeek.length < 7) {
        setFrequency('weekly')
        setDaysOfWeek(q.daysOfWeek)
      } else setFrequency('daily')
      setTimeOfDay(q.timeOfDay)
      if (q.time) setHabitReminderTime(q.time)
    }
    if (q.targetCount) setTargetInput(String(q.targetCount))
    if (q.unit) setUnit(q.unit)
    setQuickHint(q.recognised.length ? `Understood: ${q.recognised.join(', ')}` : 'Type days, a time, "3x a week" or "tomorrow" and they are picked up.')
  }

  // Reset the form every time the dialog opens, honouring the requested type and the
  // user's default reminder preference from Settings.
  useEffect(() => {
    if (!open) return
    setType(defaultType)
    setName('')
    setDescription('')
    setPriority('medium')
    setFrequency('daily')
    setDaysOfWeek([1, 2, 3, 4, 5])
    setTimeOfDay('anytime')
    setDueDate('')
    setTargetInput('1')
    setUnit('')
    setPickedPlanId(plans?.[0]?.id ?? '')
    setStartDate('')
    setTimesPerWeek(3)
    setSteps([])
    setReminderPreset(user?.id ? loadNotificationPreferences(user.id).defaultPreset : 'none')
    setPresetTouched(false)
    setExactReminderTime('')
    setHabitReminderTime('')
    setQuick('')
    setQuickHint(null)
    setError(null)
    setBusy(false)
  }, [open, defaultType, user?.id])

  const toggleDay = (dayIndex: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort(),
    )
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy) return
    const trimmed = name.trim()
    if (!trimmed) return setError('Item name is required.')
    if (trimmed.length > MAX_NAME) return setError(`Item name must be ${MAX_NAME} characters or fewer.`)
    const targetCount = Number(targetInput)
    if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > MAX_TARGET) {
      return setError(`Target quantity must be a whole number between 1 and ${MAX_TARGET}.`)
    }
    if (type === 'habit' && frequency !== 'flexible' && needsActiveDays(frequency) && daysOfWeek.length === 0) {
      return setError('Choose at least one active day for this habit.')
    }

    const targetPlanId = planId ?? pickedPlanId
    const targetTrackId = trackId ?? plans?.find((p) => p.id === pickedPlanId)?.track_id
    if (!targetPlanId) return setError('Choose the Plan this item belongs to.')

    const schedule =
      type === 'habit'
        ? buildScheduleFromForm({ repeat: frequency, daysOfWeek, timeOfDay, habitTime: habitReminderTime, timesPerWeek })
        : null

    const preview =
      reminderPreset !== 'none'
        ? previewReminder(
            reminderPreset,
            {
              type,
              due_date: dueDate || null,
              schedule: schedule ? { id: '', item_id: '', created_at: '', ...schedule } : null,
            },
            reminderPreset === 'exact_time' ? exactReminderTime : undefined,
          )
        : null
    // An untouched default preset that does not fit this item (e.g. "1 hour before" on an
    // undated task) never blocks creation: the item is added without a reminder.
    const choice = resolveCreateReminderChoice(reminderPreset, presetTouched, preview)
    if (choice.error) return setError(choice.error)
    const effectivePreset = choice.preset

    try {
      setBusy(true)
      setError(null)
      await onSubmit(
        {
          plan_id: targetPlanId,
          track_id: targetTrackId,
          type,
          start_date: startDate || null,
          checklist_entries: type === 'checklist' || type === 'habit' ? steps.filter((st) => st.label.trim()) : null,
          name: trimmed,
          description: description.trim() || null,
          priority,
          due_date: dueDate || null,
          target_count: targetCount,
          current_count: 0,
          unit: unit.trim() || null,
          schedule,
        },
        effectivePreset !== 'none'
          ? { preset: effectivePreset, exactTime: effectivePreset === 'exact_time' ? exactReminderTime : undefined }
          : undefined,
      )
      if (choice.skippedDefault) {
        showToast({
          id: 'create-default-reminder-skipped',
          title: 'Added without a reminder',
          message: 'Your default reminder needs a due date or schedule, so none was set for this item.',
          type: 'info',
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Add item"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Adding…' : 'Add Item'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="form" style={{ gap: 'var(--space-3)' }} noValidate>
        <Input
          label="Quick add"
          placeholder="e.g. Gym Mon Wed Fri 6am · Call dentist tomorrow · Read 20 pages every evening"
          value={quick}
          onChange={(e) => applyQuick(e.target.value)}
          hint={quickHint ?? 'Describe it in plain words; the fields below fill in. Or skip this and use the fields.'}
          autoComplete="off"
        />
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        {!planId && plans && plans.length > 0 && (
          <Select label="Plan" value={pickedPlanId} onChange={(e) => setPickedPlanId(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        )}

        <Select
          label="Item type"
          value={type}
          onChange={(e) => setType(e.target.value as ItemType)}
          hint="Habit, Task, Checklist item, Milestone, or Project"
        >
          <option value="task">Task (action to be done)</option>
          <option value="habit">Habit (recurring routine)</option>
          <option value="checklist">Checklist (steps to tick off)</option>
          <option value="milestone">Milestone (key target)</option>
          <option value="project">Project (larger initiative)</option>
        </Select>

        <Input
          label="Title"
          placeholder="e.g. 5 km morning run, complete portfolio draft"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME}
          required
        />

        <Textarea
          label="Description (optional)"
          placeholder="Add context, parameters, or details…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />

        {type === 'habit' && (
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
            <span className="t-meta" style={{ fontWeight: 600 }}>
              Habit schedule
            </span>
            <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
              <Select label="Repeat" value={frequency} onChange={(e) => setFrequency(e.target.value as RepeatChoice)}>
                <option value="daily">Every day</option>
                <option value="weekly">On chosen days</option>
                <option value="flexible">Times a week (any days)</option>
                <option value="custom">Custom days</option>
              </Select>
              <Select
                label="Time of day"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value as 'anytime' | 'morning' | 'afternoon' | 'evening')}
              >
                <option value="anytime">Anytime</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </Select>
            </div>
            {frequency === 'flexible' ? (
              <TimesPerWeekField value={timesPerWeek} onChange={setTimesPerWeek} />
            ) : (
              needsActiveDays(frequency) && <DayPicker value={daysOfWeek} onToggle={toggleDay} />
            )}
          </div>
        )}

        {(type === 'checklist' || type === 'habit') && <ChecklistStepsEditor value={steps} onChange={setSteps} routine={type === 'habit'} />}

        <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
          <Input
            label="Target quantity"
            type="number"
            inputMode="numeric"
            min="1"
            max={String(MAX_TARGET)}
            step="1"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            hint="Amount to complete (default 1)"
          />
          <Input
            label="Unit (optional)"
            placeholder="e.g. reps, pages, km"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            maxLength={30}
          />
        </div>

        <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as ItemPriority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
          <Input label="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <Input
          label="Starts on (optional)"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          hint="Before this day the item waits in Upcoming and never counts against you."
        />

        <ReminderFields
          preset={reminderPreset}
          onPresetChange={(preset) => {
            setPresetTouched(true)
            setReminderPreset(preset)
          }}
          exactTime={exactReminderTime}
          onExactTimeChange={setExactReminderTime}
          showHabitTime={type === 'habit'}
          habitTime={habitReminderTime}
          onHabitTimeChange={setHabitReminderTime}
          hint={reminderHint(reminderPreset, Boolean(dueDate), type === 'habit', !presetTouched)}
        />
      </form>
    </Modal>
  )
}

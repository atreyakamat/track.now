import { useEffect, useId, useState } from 'react'
import type { ExecutionItem, ItemPriority, ItemType, UpdateExecutionItemInput } from '@/types/domain'
import type { ItemReminder, ReminderPreset } from '@/types/notifications'
import {
  cancelReminderForItem,
  endOfLocalDay,
  getReminderForItem,
  isReminderTimingUnchanged,
  previewReminder,
  refreshReminderItemDetails,
  setReminderForItem,
  toLocalDateTimeInputValue,
  type ReminderTimingOptions,
} from '@/services/reminderService'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { Button, Input, Modal, Select, Textarea } from '@/components/ui'
import { effectiveCurrentCount } from '@/domain/habitCounter'
import {
  DayPicker,
  ReminderFields,
  buildHabitScheduleInput,
  needsActiveDays,
  reminderHint,
  type HabitFrequency,
} from './ItemFormParts'

interface EditItemModalProps {
  open: boolean
  onClose: () => void
  item: ExecutionItem | null
  onSubmit: (itemId: string, input: UpdateExecutionItemInput) => Promise<void>
  /** Whether the item is completed today (habits restart their count each day). */
  completedToday?: boolean
}

const MAX_NAME = 200
const MAX_TARGET = 100000

export function EditItemModal({ open, onClose, item, onSubmit, completedToday = false }: EditItemModalProps) {
  const formId = useId()
  const [type, setType] = useState<ItemType>('task')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<ItemPriority>('medium')
  const [frequency, setFrequency] = useState<HabitFrequency>('daily')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5])
  const [timeOfDay, setTimeOfDay] = useState<'anytime' | 'morning' | 'afternoon' | 'evening'>('anytime')
  const [dueDate, setDueDate] = useState('')
  const [targetInput, setTargetInput] = useState('1')
  const [currentInput, setCurrentInput] = useState('0')
  const [unit, setUnit] = useState('')
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>('none')
  const [exactReminderTime, setExactReminderTime] = useState('')
  const [habitReminderTime, setHabitReminderTime] = useState('')
  const [existingReminder, setExistingReminder] = useState<ItemReminder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { user } = useAuth()
  const { showToast } = useToast()
  const effectiveUserId = user?.id || item?.user_id

  useEffect(() => {
    if (!item || !open) return
    setType(item.type)
    setName(item.name)
    setDescription(item.description || '')
    setPriority(item.priority || 'medium')
    setDueDate(item.due_date || '')
    setTargetInput(String(Math.max(1, item.target_count ?? 1)))
    // Today's count: a habit's stored count from an earlier day is shown (and saved) as 0.
    setCurrentInput(String(effectiveCurrentCount(item, completedToday)))
    setUnit(item.unit || '')
    if (item.schedule) {
      // Legacy 'monthly' habits keep their frequency unless the user changes it.
      setFrequency(item.schedule.frequency)
      setDaysOfWeek(item.schedule.days_of_week?.length ? item.schedule.days_of_week : [1, 2, 3, 4, 5])
      const tod = item.schedule.time_of_day
      setTimeOfDay(tod === 'morning' || tod === 'afternoon' || tod === 'evening' ? tod : 'anytime')
      setHabitReminderTime(item.schedule.reminder_time?.slice(0, 5) || '')
    } else {
      setFrequency('daily')
      setDaysOfWeek([1, 2, 3, 4, 5])
      setTimeOfDay('anytime')
      setHabitReminderTime('')
    }

    const existing = effectiveUserId ? getReminderForItem(effectiveUserId, item.id) : null
    setExistingReminder(existing)
    // Only show a reminder that actually exists; never imply one from the schedule.
    setReminderPreset(existing ? existing.preset : 'none')
    // datetime-local needs LOCAL wall time; slicing the UTC ISO string shifted it by the offset.
    setExactReminderTime(existing?.preset === 'exact_time' ? toLocalDateTimeInputValue(existing.remindAt) : '')
    setError(null)
    setBusy(false)
  }, [item, open, effectiveUserId, completedToday])

  if (!item) return null

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
    const currentCount = Number(currentInput)
    if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > MAX_TARGET) {
      return setError(`Target quantity must be a whole number between 1 and ${MAX_TARGET}.`)
    }
    if (!Number.isInteger(currentCount) || currentCount < 0 || currentCount > MAX_TARGET * 10) {
      return setError('Completed quantity must be a whole number of 0 or more.')
    }
    if (type === 'habit' && needsActiveDays(frequency) && daysOfWeek.length === 0) {
      return setError('Choose at least one active day for this habit.')
    }

    const scheduleInput =
      type === 'habit'
        ? buildHabitScheduleInput({
            frequency,
            daysOfWeek,
            timeOfDay,
            habitTime: habitReminderTime,
            original: item.schedule ?? null,
          })
        : null

    const updatedItem: ExecutionItem = {
      ...item,
      type,
      name: trimmed,
      due_date: dueDate || null,
      schedule: scheduleInput
        ? { id: item.schedule?.id ?? '', item_id: item.id, created_at: item.schedule?.created_at ?? '', ...scheduleInput }
        : null,
    }

    // Decide what happens to the reminder BEFORE saving, so an invalid choice never leaves
    // the item saved with its reminder silently dropped.
    const exactIso = reminderPreset === 'exact_time' ? exactReminderTime : undefined
    // Keep the existing reminder (and any snooze) when neither the preset nor anything its
    // time depends on changed; only recompute when the timing really moved.
    const keepExistingReminder = isReminderTimingUnchanged({
      existing: existingReminder,
      preset: reminderPreset,
      exactTimeInput: exactReminderTime,
      before: item,
      after: updatedItem,
    })
    // A habit already done today must not be re-armed for today's occurrence.
    const timingOptions: ReminderTimingOptions | undefined =
      type === 'habit' && completedToday ? { occurrenceAfter: endOfLocalDay(new Date()) } : undefined
    if (reminderPreset !== 'none' && !keepExistingReminder) {
      const preview = previewReminder(reminderPreset, updatedItem, exactIso, new Date(), timingOptions)
      if (preview.error) return setError(preview.error)
    }

    try {
      setBusy(true)
      setError(null)
      await onSubmit(item.id, {
        name: trimmed,
        description: description.trim() || null,
        type,
        priority,
        due_date: dueDate || null,
        // Only send progress fields the user actually changed, so a rename or description
        // edit can never rewrite today's count or completion history.
        ...(targetCount !== Math.max(1, item.target_count ?? 1) ? { target_count: targetCount } : {}),
        ...(currentCount !== effectiveCurrentCount(item, completedToday) ? { current_count: currentCount } : {}),
        unit: unit.trim() || null,
        schedule: scheduleInput,
      })

      if (effectiveUserId) {
        try {
          if (reminderPreset === 'none') {
            cancelReminderForItem(effectiveUserId, item.id)
          } else if (keepExistingReminder) {
            // Same time: only refresh the name/plan shown on the reminder.
            refreshReminderItemDetails(effectiveUserId, updatedItem)
          } else {
            // New preset, changed custom time, or a due/schedule-relative reminder whose
            // target moved: recompute it.
            setReminderForItem(effectiveUserId, updatedItem, reminderPreset, exactIso, new Date(), timingOptions)
          }
        } catch (reminderErr) {
          showToast({
            title: 'Item saved, reminder not set',
            message: reminderErr instanceof Error ? reminderErr.message : 'The reminder could not be saved.',
            type: 'warning',
          })
        }
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Edit Execution Item"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="form" style={{ gap: 'var(--space-3)' }} noValidate>
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <Select
          label="Item type"
          value={type}
          onChange={(e) => setType(e.target.value as ItemType)}
          hint="Changing a habit to another type removes its recurring schedule."
        >
          <option value="task">Task (action to be done)</option>
          <option value="habit">Habit (recurring routine)</option>
          <option value="checklist">Checklist item (quick verification)</option>
          <option value="milestone">Milestone (key target)</option>
          <option value="project">Project (larger initiative)</option>
        </Select>

        <Input label="Title" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} required />

        <Textarea
          label="Description (optional)"
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
              <Select label="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as HabitFrequency)}>
                <option value="daily">Every day</option>
                <option value="weekly">Weekly (chosen days)</option>
                <option value="custom">Custom days</option>
                {item.schedule?.frequency === 'monthly' && <option value="monthly">Monthly (current schedule)</option>}
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
            {needsActiveDays(frequency) && <DayPicker value={daysOfWeek} onToggle={toggleDay} />}
          </div>
        )}

        <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
          <Input
            label="Completed quantity"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            hint={type === 'habit' ? "Today's count" : 'Current progress (min 0)'}
          />
          <Input
            label="Target quantity"
            type="number"
            inputMode="numeric"
            min="1"
            max={String(MAX_TARGET)}
            step="1"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            hint="Target amount (min 1)"
          />
        </div>

        <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
          <Input label="Unit (optional)" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={30} />
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as ItemPriority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>

        <Input label="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        <ReminderFields
          preset={reminderPreset}
          onPresetChange={setReminderPreset}
          exactTime={exactReminderTime}
          onExactTimeChange={setExactReminderTime}
          showHabitTime={type === 'habit'}
          habitTime={habitReminderTime}
          onHabitTimeChange={setHabitReminderTime}
          hint={reminderHint(reminderPreset, Boolean(dueDate), type === 'habit')}
        />
      </form>
    </Modal>
  )
}

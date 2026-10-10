import { useEffect, useState } from 'react'
import type { ExecutionItem, ItemPriority, ItemType, UpdateExecutionItemInput } from '@/types/domain'
import type { ReminderPreset } from '@/types/notifications'
import { getReminderForItem, setReminderForItem, cancelReminderForItem } from '@/services/reminderService'
import { Button, Input, Modal, Select, Textarea } from '@/components/ui'

interface EditItemModalProps {
  open: boolean
  onClose: () => void
  item: ExecutionItem | null
  onSubmit: (itemId: string, input: UpdateExecutionItemInput) => Promise<void>
}

export function EditItemModal({
  open,
  onClose,
  item,
  onSubmit,
}: EditItemModalProps) {
  const [type, setType] = useState<ItemType>('task')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<ItemPriority>('medium')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5])
  const [timeOfDay, setTimeOfDay] = useState<'anytime' | 'morning' | 'afternoon' | 'evening'>('anytime')
  const [dueDate, setDueDate] = useState('')
  const [targetCount, setTargetCount] = useState<number>(1)
  const [currentCount, setCurrentCount] = useState<number>(0)
  const [unit, setUnit] = useState<string>('')
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>('none')
  const [exactReminderTime, setExactReminderTime] = useState<string>('')
  const [habitReminderTime, setHabitReminderTime] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (item) {
      setType(item.type)
      setName(item.name)
      setDescription(item.description || '')
      setPriority(item.priority || 'medium')
      setDueDate(item.due_date || '')
      setTargetCount(Math.max(1, item.target_count ?? 1))
      setCurrentCount(Math.max(0, item.current_count ?? 0))
      setUnit(item.unit || '')
      if (item.schedule) {
        setFrequency(item.schedule.frequency === 'monthly' ? 'custom' : item.schedule.frequency)
        setDaysOfWeek(item.schedule.days_of_week || [1, 2, 3, 4, 5])
        setTimeOfDay((item.schedule.time_of_day as any) || 'anytime')
        setHabitReminderTime(item.schedule.reminder_time?.slice(0, 5) || '')
      } else {
        setFrequency('daily')
        setDaysOfWeek([1, 2, 3, 4, 5])
        setTimeOfDay('anytime')
        setHabitReminderTime('')
      }

      if (item.user_id) {
        const existingRem = getReminderForItem(item.user_id, item.id)
        if (existingRem) {
          setReminderPreset(existingRem.preset)
          setExactReminderTime(existingRem.preset === 'exact_time' ? existingRem.remindAt.slice(0, 16) : '')
        } else if (item.schedule?.reminder_time) {
          setReminderPreset('scheduled_time')
          setExactReminderTime('')
        } else {
          setReminderPreset('none')
          setExactReminderTime('')
        }
      }

      setError(null)
    }
  }, [item, open])

  if (!item) return null

  const toggleDay = (dayIndex: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort(),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Item name is required.')
      return
    }

    try {
      setBusy(true)
      setError(null)
      const scheduleInput =
        type === 'habit'
          ? {
              frequency,
              days_of_week: frequency === 'daily' ? null : daysOfWeek,
              time_of_day: timeOfDay,
              reminder_time: habitReminderTime || null,
            }
          : null

      await onSubmit(item.id, {
        name: name.trim(),
        description: description.trim() || null,
        type,
        priority,
        due_date: dueDate || null,
        target_count: Math.max(1, targetCount),
        current_count: Math.max(0, currentCount),
        unit: unit.trim() || null,
        schedule: scheduleInput,
      })

      if (item.user_id) {
        if (reminderPreset !== 'none') {
          const updatedItem = {
            ...item,
            name: name.trim(),
            due_date: dueDate || null,
            schedule: scheduleInput ? ({ ...item.schedule, ...scheduleInput } as any) : null,
          }
          setReminderForItem(
            item.user_id,
            updatedItem,
            reminderPreset,
            reminderPreset === 'exact_time' ? exactReminderTime : undefined,
          )
        } else {
          cancelReminderForItem(item.user_id, item.id)
        }
      }

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item')
    } finally {
      setBusy(false)
    }
  }

  const DAYS = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Execution Item"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="form" style={{ gap: 'var(--space-3)' }}>
        {error && <div className="alert alert--error">{error}</div>}

        <Select
          label="Item Type"
          value={type}
          onChange={(e) => setType(e.target.value as ItemType)}
          hint="Habit, Task, Checklist item, Project, or Milestone"
        >
          <option value="task">Task (Action to be done)</option>
          <option value="habit">Habit (Recurring routine)</option>
          <option value="checklist">Checklist Item (Quick verification)</option>
          <option value="milestone">Milestone (Key target/marker)</option>
          <option value="project">Project (Initiative with sub-steps)</option>
        </Select>

        <Input
          label="Title"
          placeholder="e.g. 5km morning run, complete portfolio draft"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Textarea
          label="Description (Optional)"
          placeholder="Add context, parameters, or details..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
              Habit Recurrence Schedule
            </span>
            <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
              <Select
                label="Frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'custom')}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom Days</option>
              </Select>

              <Select
                label="Time of Day"
                value={timeOfDay}
                onChange={(e) =>
                  setTimeOfDay(e.target.value as 'anytime' | 'morning' | 'afternoon' | 'evening')
                }
              >
                <option value="anytime">Anytime</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </Select>
            </div>

            {frequency !== 'daily' && (
              <div>
                <label className="field__label" style={{ display: 'block', marginBottom: '6px' }}>
                  Active Days
                </label>
                <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
                  {DAYS.map((day) => {
                    const selected = daysOfWeek.includes(day.value)
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`btn btn--sm ${selected ? 'btn--primary' : 'btn--ghost'}`}
                        style={{
                          minWidth: '42px',
                          padding: '4px 8px',
                          fontSize: 'var(--text-caption)',
                        }}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
          <Input
            label="Current Completed Quantity"
            type="number"
            min="0"
            step="1"
            value={currentCount}
            onChange={(e) => setCurrentCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
            hint="Current progress count (min 0)"
          />

          <Input
            label="Target Quantity"
            type="number"
            min="1"
            step="1"
            value={targetCount}
            onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            hint="Target amount (min 1)"
          />
        </div>

        <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
          <Input
            label="Unit (Optional)"
            placeholder="e.g. reps, pages, km, min, glasses"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            hint="Measurement unit"
          />

          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as ItemPriority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>

        <div>
          <Input
            label="Due Date (Optional)"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

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
            Smart Reminders
          </span>
          <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
            <Select
              label="Reminder Preset"
              value={reminderPreset}
              onChange={(e) => setReminderPreset(e.target.value as ReminderPreset)}
            >
              <option value="none">No reminder</option>
              <option value="10m">10 minutes before</option>
              <option value="30m">30 minutes before</option>
              <option value="1h">1 hour before</option>
              <option value="2h">2 hours before</option>
              <option value="scheduled_time">At scheduled time</option>
              <option value="exact_time">Custom date & time</option>
            </Select>

            {reminderPreset === 'exact_time' && (
              <Input
                label="Reminder Date & Time"
                type="datetime-local"
                value={exactReminderTime}
                onChange={(e) => setExactReminderTime(e.target.value)}
                required
              />
            )}

            {type === 'habit' && reminderPreset === 'scheduled_time' && (
              <Input
                label="Scheduled Reminder Time"
                type="time"
                value={habitReminderTime}
                onChange={(e) => setHabitReminderTime(e.target.value)}
              />
            )}
          </div>
        </div>
      </form>
    </Modal>
  )
}

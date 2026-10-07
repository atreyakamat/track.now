import { useState } from 'react'
import type { ItemPriority, ItemType, NewExecutionItemInput } from '@/types/domain'
import { Button, Input, Modal, Select, Textarea } from '@/components/ui'

interface CreateItemModalProps {
  open: boolean
  onClose: () => void
  planId: string
  trackId: string
  defaultType?: ItemType
  onSubmit: (input: NewExecutionItemInput) => Promise<void>
}

export function CreateItemModal({
  open,
  onClose,
  planId,
  trackId,
  defaultType = 'task',
  onSubmit,
}: CreateItemModalProps) {
  const [type, setType] = useState<ItemType>(defaultType)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<ItemPriority>('medium')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5])
  const [timeOfDay, setTimeOfDay] = useState<'anytime' | 'morning' | 'afternoon' | 'evening'>('anytime')
  const [dueDate, setDueDate] = useState('')
  const [targetCount, setTargetCount] = useState<number>(1)
  const [unit, setUnit] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
      await onSubmit({
        plan_id: planId,
        track_id: trackId,
        type,
        name: name.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        target_count: targetCount,
        current_count: 0,
        unit: unit.trim() || null,
        schedule:
          type === 'habit'
            ? {
                frequency,
                days_of_week: frequency === 'daily' ? null : daysOfWeek,
                time_of_day: timeOfDay,
              }
            : null,
      })
      setName('')
      setDescription('')
      setDueDate('')
      setTargetCount(1)
      setUnit('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item')
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
      title="Add Execution Item"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Adding…' : 'Add Item'}
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
              background: 'var(--bg-secondary)',
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
            label="Target Quantity"
            type="number"
            min="1"
            step="1"
            value={targetCount}
            onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            hint="Amount to complete (default 1)"
          />

          <Input
            label="Unit (Optional)"
            placeholder="e.g. reps, pages, km, min, glasses"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            hint="Measurement unit"
          />
        </div>

        <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
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

          <Input
            label="Due Date (Optional)"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}

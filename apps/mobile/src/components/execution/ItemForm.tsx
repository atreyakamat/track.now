import { useState } from 'react'
import { View } from 'react-native'
import type {
  ItemPriority,
  ItemSchedule,
  ItemType,
  NewExecutionItemInput,
  UpdateExecutionItemInput,
} from '@tracknow/core/types/domain'
import {
  DAYS,
  buildHabitScheduleInput,
  needsActiveDays,
  type HabitFrequency,
  type TimeOfDayChoice,
} from '@tracknow/core/domain/habitSchedule'
import type { ReminderPreset } from '@tracknow/core/types/notifications'
import { Button, Card, ChoiceChips, DateField, Text, TextField } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

const MAX_NAME = 200
const MAX_TARGET = 100000

const TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'habit', label: 'Habit' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'project', label: 'Project' },
]

const PRIORITY_OPTIONS: { value: ItemPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const FREQUENCY_OPTIONS: { value: HabitFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom days' },
]

const TIME_OF_DAY_OPTIONS: { value: TimeOfDayChoice; label: string }[] = [
  { value: 'anytime', label: 'Anytime' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
]

export interface ItemFormInitial {
  type: ItemType
  name: string
  description: string
  priority: ItemPriority
  dueDate: string | null
  target: number
  unit: string
  frequency: HabitFrequency
  daysOfWeek: number[]
  timeOfDay: TimeOfDayChoice
  habitTime: string
  /** The habit's existing schedule, so a legacy monthly cadence is preserved on edit. */
  originalSchedule?: Pick<ItemSchedule, 'frequency' | 'days_of_week'> | null
  /** The item's existing reminder preset (edit flow), or 'none'. */
  reminderPreset?: ReminderPreset
}

export function defaultItemForm(type: ItemType = 'task'): ItemFormInitial {
  return {
    type,
    name: '',
    description: '',
    priority: 'medium',
    dueDate: null,
    target: 1,
    unit: '',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5],
    timeOfDay: 'anytime',
    habitTime: '',
    originalSchedule: null,
    reminderPreset: 'none',
  }
}

interface ItemFormProps {
  initial: ItemFormInitial
  submitLabel: string
  busy?: boolean
  /** Lock the type selector (create flow may fix it; edit allows changing). */
  allowTypeChange?: boolean
  onSubmit: (payload: {
    base: Omit<NewExecutionItemInput, 'plan_id' | 'track_id'> & UpdateExecutionItemInput
    reminderPreset: ReminderPreset
  }) => void
}

/** Builds the shared base payload (used for both create and edit) from the form fields. */
export function ItemForm({ initial, submitLabel, busy, allowTypeChange = true, onSubmit }: ItemFormProps) {
  const { colors } = useTheme()
  const [type, setType] = useState<ItemType>(initial.type)
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [priority, setPriority] = useState<ItemPriority>(initial.priority)
  const [dueDate, setDueDate] = useState<string | null>(initial.dueDate)
  const [targetInput, setTargetInput] = useState(String(initial.target))
  const [unit, setUnit] = useState(initial.unit)
  const [frequency, setFrequency] = useState<HabitFrequency>(initial.frequency)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initial.daysOfWeek)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayChoice>(initial.timeOfDay)
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>(initial.reminderPreset ?? 'none')
  const [error, setError] = useState<string | null>(null)

  const isHabit = type === 'habit'
  const hasDueOrSchedule = isHabit || Boolean(dueDate)

  // "From now" presets always work; relative presets need a due date or habit schedule.
  const reminderOptions: { value: ReminderPreset; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: '30m_in', label: 'In 30m' },
    { value: '1h_in', label: 'In 1h' },
    { value: '2h_in', label: 'In 2h' },
    ...(hasDueOrSchedule
      ? ([
          { value: 'scheduled_time', label: 'At time' },
          { value: '1h_before', label: '1h before' },
        ] as { value: ReminderPreset; label: string }[])
      : []),
  ]

  const toggleDay = (day: number) =>
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    if (trimmed.length > MAX_NAME) {
      setError(`Name must be ${MAX_NAME} characters or fewer.`)
      return
    }
    const target = Math.max(1, Math.min(MAX_TARGET, Math.round(Number(targetInput) || 1)))
    if (isHabit && needsActiveDays(frequency) && daysOfWeek.length === 0) {
      setError('Pick at least one active day for this habit.')
      return
    }
    setError(null)

    const schedule = isHabit
      ? buildHabitScheduleInput({ frequency, daysOfWeek, timeOfDay, habitTime: initial.habitTime, original: initial.originalSchedule })
      : null

    // A relative preset that no longer applies (e.g. due date cleared) falls back to none.
    const effectivePreset = reminderOptions.some((o) => o.value === reminderPreset) ? reminderPreset : 'none'

    onSubmit({
      base: {
        type,
        name: trimmed,
        description: description.trim() || null,
        priority,
        due_date: isHabit ? null : dueDate,
        target_count: target,
        unit: unit.trim() || null,
        schedule,
      },
      reminderPreset: effectivePreset,
    })
  }

  return (
    <View style={{ gap: spacing[4] }}>
      {error ? (
        <Card style={{ borderColor: colors.danger }}>
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        </Card>
      ) : null}

      {allowTypeChange ? (
        <ChoiceChips label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />
      ) : null}

      <TextField label="Name" value={name} onChangeText={setName} placeholder="What needs doing?" maxLength={MAX_NAME} />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Optional details"
        multiline
        numberOfLines={3}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />

      <ChoiceChips label="Priority" options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />

      {!isHabit ? (
        <DateField label="Due date" value={dueDate} onChange={setDueDate} clearable placeholder="No due date" />
      ) : null}

      <View style={{ gap: spacing[3] }}>
        <Text variant="meta" tone="tertiary">
          {isHabit ? 'Habit target (per day)' : 'Target count (optional)'}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Target"
              value={targetInput}
              onChangeText={setTargetInput}
              keyboardType="number-pad"
              inputMode="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Unit" value={unit} onChangeText={setUnit} placeholder="e.g. reps, pages" />
          </View>
        </View>
      </View>

      {isHabit ? (
        <View style={{ gap: spacing[3] }}>
          <ChoiceChips label="Repeat" options={FREQUENCY_OPTIONS} value={frequency} onChange={setFrequency} />
          {needsActiveDays(frequency) ? (
            <ChoiceChips
              label="Active days"
              multi
              options={DAYS.map((d) => ({ value: d.value, label: d.label }))}
              value={daysOfWeek}
              onChange={toggleDay}
            />
          ) : null}
          <ChoiceChips label="Time of day" options={TIME_OF_DAY_OPTIONS} value={timeOfDay} onChange={setTimeOfDay} />
        </View>
      ) : null}

      <View style={{ gap: spacing[1] }}>
        <ChoiceChips label="Reminder" options={reminderOptions} value={reminderPreset} onChange={setReminderPreset} />
        <Text variant="meta" tone="tertiary">
          {reminderPreset === 'none'
            ? 'No reminder.'
            : 'Fires as a notification. Works even when the app is closed on a dev build.'}
        </Text>
      </View>

      <Button title={submitLabel} block loading={busy} onPress={submit} />
    </View>
  )
}

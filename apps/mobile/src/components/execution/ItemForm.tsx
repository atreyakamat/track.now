import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import type {
  ChecklistEntry,
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
import { MAX_CHECKLIST_ENTRIES, MAX_CHECKLIST_LABEL, newChecklistEntryId, normalizeChecklistEntries } from '@tracknow/core/domain/checklist'
import type { ReminderPreset } from '@tracknow/core/types/notifications'
import { Button, Card, ChoiceChips, DateField, Text, TextField } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

const MAX_NAME = 200
const MAX_TARGET = 100000

/** The habit "Repeat" choice: fixed days, or a weekly target on any days ("3× a week"). */
export type RepeatChoice = HabitFrequency | 'flexible'

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

const REPEAT_OPTIONS: { value: RepeatChoice; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom days' },
  { value: 'flexible', label: 'Times a week' },
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
  /** Day the item begins; before it, it is Upcoming only. */
  startDate: string | null
  target: number
  unit: string
  repeat: RepeatChoice
  daysOfWeek: number[]
  timesPerWeek: number
  timeOfDay: TimeOfDayChoice
  habitTime: string
  /** Checklist steps (checklists only). */
  steps: ChecklistEntry[]
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
    startDate: null,
    target: 1,
    unit: '',
    repeat: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5],
    timesPerWeek: 3,
    timeOfDay: 'anytime',
    habitTime: '',
    steps: [],
    originalSchedule: null,
    reminderPreset: 'none',
  }
}

export function repeatChoiceOf(schedule: { frequency: string; times_per_week?: number | null } | null | undefined): RepeatChoice {
  if (!schedule) return 'daily'
  if (schedule.times_per_week) return 'flexible'
  return (['daily', 'weekly', 'custom', 'monthly'].includes(schedule.frequency) ? schedule.frequency : 'daily') as RepeatChoice
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

function StepsEditor({ value, onChange }: { value: ChecklistEntry[]; onChange: (next: ChecklistEntry[]) => void }) {
  const { colors } = useTheme()
  return (
    <View style={{ gap: spacing[2] }}>
      <Text variant="caption" weight="medium">
        Steps (optional)
      </Text>
      {value.map((step, i) => (
        <View key={step.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <Pressable
            onPress={() => onChange(value.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s)))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: step.done }}
            accessibilityLabel={`Step ${i + 1} done`}
            hitSlop={6}
          >
            <Feather name={step.done ? 'check-square' : 'square'} size={18} color={step.done ? colors.success : colors.textSecondary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <TextField
              value={step.label}
              onChangeText={(t) => onChange(value.map((s) => (s.id === step.id ? { ...s, label: t } : s)))}
              placeholder={`Step ${i + 1}`}
              maxLength={MAX_CHECKLIST_LABEL}
              accessibilityLabel={`Step ${i + 1}`}
            />
          </View>
          <Pressable onPress={() => onChange(value.filter((s) => s.id !== step.id))} hitSlop={6} accessibilityLabel={`Remove step ${i + 1}`}>
            <Feather name="x" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      ))}
      {value.length < MAX_CHECKLIST_ENTRIES ? (
        <Button
          title="Add step"
          variant="secondary"
          size="sm"
          icon={<Feather name="plus" size={14} color={colors.textPrimary} />}
          onPress={() => onChange([...value, { id: newChecklistEntryId(), label: '', done: false }])}
        />
      ) : null}
    </View>
  )
}

/** Builds the shared base payload (used for both create and edit) from the form fields. */
export function ItemForm({ initial, submitLabel, busy, allowTypeChange = true, onSubmit }: ItemFormProps) {
  const { colors } = useTheme()
  const [type, setType] = useState<ItemType>(initial.type)
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [priority, setPriority] = useState<ItemPriority>(initial.priority)
  const [dueDate, setDueDate] = useState<string | null>(initial.dueDate)
  const [startDate, setStartDate] = useState<string | null>(initial.startDate)
  const [targetInput, setTargetInput] = useState(String(initial.target))
  const [unit, setUnit] = useState(initial.unit)
  const [repeat, setRepeat] = useState<RepeatChoice>(initial.repeat)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initial.daysOfWeek)
  const [timesPerWeek, setTimesPerWeek] = useState(initial.timesPerWeek)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayChoice>(initial.timeOfDay)
  const [steps, setSteps] = useState<ChecklistEntry[]>(initial.steps)
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>(initial.reminderPreset ?? 'none')
  const [error, setError] = useState<string | null>(null)

  const isHabit = type === 'habit'
  const hasDueOrSchedule = isHabit || Boolean(dueDate)

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
    if (!trimmed) return setError('Name is required.')
    if (trimmed.length > MAX_NAME) return setError(`Name must be ${MAX_NAME} characters or fewer.`)
    const target = Math.max(1, Math.min(MAX_TARGET, Math.round(Number(targetInput) || 1)))
    const fixedRepeat = repeat === 'flexible' ? null : repeat
    if (isHabit && fixedRepeat && needsActiveDays(fixedRepeat) && daysOfWeek.length === 0) {
      return setError('Pick at least one active day for this habit.')
    }
    if (startDate && dueDate && !isHabit && dueDate < startDate) return setError('The due date cannot be before the start date.')
    setError(null)

    const schedule = isHabit
      ? repeat === 'flexible'
        ? {
            frequency: 'weekly' as const,
            days_of_week: null,
            time_of_day: timeOfDay,
            reminder_time: initial.habitTime || null,
            times_per_week: Math.min(7, Math.max(1, Math.round(timesPerWeek))),
          }
        : {
            ...buildHabitScheduleInput({
              frequency: repeat,
              daysOfWeek,
              timeOfDay,
              habitTime: initial.habitTime,
              original: initial.originalSchedule,
            }),
            times_per_week: null,
          }
      : null

    const effectivePreset = reminderOptions.some((o) => o.value === reminderPreset) ? reminderPreset : 'none'
    const entries = type === 'checklist' ? normalizeChecklistEntries(steps.filter((s) => s.label.trim())) : null

    onSubmit({
      base: {
        type,
        name: trimmed,
        description: description.trim() || null,
        priority,
        due_date: isHabit ? null : dueDate,
        start_date: startDate,
        target_count: target,
        unit: unit.trim() || null,
        checklist_entries: entries && entries.length ? entries : null,
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

      {allowTypeChange ? <ChoiceChips label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} /> : null}

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

      {!isHabit ? <DateField label="Due date" value={dueDate} onChange={setDueDate} clearable placeholder="No due date" /> : null}
      <DateField label="Starts on (optional)" value={startDate} onChange={setStartDate} clearable placeholder="Right away" />
      {startDate ? (
        <Text variant="meta" tone="tertiary">
          Until then it is Upcoming and never counts as missed.
        </Text>
      ) : null}

      {type === 'checklist' ? <StepsEditor value={steps} onChange={setSteps} /> : null}

      <View style={{ gap: spacing[3] }}>
        <Text variant="meta" tone="tertiary">
          {isHabit ? 'Habit target (per day)' : 'Target count (optional)'}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <TextField label="Target" value={targetInput} onChangeText={setTargetInput} keyboardType="number-pad" inputMode="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Unit" value={unit} onChangeText={setUnit} placeholder="e.g. reps, pages" />
          </View>
        </View>
      </View>

      {isHabit ? (
        <View style={{ gap: spacing[3] }}>
          <ChoiceChips label="Repeat" options={REPEAT_OPTIONS} value={repeat} onChange={setRepeat} />
          {repeat === 'flexible' ? (
            <ChoiceChips
              label="Sessions per week (any days, Mon–Sun)"
              options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: `${n}×` }))}
              value={timesPerWeek}
              onChange={setTimesPerWeek}
            />
          ) : needsActiveDays(repeat) ? (
            <ChoiceChips label="Active days" multi options={DAYS.map((d) => ({ value: d.value, label: d.label }))} value={daysOfWeek} onChange={toggleDay} />
          ) : null}
          <ChoiceChips label="Time of day" options={TIME_OF_DAY_OPTIONS} value={timeOfDay} onChange={setTimeOfDay} />
        </View>
      ) : null}

      <View style={{ gap: spacing[1] }}>
        <ChoiceChips label="Reminder" options={reminderOptions} value={reminderPreset} onChange={setReminderPreset} />
        <Text variant="meta" tone="tertiary">
          {reminderPreset === 'none' ? 'No reminder.' : 'Fires as a notification. Works even when the app is closed on a dev build.'}
        </Text>
      </View>

      <Button title={submitLabel} block loading={busy} onPress={submit} />
    </View>
  )
}

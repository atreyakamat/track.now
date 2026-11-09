import { Feather } from '@expo/vector-icons'
import { memo, useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import { getTodayDateString, isOverdue } from '@tracknow/core/domain/dates'
import { checklistProgress, effectiveHabitSteps } from '@tracknow/core/domain/checklist'
import { DAYS } from '@tracknow/core/domain/habitSchedule'
import { weeklyTarget } from '@tracknow/core/domain/schedule'
import { effectiveCurrentCount } from '@tracknow/core/domain/habitCounter'
import type { HabitStreakSummary } from '@tracknow/core/domain/streaks'
import { formatReminderLabel, getReminderForItem } from '@tracknow/core/services/reminderService'
import { onAppEvent } from '@tracknow/core/platform/events'
import { Badge, Card, Text } from '@/components/ui'
import { Pop, PressScale } from '@/components/ui/Motion'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

interface ExecutionItemCardProps {
  item: ExecutionItem
  onToggle: (item: ExecutionItem) => void
  onStep?: (item: ExecutionItem, delta: number) => void
  onEdit?: (item: ExecutionItem) => void
  onDelete?: (item: ExecutionItem) => void
  onOpenDetail?: (item: ExecutionItem) => void
  onSnooze?: (itemId: string, minutes?: number) => void
  onRemoveReminder?: (itemId: string) => void
  busy?: boolean
  isCompletedOverride?: boolean
  streakSummary?: HabitStreakSummary | null
  /** Weekly-target habits: sessions done this week. */
  weekDone?: number
  /** Parent Plan ("Gym routine · Health") shown on Today. */
  context?: { label: string; onPress: () => void } | null
  /** Today focus star. */
  focused?: boolean
  onToggleFocus?: (item: ExecutionItem) => void
  onToggleChecklistEntry?: (item: ExecutionItem, entryId: string) => void
  /** Opens the reschedule / skip sheet. */
  onMore?: (item: ExecutionItem) => void
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/** "Daily", "Mon · Wed · Fri", "3× a week" — the schedule in plain words. */
export function scheduleLabel(schedule: ExecutionItem['schedule']): string | null {
  if (!schedule) return null
  const target = weeklyTarget(schedule)
  if (target !== null) return `${target}× a week`
  if (schedule.frequency === 'daily') return 'Daily'
  const days = schedule.days_of_week ?? []
  if ((schedule.frequency === 'weekly' || schedule.frequency === 'custom') && days.length && days.length < 7) {
    return [1, 2, 3, 4, 5, 6, 0]
      .filter((d) => days.includes(d))
      .map((d) => DAYS[d].label)
      .join(' · ')
  }
  return schedule.frequency === 'monthly' ? 'Monthly' : 'Daily'
}

function IconButton({ name, label, onPress, disabled, active, color }: { name: React.ComponentProps<typeof Feather>['name']; label: string; onPress: () => void; disabled?: boolean; active?: boolean; color?: string }) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <Feather name={name} size={16} color={color ?? (active ? colors.textPrimary : colors.textSecondary)} />
    </Pressable>
  )
}

function ExecutionItemCardImpl({
  item,
  onToggle,
  onStep,
  onEdit,
  onDelete,
  onOpenDetail,
  onSnooze,
  onRemoveReminder,
  busy,
  isCompletedOverride,
  streakSummary,
  weekDone,
  context,
  focused,
  onToggleFocus,
  onToggleChecklistEntry,
  onMore,
}: ExecutionItemCardProps) {
  const { colors } = useTheme()
  const isDone = isCompletedOverride !== undefined ? isCompletedOverride : item.status === 'done'
  const overdue = item.type !== 'habit' && !isDone && isOverdue(item.due_date)
  const targetCount = Math.max(1, item.target_count ?? 1)
  const currentCount = effectiveCurrentCount(item, isDone)
  const entries =
    item.type === 'checklist'
      ? (item.checklist_entries ?? [])
      : item.type === 'habit'
        ? effectiveHabitSteps(item, getTodayDateString(), isDone)
        : []
  // A routine's progress is its ticked steps, not a counter.
  const hasNumericTarget = (targetCount > 1 || Boolean(item.unit)) && !(item.type === 'habit' && entries.length > 0)
  const progressPercent = Math.min(100, Math.round((currentCount / targetCount) * 100))
  const steps = checklistProgress(entries)
  const notStarted = Boolean(item.start_date && item.start_date > getTodayDateString())
  const weekTarget = item.type === 'habit' ? weeklyTarget(item.schedule) : null
  const streakUnit = streakSummary?.streakUnit === 'weeks' ? 'w' : 'd'
  const schedule = scheduleLabel(item.schedule)

  const [, setRev] = useState(0)
  useEffect(() => {
    const bump = () => setRev((v) => v + 1)
    const offA = onAppEvent('tracknow:reminders-updated', bump)
    const offB = onAppEvent('tracknow:reminder-fired', bump)
    return () => {
      offA()
      offB()
    }
  }, [])

  const activeReminder = item.user_id && !isDone ? getReminderForItem(item.user_id, item.id) : null

  const priorityColor =
    item.priority === 'urgent'
      ? colors.danger
      : item.priority === 'high'
        ? colors.warning
        : item.priority === 'low'
          ? colors.textTertiary
          : colors.textSecondary

  const meta = (icon: React.ComponentProps<typeof Feather>['name'], text: string, color = colors.textSecondary) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Feather name={icon} size={12} color={color} />
      <Text variant="meta" style={{ color, textTransform: 'none', letterSpacing: 0 }}>
        {text}
      </Text>
    </View>
  )

  return (
    <Card tone={isDone ? 'muted' : 'surface'} style={{ gap: spacing[2], padding: spacing[3], borderColor: focused && !isDone ? colors.accentPrimary : colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] }}>
        <PressScale
          onPress={() => onToggle(item)}
          disabled={busy}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isDone }}
          accessibilityLabel={isDone ? `Mark ${item.name} incomplete` : `Mark ${item.name} done`}
          hitSlop={10}
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: isDone ? colors.controlBg : colors.borderStrong,
            backgroundColor: isDone ? colors.controlBg : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
          }}
        >
          <Pop active={isDone}>{isDone ? <Feather name="check" size={16} color={colors.controlText} /> : null}</Pop>
        </PressScale>

        <View style={{ flex: 1, gap: spacing[1] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
            <Text
              variant="h3"
              tone={isDone ? 'secondary' : 'primary'}
              style={{ textDecorationLine: isDone ? 'line-through' : 'none', flexShrink: 1 }}
              numberOfLines={2}
            >
              {item.name}
            </Text>
            <Badge label={item.type} />
            {item.type === 'habit' && streakSummary && streakSummary.currentStreak > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 2,
                  borderRadius: radius.pill,
                  backgroundColor: streakSummary.isActiveStreak ? colors.accentPrimary : colors.surfaceMuted,
                }}
              >
                <Feather name="zap" size={11} color={streakSummary.isActiveStreak ? colors.accentPrimaryText : colors.textSecondary} />
                <Text variant="meta" style={{ color: streakSummary.isActiveStreak ? colors.accentPrimaryText : colors.textSecondary }}>
                  {streakSummary.currentStreak}
                  {streakUnit}
                </Text>
              </View>
            ) : null}
            {item.priority !== 'medium' ? (
              <Text variant="meta" style={{ color: priorityColor }}>
                {item.priority}
              </Text>
            ) : null}
          </View>

          {item.description ? (
            <Text variant="caption" tone="secondary" numberOfLines={4}>
              {item.description}
            </Text>
          ) : null}

          {entries.length > 0 ? (
            <View style={{ gap: 2, marginTop: 2 }} accessibilityLabel={`${item.name} steps, ${steps.done} of ${steps.total} done`}>
              {entries.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => onToggleChecklistEntry?.(item, e.id)}
                  disabled={busy || !onToggleChecklistEntry}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: e.done }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 32 }}
                >
                  <Pop active={e.done}>
                    <Feather name={e.done ? 'check-square' : 'square'} size={16} color={e.done ? colors.success : colors.textSecondary} />
                  </Pop>
                  <Text variant="caption" tone={e.done ? 'secondary' : 'primary'} style={{ flex: 1, textDecorationLine: e.done ? 'line-through' : 'none' }}>
                    {e.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[3] }}>
            {context ? (
              <Pressable onPress={context.onPress} hitSlop={4} accessibilityRole="link" accessibilityLabel={`Open ${context.label}`}>
                <Text variant="meta" tone="secondary" style={{ textTransform: 'none', letterSpacing: 0, textDecorationLine: 'underline' }}>
                  {context.label}
                </Text>
              </Pressable>
            ) : null}
            {notStarted && item.start_date ? meta('clock', `Starts ${fmtDay(item.start_date)}`) : null}
            {entries.length > 0 ? meta('list', `${steps.done}/${steps.total} steps`) : null}
            {weekTarget !== null && weekDone !== undefined
              ? meta('repeat', `${Math.min(weekDone, weekTarget)}/${weekTarget} this week`, weekDone >= weekTarget ? colors.success : colors.textSecondary)
              : null}
            {item.due_date && item.type !== 'habit' ? meta('calendar', `${item.due_date}${overdue ? ' · Overdue' : ''}`, overdue ? colors.danger : colors.textSecondary) : null}
            {schedule ? meta('repeat', `${schedule}${item.schedule?.time_of_day && item.schedule.time_of_day !== 'anytime' ? ` · ${item.schedule.time_of_day}` : ''}`) : null}
            {item.schedule?.reminder_time ? meta('clock', item.schedule.reminder_time.slice(0, 5)) : null}
          </View>

          {activeReminder ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[1],
                alignSelf: 'flex-start',
                paddingVertical: 2,
                paddingHorizontal: spacing[2],
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: activeReminder.status === 'snoozed' ? colors.warning : colors.border,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Feather name="bell" size={12} color={activeReminder.status === 'snoozed' ? colors.warning : colors.textSecondary} />
              <Pressable onPress={() => onEdit?.(item)} hitSlop={6}>
                <Text variant="meta" weight="semibold">
                  {formatReminderLabel(activeReminder)}
                </Text>
              </Pressable>
              <Pressable onPress={() => onSnooze?.(item.id, 10)} hitSlop={6} style={{ paddingHorizontal: 2 }}>
                <Text variant="meta" weight="semibold" tone="secondary">
                  +10m
                </Text>
              </Pressable>
              <Pressable onPress={() => onRemoveReminder?.(item.id)} hitSlop={6} accessibilityLabel="Remove reminder">
                <Feather name="x" size={12} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : !isDone && onEdit ? (
            <Pressable onPress={() => onEdit(item)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
              <Feather name="bell" size={11} color={colors.textTertiary} />
              <Text variant="meta" tone="tertiary">
                Remind
              </Text>
            </Pressable>
          ) : null}

          {hasNumericTarget ? (
            <View style={{ marginTop: 2, height: 3, maxWidth: 180, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: isDone ? colors.success : colors.controlBg }} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing[1] }}>
        {hasNumericTarget ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[1],
              backgroundColor: colors.surfaceMuted,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing[1],
              marginRight: 'auto',
            }}
          >
            <PressScale
              onPress={() => onStep?.(item, -1)}
              disabled={busy || currentCount <= 0}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${item.name} count`}
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: currentCount <= 0 ? 0.4 : 1 }}
            >
              <Feather name="minus" size={16} color={colors.textPrimary} />
            </PressScale>
            <Text variant="caption" weight="semibold" style={{ minWidth: 56, textAlign: 'center' }}>
              {currentCount}/{targetCount} {item.unit ?? ''}
            </Text>
            <PressScale
              onPress={() => onStep?.(item, 1)}
              disabled={busy}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Increase ${item.name} count`}
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name="plus" size={16} color={colors.textPrimary} />
            </PressScale>
          </View>
        ) : null}

        {onToggleFocus && !isDone ? (
          <IconButton
            name="star"
            label={focused ? `Remove ${item.name} from today’s focus` : `Add ${item.name} to today’s focus`}
            onPress={() => onToggleFocus(item)}
            disabled={busy}
            active={Boolean(focused)}
            color={focused ? colors.warning : undefined}
          />
        ) : null}
        {onMore && !isDone ? <IconButton name="more-horizontal" label={`Reschedule or skip ${item.name}`} onPress={() => onMore(item)} disabled={busy} /> : null}
        {onOpenDetail && item.type === 'habit' ? (
          <IconButton name="bar-chart-2" label={`View ${item.name} history`} onPress={() => onOpenDetail(item)} disabled={busy} />
        ) : null}
        {onEdit ? <IconButton name="edit-2" label={`Edit ${item.name}`} onPress={() => onEdit(item)} disabled={busy} /> : null}
        {onDelete ? <IconButton name="trash-2" label={`Delete ${item.name}`} onPress={() => onDelete(item)} disabled={busy} /> : null}
      </View>
    </Card>
  )
}

const sameStreak = (a?: HabitStreakSummary | null, b?: HabitStreakSummary | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.currentStreak === b.currentStreak &&
    a.isActiveStreak === b.isActiveStreak &&
    a.streakUnit === b.streakUnit)

/**
 * Memoised: ticking one item redraws that card, not the whole list. Every prop is compared by
 * identity (so a changed handler always gets through), except the streak summary, which is
 * rebuilt for every habit on each change and is compared by the fields the card shows.
 */
export const ExecutionItemCard = memo(ExecutionItemCardImpl, (prev, next) => {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]) as Set<keyof ExecutionItemCardProps>
  for (const key of keys) {
    if (key === 'streakSummary') {
      if (!sameStreak(prev.streakSummary, next.streakSummary)) return false
    } else if (prev[key] !== next[key]) {
      return false
    }
  }
  return true
})

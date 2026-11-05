import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import { isOverdue } from '@tracknow/core/domain/dates'
import { effectiveCurrentCount } from '@tracknow/core/domain/habitCounter'
import type { HabitStreakSummary } from '@tracknow/core/domain/streaks'
import {
  formatReminderLabel,
  getReminderForItem,
} from '@tracknow/core/services/reminderService'
import { onAppEvent } from '@tracknow/core/platform/events'
import { Badge, Card, Text } from '@/components/ui'
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
}

export function ExecutionItemCard({
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
}: ExecutionItemCardProps) {
  const { colors } = useTheme()
  const isDone = isCompletedOverride !== undefined ? isCompletedOverride : item.status === 'done'
  const overdue = item.type !== 'habit' && !isDone && isOverdue(item.due_date)
  const targetCount = Math.max(1, item.target_count ?? 1)
  const currentCount = effectiveCurrentCount(item, isDone)
  const hasNumericTarget = targetCount > 1 || Boolean(item.unit)
  const progressPercent = Math.min(100, Math.round((currentCount / targetCount) * 100))

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

  return (
    <Card tone={isDone ? 'muted' : 'surface'} style={{ gap: spacing[2], padding: spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] }}>
        <Pressable
          onPress={() => onToggle(item)}
          disabled={busy}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isDone }}
          accessibilityLabel={isDone ? `Mark ${item.name} incomplete` : `Mark ${item.name} done`}
          hitSlop={6}
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
          {isDone ? <Feather name="check" size={16} color={colors.controlText} /> : null}
        </Pressable>

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
                <Feather
                  name="zap"
                  size={11}
                  color={streakSummary.isActiveStreak ? colors.accentPrimaryText : colors.textSecondary}
                />
                <Text variant="meta" style={{ color: streakSummary.isActiveStreak ? colors.accentPrimaryText : colors.textSecondary }}>
                  {streakSummary.currentStreak}d
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
            <Text variant="caption" tone="secondary" numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[3] }}>
            {item.due_date ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="calendar" size={12} color={overdue ? colors.danger : colors.textTertiary} />
                <Text variant="meta" style={{ color: overdue ? colors.danger : colors.textSecondary }}>
                  {item.due_date}
                  {overdue ? ' · Overdue' : ''}
                </Text>
              </View>
            ) : null}

            {item.schedule ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="repeat" size={12} color={colors.textTertiary} />
                <Text variant="meta" tone="secondary" style={{ textTransform: 'capitalize' }}>
                  {item.schedule.frequency}
                  {item.schedule.time_of_day && item.schedule.time_of_day !== 'anytime'
                    ? ` · ${item.schedule.time_of_day}`
                    : ''}
                </Text>
              </View>
            ) : null}
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
              <Feather
                name="bell"
                size={12}
                color={activeReminder.status === 'snoozed' ? colors.warning : colors.textSecondary}
              />
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
          ) : !isDone ? (
            <Pressable
              onPress={() => onEdit?.(item)}
              hitSlop={6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
            >
              <Feather name="bell" size={11} color={colors.textTertiary} />
              <Text variant="meta" tone="tertiary">
                Remind
              </Text>
            </Pressable>
          ) : null}

          {hasNumericTarget ? (
            <View
              style={{
                marginTop: 2,
                height: 3,
                maxWidth: 180,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceMuted,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  backgroundColor: isDone ? colors.success : colors.controlBg,
                }}
              />
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing[2] }}>
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
            <Pressable
              onPress={() => onStep?.(item, -1)}
              disabled={busy || currentCount <= 0}
              hitSlop={4}
              accessibilityLabel={`Decrease ${item.name} count`}
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: currentCount <= 0 ? 0.4 : 1 }}
            >
              <Feather name="minus" size={16} color={colors.textPrimary} />
            </Pressable>
            <Text variant="caption" weight="semibold" style={{ minWidth: 56, textAlign: 'center' }}>
              {currentCount}/{targetCount} {item.unit ?? ''}
            </Text>
            <Pressable
              onPress={() => onStep?.(item, 1)}
              disabled={busy}
              hitSlop={4}
              accessibilityLabel={`Increase ${item.name} count`}
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name="plus" size={16} color={colors.textPrimary} />
            </Pressable>
          </View>
        ) : null}

        {onOpenDetail && item.type === 'habit' ? (
          <Pressable
            onPress={() => onOpenDetail(item)}
            disabled={busy}
            hitSlop={6}
            accessibilityLabel={`View ${item.name} history`}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name="bar-chart-2" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        {onEdit ? (
          <Pressable
            onPress={() => onEdit(item)}
            disabled={busy}
            hitSlop={6}
            accessibilityLabel={`Edit ${item.name}`}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name="edit-2" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        {onDelete ? (
          <Pressable
            onPress={() => onDelete(item)}
            disabled={busy}
            hitSlop={6}
            accessibilityLabel={`Delete ${item.name}`}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name="trash-2" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  )
}

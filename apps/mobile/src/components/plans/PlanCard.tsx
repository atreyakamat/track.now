import { Feather } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import type { PlanSummary } from '@tracknow/core/domain/progress'
import { PLAN_KIND_LABEL, PLAN_STATUS_LABEL, isDueForReview, planKindOf, planTimeline } from '@tracknow/core/domain/plans'
import { formatDateRange, pluralize } from '@tracknow/core/utils/format'
import { Badge, Card, ProgressBar, Text } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { resolveTrackColor, spacing } from '@/theme/tokens'

interface PlanCardProps {
  summary: PlanSummary
  trackColor?: string
  onPress: () => void
  onToggleArchive?: () => void
  busy?: boolean
}

export function PlanCard({ summary, trackColor, onPress, onToggleArchive, busy }: PlanCardProps) {
  const { colors } = useTheme()
  const { plan, progress } = summary
  const isArchived = plan.status === 'archived'
  const dateRange = formatDateRange(plan.start_date, plan.end_date)
  const kind = planKindOf(plan)
  const timeline = planTimeline(plan)
  const review = isDueForReview(plan)

  return (
    <Card tone={plan.status !== 'active' ? 'muted' : 'surface'} style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] }}>
        <Pressable style={{ flex: 1, gap: spacing[1] }} onPress={onPress} accessibilityRole="button">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
            <Text variant="h3" numberOfLines={2} style={{ flexShrink: 1 }}>
              {plan.name}
            </Text>
            <Badge label={PLAN_KIND_LABEL[kind]} />
            {plan.status !== 'active' ? <Badge label={PLAN_STATUS_LABEL[plan.status]} /> : review ? <Badge label="Due for review" tone="accent" /> : null}
          </View>
          {plan.description ? (
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {plan.description}
            </Text>
          ) : null}
          {dateRange ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="calendar" size={12} color={colors.textTertiary} />
              <Text variant="meta" tone="tertiary">
                {dateRange}
                {timeline && timeline.phase === 'running' ? ` · Day ${timeline.day} of ${timeline.totalDays}` : ''}
              </Text>
            </View>
          ) : null}
        </Pressable>
        {onToggleArchive ? (
          <Pressable
            onPress={onToggleArchive}
            disabled={busy}
            hitSlop={8}
            accessibilityLabel={isArchived ? 'Restore plan' : 'Archive plan'}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.4 : 1 }}
          >
            <Feather name={isArchived ? 'rotate-ccw' : 'archive'} size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <Pressable onPress={onPress} style={{ gap: spacing[1] }}>
        <ProgressBar value={progress.percent} color={resolveTrackColor(trackColor ?? 'lime')} />
        <Text variant="caption" tone="secondary">
          {progress.total > 0 ? `${progress.done}/${progress.total} done` : '0 items'} · {pluralize(progress.total, 'item')}
        </Text>
      </Pressable>
    </Card>
  )
}

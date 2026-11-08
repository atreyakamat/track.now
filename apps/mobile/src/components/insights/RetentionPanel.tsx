import { Feather } from '@expo/vector-icons'
import { useMemo } from 'react'
import { Pressable, View } from 'react-native'
import type { ExecutionItem, Plan, Track } from '@tracknow/core/types/domain'
import {
  ON_TRACK_PERCENT,
  RETENTION_STATUS_LABEL,
  buildRetention,
  type HabitRetentionStatus,
  type RetentionCompletion,
  type WeekConsistency,
} from '@tracknow/core/domain/retention'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { pluralize } from '@tracknow/core/utils/format'
import { Card, Text } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

interface Props {
  items: ExecutionItem[]
  plans: Plan[]
  tracks: Track[]
  completions: RetentionCompletion[]
  now: Date
  weeks?: number
  planIds?: Set<string>
  since?: string | null
  onOpenPlan?: (plan: Plan) => void
}

const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const STATUS_GROUPS: HabitRetentionStatus[] = ['dropped', 'slipping', 'kept', 'new', 'not_started']
const STATUS_HINT: Record<HabitRetentionStatus, string> = {
  dropped: 'Scheduled in the last 14 days but not done once.',
  slipping: `Below ${ON_TRACK_PERCENT}% over the last 14 days.`,
  kept: `At least ${ON_TRACK_PERCENT}% over the last 14 days.`,
  new: 'Tracked for less than 14 days — too early to judge.',
  not_started: 'Starts later.',
}

function WeekBars({ weeks }: { weeks: WeekConsistency[] }) {
  const { colors } = useTheme()
  const H = 90
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
      {weeks.map((w) => (
        <View key={w.weekStart} style={{ flex: 1, alignItems: 'center', gap: 3 }} accessibilityLabel={`Week of ${shortDate(w.weekStart)}: ${w.percent === null ? 'nothing planned' : `${w.done} of ${w.planned}, ${w.percent}%`}`}>
          <Text variant="meta" tone="tertiary" style={{ fontSize: 9 }}>
            {w.percent === null ? '–' : w.percent}
          </Text>
          <View style={{ width: '100%', height: H, justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: (H * ON_TRACK_PERCENT) / 100, borderTopWidth: 1, borderTopColor: colors.textTertiary, borderStyle: 'dashed', opacity: 0.6 }} />
            {w.percent !== null ? (
              <View
                style={{
                  height: Math.max(3, (H * w.percent) / 100),
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                  backgroundColor: w.percent < ON_TRACK_PERCENT ? colors.warning : colors.accentPrimary,
                  opacity: w.partial ? 0.5 : 1,
                }}
              />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  )
}

/** Retention: are you sticking with what you planned? Weekly trend, per Plan, per habit. */
export function RetentionPanel({ items, plans, tracks, completions, now, weeks = 12, planIds, since, onOpenPlan }: Props) {
  const { colors } = useTheme()
  const result = useMemo(() => buildRetention({ items, plans, completions, now, weeks, planIds, since }), [items, plans, completions, now, weeks, planIds, since])
  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks])
  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])
  const hasData = result.weeks.some((w) => w.planned > 0) || result.habits.length > 0
  const today = getTodayDateString(now)
  const statusColor: Record<HabitRetentionStatus, string> = {
    kept: colors.success,
    slipping: colors.warning,
    dropped: colors.danger,
    new: colors.textSecondary,
    not_started: colors.textTertiary,
  }

  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="h2">Retention</Text>
      {!hasData ? (
        <Text variant="caption" tone="secondary">
          Nothing to measure yet. Once habits and dated tasks in your active Plans are underway, this shows whether you are sticking with them week after week.
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <Card style={{ flex: 1, gap: 2 }}>
              <Text variant="meta" tone="tertiary">
                Habits kept
              </Text>
              <Text variant="display" style={{ fontSize: 26 }}>
                {result.established ? `${result.kept}/${result.established}` : '—'}
              </Text>
              <Text variant="meta" tone="secondary" style={{ textTransform: 'none', letterSpacing: 0 }}>
                {result.established ? `tracked 14+ days, at ${ON_TRACK_PERCENT}%+` : 'judged after 14 days'}
              </Text>
            </Card>
            <Card style={{ flex: 1, gap: 2 }}>
              <Text variant="meta" tone="tertiary">
                Planned done
              </Text>
              <Text variant="display" style={{ fontSize: 26 }}>
                {result.percent === null ? '—' : `${result.percent}%`}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {result.trend ? (
                  <Feather
                    name={result.trend === 'improving' ? 'trending-up' : result.trend === 'slipping' ? 'trending-down' : 'minus'}
                    size={12}
                    color={result.trend === 'improving' ? colors.success : result.trend === 'slipping' ? colors.warning : colors.textSecondary}
                  />
                ) : null}
                <Text variant="meta" tone="secondary" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  {result.trend ? `${result.trend[0].toUpperCase()}${result.trend.slice(1)} · last ${result.weeks.length} weeks` : `last ${result.weeks.length} weeks`}
                </Text>
              </View>
            </Card>
          </View>

          <Card style={{ gap: spacing[2] }}>
            <Text variant="h3">Weekly consistency</Text>
            <WeekBars weeks={result.weeks} />
            <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
              One bar per Mon–Sun week: scheduled habit days, weekly-target sessions and tasks due. Line at {ON_TRACK_PERCENT}%. This week counts days so far.
            </Text>
          </Card>

          {result.byPlan.length > 0 ? (
            <Card style={{ gap: spacing[2] }}>
              <Text variant="h3">By Plan</Text>
              {result.byPlan.map(({ plan, weeks: pw, percent }) => (
                <Pressable key={plan.id} onPress={() => onOpenPlan?.(plan)} disabled={!onOpenPlan} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 36 }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" weight="medium" numberOfLines={1}>
                      {plan.name}
                    </Text>
                    <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
                      {trackById.get(plan.track_id)?.name ?? 'Track'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 22 }}>
                    {pw.slice(-8).map((w) => (
                      <View
                        key={w.weekStart}
                        style={{
                          width: 5,
                          height: w.percent === null ? 2 : Math.max(2, (22 * w.percent) / 100),
                          borderRadius: 1,
                          backgroundColor: w.percent !== null && w.percent < ON_TRACK_PERCENT ? colors.warning : colors.textSecondary,
                          opacity: w.percent === null ? 0.3 : 1,
                        }}
                      />
                    ))}
                  </View>
                  <Text variant="caption" weight="semibold" style={{ minWidth: 40, textAlign: 'right' }}>
                    {percent}%
                  </Text>
                </Pressable>
              ))}
            </Card>
          ) : null}

          {result.habits.length > 0 ? (
            <Card style={{ gap: spacing[3] }}>
              <Text variant="h3">Habits: kept, slipping or dropped</Text>
              {STATUS_GROUPS.map((status) => {
                const group = result.habits.filter((h) => h.status === status)
                if (!group.length) return null
                return (
                  <View key={status} style={{ gap: spacing[1] }}>
                    <Text variant="caption" weight="semibold" style={{ color: statusColor[status] }}>
                      {RETENTION_STATUS_LABEL[status]} ({group.length})
                    </Text>
                    <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
                      {STATUS_HINT[status]}
                    </Text>
                    {group.map((h) => {
                      const delta = h.recentPercent !== null && h.previousPercent !== null ? h.recentPercent - h.previousPercent : null
                      const details: string[] = []
                      if (status === 'not_started' && h.item.start_date) details.push(`Starts ${shortDate(h.item.start_date)}`)
                      else {
                        if (h.weeksOnTrack > 0) details.push(`On track ${pluralize(h.weeksOnTrack, 'week')} in a row`)
                        if (h.bestWeeksOnTrack > h.weeksOnTrack) details.push(`best ${pluralize(h.bestWeeksOnTrack, 'week')}`)
                        details.push(h.lastDone ? `last ${h.lastDone === today ? 'today' : shortDate(h.lastDone)}` : 'never done yet')
                      }
                      const plan = planById.get(h.item.plan_id)
                      return (
                        <View key={h.item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                          <View style={{ flex: 1 }}>
                            <Text variant="caption" weight="medium" numberOfLines={1}>
                              {h.item.name}
                            </Text>
                            <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
                              {plan ? `${plan.name} · ` : ''}
                              {details.join(' · ')}
                            </Text>
                          </View>
                          {status !== 'not_started' ? (
                            <Text variant="caption" weight="semibold">
                              {h.recentPercent === null ? '—' : `${h.recentPercent}%`}
                              {delta !== null && delta !== 0 ? (
                                <Text variant="meta" tone="secondary" style={{ textTransform: 'none', letterSpacing: 0 }}>
                                  {' '}
                                  {delta > 0 ? '▲' : '▼'}
                                  {Math.abs(delta)}
                                </Text>
                              ) : null}
                            </Text>
                          ) : null}
                        </View>
                      )
                    })}
                  </View>
                )
              })}
            </Card>
          ) : null}
        </>
      )}
      <View style={{ height: 1, borderRadius: radius.pill }} />
    </View>
  )
}

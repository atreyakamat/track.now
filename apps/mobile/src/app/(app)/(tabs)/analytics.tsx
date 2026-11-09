import { Feather } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listTracks } from '@tracknow/core/services/tracksService'
import { listPlans } from '@tracknow/core/services/plansService'
import { listExecutionItems, listCompletionsForDate } from '@tracknow/core/services/executionService'
import { listCompletionHistory } from '@tracknow/core/services/historyService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { addDays } from '@tracknow/core/domain/streaks'
import {
  ANALYTICS_HISTORY_DAYS,
  ANALYTICS_RANGE_OPTIONS,
  buildAnalytics,
  type AnalyticsRangeDays,
} from '@tracknow/core/domain/analytics'
import { pluralize } from '@tracknow/core/utils/format'
import { PageHeader } from '@/components/PageHeader'
import { Heatmap } from '@/components/insights/Heatmap'
import { ProgressPanel } from '@/components/insights/ProgressPanel'
import { RetentionPanel } from '@/components/insights/RetentionPanel'
import { Card, EmptyState, ErrorState, LoadingState, ProgressBar, Segmented, Text } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { loadPreferences, onPreferencesChange } from '@tracknow/core/services/preferences'
import { useAsync } from '@/hooks/useAsync'
import { useTheme } from '@/theme/ThemeProvider'
import { resolveTrackColor, spacing } from '@/theme/tokens'

const LIFETIME_START = '2000-01-01'

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={{ flex: 1, gap: 2, minWidth: 140 }}>
      <Text variant="meta" tone="tertiary">
        {label}
      </Text>
      <Text variant="display" style={{ fontSize: 28 }}>
        {value}
      </Text>
      {sub ? (
        <Text variant="meta" tone="secondary">
          {sub}
        </Text>
      ) : null}
    </Card>
  )
}

export default function AnalyticsScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const [rangeDays, setRangeDays] = useState<AnalyticsRangeDays>(30)
  const [gentle, setGentle] = useState(() => (user ? loadPreferences(user.id).gamification === 'gentle' : false))
  useEffect(() => onPreferencesChange((p) => setGentle(p.gamification === 'gentle')), [])

  const { data, loading, error, reload, refreshing } = useAsync(async () => {
    if (!user) return null
    const today = getTodayDateString()
    // One lifetime ledger (item id + date) feeds level, achievements, retention, the heatmap
    // and the range analytics; nothing is loaded twice.
    const [tracks, plans, items, ledger, completedTodayIds] = await Promise.all([
      listTracks(),
      listPlans(),
      listExecutionItems(),
      listCompletionHistory(user.id, LIFETIME_START, today),
      listCompletionsForDate(user.id, today),
    ])
    return { tracks, plans, items, ledger, completedTodayIds, loadedAt: new Date() }
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  const analytics = useMemo(() => {
    if (!data) return null
    const historyStart = addDays(getTodayDateString(data.loadedAt), -(ANALYTICS_HISTORY_DAYS - 1))
    return buildAnalytics({
      tracks: data.tracks,
      plans: data.plans,
      items: data.items,
      completions: data.ledger.filter((c) => c.completed_date >= historyStart),
      completedTodayIds: data.completedTodayIds,
      now: data.loadedAt,
      rangeDays,
    })
  }, [data, rangeDays])

  const chart = analytics?.weekly
    ? analytics.weekly.map((b) => ({ label: b.start.slice(5), count: b.count }))
    : (analytics?.daily ?? []).map((d) => ({ label: d.date.slice(5), count: d.count }))
  const maxCount = Math.max(1, ...chart.map((c) => c.count))

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[7] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Insights" subtitle="Built only from your real completions." />

        {loading ? (
          <LoadingState label="Crunching your numbers…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : !data || !analytics || !analytics.hasAnyData ? (
          <EmptyState
            icon={<Feather name="bar-chart-2" size={22} color={colors.textSecondary} />}
            title="No insights yet"
            description="Create a track, add a habit or task, and complete it to see your first numbers here."
          />
        ) : (
          <View style={{ gap: spacing[5] }}>
            {user && !gentle ? <ProgressPanel userId={user.id} items={data.items} plans={data.plans} tracks={data.tracks.length} ledger={data.ledger} /> : null}

            <RetentionPanel
              items={data.items}
              plans={data.plans}
              tracks={data.tracks}
              completions={data.ledger}
              now={data.loadedAt}
              onOpenPlan={(plan) => router.push(`/plan/${plan.id}`)}
            />

            <View style={{ gap: spacing[4] }}>
              <Text variant="h2">Activity</Text>
              <Segmented
                value={String(rangeDays)}
                onChange={(v) => setRangeDays(Number(v) as AnalyticsRangeDays)}
                options={ANALYTICS_RANGE_OPTIONS.map((d) => ({ key: String(d), label: `${d}d` }))}
              />

              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <StatTile
                  label="Completions"
                  value={String(analytics.totals.completions)}
                  sub={analytics.totals.comparison ? `${analytics.totals.comparison.percentChange >= 0 ? '+' : ''}${analytics.totals.comparison.percentChange}% vs prev` : 'this range'}
                />
                <StatTile
                  label="Active days"
                  value={String(analytics.totals.activeDays)}
                  sub={analytics.totals.averagePerActiveDay !== null ? `${analytics.totals.averagePerActiveDay}/day avg` : 'no active days'}
                />
              </View>

              <Heatmap completions={data.ledger} items={data.items} now={data.loadedAt} onOpenPlan={(planId) => router.push(`/plan/${planId}`)} />

              <Card style={{ gap: spacing[3] }}>
                <Text variant="h3">Completions over time</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 120 }}>
                  {chart.map((c, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                      <View style={{ width: '70%', height: Math.max(2, (c.count / maxCount) * 96), backgroundColor: colors.accentPrimary, borderRadius: 3 }} />
                    </View>
                  ))}
                </View>
                <Text variant="meta" tone="tertiary">
                  {analytics.weekly ? 'Per week' : 'Per day'} · {pluralize(analytics.totals.completions, 'completion')}
                </Text>
              </Card>

              {analytics.habitTotals.rate !== null ? (
                <Card style={{ gap: spacing[2] }}>
                  <Text variant="h3">Habit consistency</Text>
                  <ProgressBar value={analytics.habitTotals.rate} />
                  <Text variant="meta" tone="secondary">
                    {analytics.habitTotals.completed}/{analytics.habitTotals.expected} scheduled habit days completed
                  </Text>
                </Card>
              ) : null}

              {analytics.trackProgress.length > 0 ? (
                <Card style={{ gap: spacing[3] }}>
                  <Text variant="h3">Progress by track</Text>
                  {analytics.trackProgress.map((row) => (
                    <View key={row.track.id} style={{ gap: spacing[1] }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text variant="caption" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                          {row.track.name}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          {pluralize(row.completionsInRange, 'completion')}
                        </Text>
                      </View>
                      <ProgressBar value={row.progress.percent} color={resolveTrackColor(row.track.color)} />
                    </View>
                  ))}
                </Card>
              ) : null}

              {analytics.overdue.length > 0 ? (
                <Card style={{ gap: spacing[2] }}>
                  <Text variant="h3" tone="danger">
                    Overdue ({analytics.overdue.length})
                  </Text>
                  {analytics.overdue.slice(0, 5).map((o) => (
                    <View key={o.item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] }}>
                      <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                        {o.item.name}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {o.item.due_date}
                      </Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              {analytics.recent.length > 0 ? (
                <Card style={{ gap: spacing[2] }}>
                  <Text variant="h3">Recent activity</Text>
                  {analytics.recent.slice(0, 8).map((r, i) => (
                    <View key={`${r.itemId}-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] }}>
                      <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                        {r.itemName}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {r.date.slice(5)}
                      </Text>
                    </View>
                  ))}
                </Card>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

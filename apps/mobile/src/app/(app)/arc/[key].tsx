import { Feather } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listTracks } from '@tracknow/core/services/tracksService'
import { listPlans } from '@tracknow/core/services/plansService'
import { listCompletionsForDate, listExecutionItems } from '@tracknow/core/services/executionService'
import { listCompletionHistory } from '@tracknow/core/services/historyService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { addDays } from '@tracknow/core/domain/streaks'
import { ANALYTICS_HISTORY_DAYS } from '@tracknow/core/domain/analytics'
import { arcKey, groupArcs } from '@tracknow/core/domain/arcs'
import { summarizePlan } from '@tracknow/core/domain/progress'
import { formatDateRange } from '@tracknow/core/utils/format'
import { AppBar } from '@/components/AppBar'
import { RetentionPanel } from '@/components/insights/RetentionPanel'
import { PlanCard } from '@/components/plans/PlanCard'
import { Card, EmptyState, ErrorState, LoadingState, ProgressBar, Text } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAsync } from '@/hooks/useAsync'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

/** One Arc: every Plan carrying the same Arc name, across Tracks, with its retention. */
export default function ArcScreen() {
  const { key: rawKey } = useLocalSearchParams<{ key: string }>()
  const key = arcKey(decodeURIComponent(typeof rawKey === 'string' ? rawKey : ''))
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()

  const { data, loading, error, reload, refreshing } = useAsync(async () => {
    if (!user) return null
    const today = getTodayDateString()
    const [tracks, plans, items, completions, completedTodayIds] = await Promise.all([
      listTracks(),
      listPlans(),
      listExecutionItems(),
      listCompletionHistory(user.id, addDays(today, -(ANALYTICS_HISTORY_DAYS - 1)), today),
      listCompletionsForDate(user.id, today),
    ])
    return { tracks, plans, items, completions, completedTodayIds, loadedAt: new Date() }
  }, [user?.id])

  const view = useMemo(() => {
    if (!data) return null
    const options = { completedTodayIds: new Set(data.completedTodayIds) }
    const arc = groupArcs(data.plans, data.items, data.loadedAt, options).find((a) => a.key === key)
    if (!arc) return { arc: null }
    const trackById = new Map(data.tracks.map((t) => [t.id, t]))
    const byTrack = arc.trackIds
      .map((id) => ({ track: trackById.get(id), plans: arc.plans.filter((p) => p.track_id === id).map((p) => summarizePlan(p, data.items, options)) }))
      .sort((a, b) => (a.track?.name ?? '').localeCompare(b.track?.name ?? ''))
    const today = getTodayDateString(data.loadedAt)
    const start = arc.start && arc.start <= today ? arc.start : null
    const weeks = start ? Math.min(24, Math.floor((Date.parse(today) - Date.parse(start)) / (7 * 86_400_000)) + 2) : 4
    return { arc, byTrack, planIds: new Set(arc.plans.map((p) => p.id)), start, weeks }
  }, [data, key])

  const header = <View style={{ paddingHorizontal: spacing[4] }}><AppBar title={view?.arc?.name ?? 'Arc'} /></View>

  if (loading || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header}
        {error ? <View style={{ padding: spacing[4] }}><ErrorState description={error} onRetry={reload} /></View> : <LoadingState label="Loading the Arc…" />}
      </SafeAreaView>
    )
  }
  if (!view?.arc) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header}
        <View style={{ padding: spacing[4] }}>
          <EmptyState
            icon={<Feather name="layers" size={22} color={colors.textSecondary} />}
            title="Arc not found"
            description="No Plan belongs to this Arc any more. Set “Part of an Arc” when creating or editing a Plan to group Plans from different Tracks."
            action={{ label: 'Back to Tracks', onPress: () => router.replace('/(app)/(tabs)/tracks') }}
          />
        </View>
      </SafeAreaView>
    )
  }

  const { arc, byTrack, planIds, start, weeks } = view
  const t = arc.timeline

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[7], gap: spacing[4] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 4 }}>
          <Text variant="meta" tone="tertiary">
            Arc
          </Text>
          <Text variant="h1">{arc.name}</Text>
          <Text variant="caption" tone="secondary">
            {arc.plans.length} Plans across {arc.trackIds.length} Tracks
            {arc.start || arc.end ? ` · ${formatDateRange(arc.start, arc.end)}` : ''}
          </Text>
        </View>

        <Card style={{ gap: spacing[3] }}>
          {t ? (
            <View style={{ gap: 4 }}>
              <Text variant="h3">
                {t.phase === 'not_started' ? `Starts in ${t.startsInDays} ${t.startsInDays === 1 ? 'day' : 'days'}` : t.phase === 'ended' ? `Ended · ${t.totalDays} days` : `Day ${t.day} of ${t.totalDays}`}
              </Text>
              <ProgressBar value={t.elapsedPercent} />
            </View>
          ) : null}
          <View style={{ gap: 4 }}>
            <Text variant="caption" tone="secondary">
              {arc.progress.done} of {arc.progress.total} items done{arc.status === 'completed' ? ' (all Plans completed)' : ''}
            </Text>
            <ProgressBar value={arc.progress.percent} />
          </View>
        </Card>

        <View style={{ gap: spacing[3] }}>
          <Text variant="h2">Plans in this Arc</Text>
          {byTrack.map(({ track, plans }) => (
            <View key={track?.id ?? 'unknown'} style={{ gap: spacing[2] }}>
              <Text variant="meta" tone="secondary">
                {track?.name ?? 'Track'}
              </Text>
              {plans.map((summary) => (
                <PlanCard key={summary.plan.id} summary={summary} trackColor={track?.color} onPress={() => router.push(`/plan/${summary.plan.id}`)} />
              ))}
            </View>
          ))}
        </View>

        <RetentionPanel
          items={data.items}
          plans={data.plans}
          tracks={data.tracks}
          completions={data.completions}
          now={data.loadedAt}
          planIds={planIds}
          since={start}
          weeks={weeks}
          onOpenPlan={(plan) => router.push(`/plan/${plan.id}`)}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

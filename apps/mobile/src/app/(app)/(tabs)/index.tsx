import { Feather } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listCompletionsForDate, listUserDailyCompletionCounts } from '@tracknow/core/services/executionService'
import { listItemSummaries, listPlans } from '@tracknow/core/services/plansService'
import { listTracks } from '@tracknow/core/services/tracksService'
import { summarizeTrack, type TrackSummary } from '@tracknow/core/domain/progress'
import { addDays } from '@tracknow/core/domain/streaks'
import { getTodayDateString, greeting } from '@tracknow/core/domain/dates'
import { Button, Card, EmptyState, ErrorState, LoadingState, ProgressBar, Text } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { TrackCard } from '@/components/tracks/TrackCard'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAsync } from '@/hooks/useAsync'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

const HEATMAP_WEEKS = 12

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, gap: 2, minWidth: 100 }}>
      <Text variant="meta" tone="tertiary">
        {label}
      </Text>
      <Text variant="display" style={{ fontSize: 26 }}>
        {value}
      </Text>
    </Card>
  )
}

/** A compact GitHub-style completion heatmap for the last ~12 weeks. */
function Heatmap({ counts }: { counts: Record<string, number> }) {
  const { colors } = useTheme()
  const today = getTodayDateString()
  // Start on the Sunday that begins the window so columns are whole weeks.
  const start = addDays(today, -(HEATMAP_WEEKS * 7 - 1))
  const startDow = new Date(`${start}T00:00:00`).getDay()
  const gridStart = addDays(start, -startDow)
  const max = Math.max(1, ...Object.values(counts))

  const weeks: string[][] = []
  for (let w = 0; w < HEATMAP_WEEKS + 1; w++) {
    const col: string[] = []
    for (let d = 0; d < 7; d++) col.push(addDays(gridStart, w * 7 + d))
    weeks.push(col)
  }

  const shade = (date: string): string => {
    if (date > today) return 'transparent'
    const n = counts[date] ?? 0
    if (n === 0) return colors.surfaceMuted
    const t = Math.min(1, n / max)
    // Blend from a faint accent to the full accent.
    return t < 0.34 ? colors.border : t < 0.67 ? colors.accentSecondary : colors.accentPrimary
  }

  return (
    <Card style={{ gap: spacing[2] }}>
      <Text variant="h3">Consistency</Text>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {weeks.map((col, wi) => (
          <View key={wi} style={{ gap: 3 }}>
            {col.map((date) => (
              <View
                key={date}
                style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: shade(date) }}
              />
            ))}
          </View>
        ))}
      </View>
      <Text variant="meta" tone="tertiary">
        Last {HEATMAP_WEEKS} weeks of completions
      </Text>
    </Card>
  )
}

export default function DashboardScreen() {
  const { user, displayName } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()

  const { data, loading, error, reload, refreshing } = useAsync(async () => {
    if (!user) return null
    const today = getTodayDateString()
    const [tracks, plans, items, completedTodayIds, dailyCounts] = await Promise.all([
      listTracks(),
      listPlans(),
      listItemSummaries(),
      listCompletionsForDate(user.id, today),
      listUserDailyCompletionCounts(user.id, addDays(today, -7 * 13)).catch(() => ({}) as Record<string, number>),
    ])
    const options = { completedTodayIds: new Set(completedTodayIds) }
    const summaries: TrackSummary[] = tracks.map((t) => summarizeTrack(t, plans, items, options))
    return { summaries, dailyCounts }
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      reload()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  )

  const active = (data?.summaries ?? []).filter((s) => s.track.status === 'active')
  const totalItems = active.reduce((a, s) => a + s.progress.total, 0)
  const doneItems = active.reduce((a, s) => a + s.progress.done, 0)
  const overall = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[7] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title={displayName}
          subtitle={`${greeting()} — here's your execution snapshot.`}
          right={
            <Button
              title="Track"
              size="sm"
              icon={<Feather name="plus" size={16} color={colors.controlText} />}
              onPress={() => router.push('/track/new')}
            />
          }
        />

        {loading ? (
          <LoadingState label="Loading your personal OS…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : !data || active.length === 0 ? (
          <EmptyState
            icon={<Feather name="target" size={22} color={colors.textSecondary} />}
            title="Start your first track"
            description="Create a track, add a plan with habits and tasks, and your snapshot will build here."
            action={{ label: 'Create a track', onPress: () => router.push('/track/new') }}
          />
        ) : (
          <View style={{ gap: spacing[4] }}>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              <Stat label="Active tracks" value={String(active.length)} />
              <Stat label="Today" value={`${overall}%`} />
              <Stat label="Done" value={`${doneItems}/${totalItems}`} />
            </View>

            <Card style={{ gap: spacing[2] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="h3">Overall progress</Text>
                <Button title="Open today" variant="ghost" size="sm" onPress={() => router.push('/(app)/(tabs)/today')} />
              </View>
              <ProgressBar value={overall} />
            </Card>

            <Heatmap counts={data.dailyCounts} />

            <View style={{ gap: spacing[2] }}>
              <Text variant="meta" tone="tertiary">
                Active tracks
              </Text>
              {active.map((s) => (
                <TrackCard key={s.track.id} summary={s} onPress={() => router.push(`/track/${s.track.id}`)} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

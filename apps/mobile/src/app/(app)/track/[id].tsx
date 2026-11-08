import { Feather } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listCompletionsForDate } from '@tracknow/core/services/executionService'
import { listItemSummaries, listPlans } from '@tracknow/core/services/plansService'
import { getTrack } from '@tracknow/core/services/tracksService'
import {
  deleteTrackWithCleanup,
  setPlanArchivedWithCleanup,
  setTrackArchivedWithCleanup,
} from '@tracknow/core/services/trackLifecycle'
import { summarizeTrack, type TrackSummary } from '@tracknow/core/domain/progress'
import { pluralize } from '@tracknow/core/utils/format'
import { AppBar } from '@/components/AppBar'
import { PlanCard } from '@/components/plans/PlanCard'
import { TrackIcon } from '@/components/tracks/TrackIcon'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  ProgressBar,
  Segmented,
  Text,
} from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { useAsync } from '@/hooks/useAsync'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, resolveTrackColor, spacing } from '@/theme/tokens'

const RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function TrackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { colors } = useTheme()
  const router = useRouter()
  const [filter, setFilter] = useState<'active' | 'archived'>('active')
  const [planBusyId, setPlanBusyId] = useState<string | null>(null)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const valid = typeof id === 'string' && RECORD_ID_RE.test(id)

  const { data, loading, error, reload, refreshing } = useAsync<TrackSummary | null>(async () => {
    if (!valid) return null
    const [track, plans, items, completed] = await Promise.all([
      getTrack(id),
      listPlans(id),
      listItemSummaries(),
      user ? listCompletionsForDate(user.id) : Promise.resolve([] as string[]),
    ])
    if (!track) return null
    return summarizeTrack(track, plans, items, { completedTodayIds: completed })
  }, [id, user?.id])

  const togglePlanArchive = useCallback(
    async (planId: string, isArchived: boolean) => {
      setPlanBusyId(planId)
      try {
        await setPlanArchivedWithCleanup(user?.id, planId, !isArchived)
        reload()
      } catch (err) {
        showToast({
          title: isArchived ? 'Could not restore plan' : 'Could not archive plan',
          message: err instanceof Error ? err.message : 'Please try again.',
          type: 'warning',
        })
      } finally {
        setPlanBusyId(null)
      }
    },
    [user?.id, reload, showToast],
  )

  const handleArchiveTrack = async () => {
    if (!data) return
    const archiving = data.track.status !== 'archived'
    setConfirmArchive(false)
    setArchiveBusy(true)
    try {
      await setTrackArchivedWithCleanup(user?.id, data.track.id, archiving)
      reload()
    } catch (err) {
      showToast({
        title: archiving ? 'Could not archive track' : 'Could not restore track',
        message: err instanceof Error ? err.message : 'Please try again.',
        type: 'warning',
      })
    } finally {
      setArchiveBusy(false)
    }
  }

  const handleDeleteTrack = async () => {
    if (!data) return
    setConfirmDelete(false)
    try {
      await deleteTrackWithCleanup(user?.id, data.track.id)
      router.replace('/(app)/(tabs)/tracks')
    } catch (err) {
      showToast({
        title: 'Could not delete track',
        message: err instanceof Error ? err.message : 'Please try again.',
        type: 'warning',
      })
    }
  }

  const header = (title?: string, right?: React.ReactNode) => (
    <View style={{ paddingHorizontal: spacing[4] }}>
      <AppBar title={title} right={right} onBack={() => router.replace('/(app)/(tabs)/tracks')} />
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header()}
        <LoadingState label="Loading track…" />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header()}
        <View style={{ padding: spacing[4] }}>
          <ErrorState description={error} onRetry={reload} />
        </View>
      </SafeAreaView>
    )
  }

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header()}
        <View style={{ padding: spacing[4] }}>
          <EmptyState
            icon={<Feather name="search" size={22} color={colors.textSecondary} />}
            title="Track not found"
            description="It may have been deleted, or it belongs to another account."
            action={{ label: 'Back to tracks', onPress: () => router.replace('/(app)/(tabs)/tracks') }}
          />
        </View>
      </SafeAreaView>
    )
  }

  const { track, progress, activePlans, inactivePlans } = data
  const isArchived = track.status === 'archived'
  const plans = filter === 'active' ? activePlans : inactivePlans
  const accent = resolveTrackColor(track.color)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {header(
        track.name,
        <Pressable
          onPress={() => router.push(`/track/${track.id}/edit`)}
          hitSlop={8}
          accessibilityLabel="Edit track"
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="edit-2" size={18} color={colors.textPrimary} />
        </Pressable>,
      )}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[7], gap: spacing[4] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <TrackIcon icon={track.icon} color={track.color} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <Text variant="h2" style={{ flexShrink: 1 }} numberOfLines={2}>
                {track.name}
              </Text>
              {isArchived ? <Badge label="Archived" /> : null}
            </View>
            {track.description ? (
              <Text variant="caption" tone="secondary">
                {track.description}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ gap: spacing[2] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="meta" tone="tertiary">
              Overall progress
            </Text>
            <Text variant="caption" tone="secondary">
              {pluralize(activePlans.length, 'active plan')}
            </Text>
          </View>
          <ProgressBar value={progress.percent} color={accent} />
        </View>

        <Button
          title="New plan"
          variant="secondary"
          block
          icon={<Feather name="plus" size={16} color={colors.textPrimary} />}
          onPress={() => router.push(`/plan/new?trackId=${track.id}`)}
        />

        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'active', label: `Active (${activePlans.length})` },
            { key: 'archived', label: `Other (${inactivePlans.length})` },
          ]}
        />

        {plans.length === 0 ? (
          <EmptyState
            icon={<Feather name="clipboard" size={22} color={colors.textSecondary} />}
            title={filter === 'active' ? 'No plans yet' : 'Nothing archived'}
            description={
              filter === 'active'
                ? 'Create a plan to start adding habits, tasks and milestones.'
                : 'Archived plans will appear here.'
            }
          />
        ) : (
          <View style={{ gap: spacing[3] }}>
            {plans.map((summary) => (
              <PlanCard
                key={summary.plan.id}
                summary={summary}
                trackColor={track.color}
                busy={planBusyId === summary.plan.id}
                onPress={() => router.push(`/plan/${summary.plan.id}`)}
                onToggleArchive={() => togglePlanArchive(summary.plan.id, summary.plan.status === 'archived')}
              />
            ))}
          </View>
        )}

        <View style={{ gap: spacing[2], marginTop: spacing[3] }}>
          <Button
            title={archiveBusy ? 'Working…' : isArchived ? 'Restore track' : 'Archive track'}
            variant="ghost"
            block
            loading={archiveBusy}
            onPress={() => (isArchived ? handleArchiveTrack() : setConfirmArchive(true))}
          />
          <Pressable
            onPress={() => setConfirmDelete(true)}
            style={{ alignItems: 'center', paddingVertical: spacing[3], borderRadius: radius.md }}
          >
            <Text variant="caption" tone="danger" weight="medium">
              Delete track
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmArchive}
        title="Archive this track?"
        message="Its plans and items stay intact and can be restored anytime. Device reminders for them will be cancelled."
        confirmLabel="Archive"
        onCancel={() => setConfirmArchive(false)}
        onConfirm={handleArchiveTrack}
      />
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this track?"
        message="This permanently removes the track and all its plans and items. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDeleteTrack}
      />
    </SafeAreaView>
  )
}

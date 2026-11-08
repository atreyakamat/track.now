import { Feather } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, EmptyState, ErrorState, LoadingState, Segmented, Text } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { ArcCard, arcPath } from '@/components/plans/ArcCard'
import { TrackCard } from '@/components/tracks/TrackCard'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTracksOverview } from '@/hooks/useTracksOverview'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

export default function TracksScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const [filter, setFilter] = useState<'active' | 'archived'>('active')
  const { data, loading, error, reload, refreshing, stale } = useTracksOverview(user?.id)

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  const list = data ? data[filter] : []
  const arcs = (data?.arcs ?? []).filter((a) => a.status !== 'archived')

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[7] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title="Tracks"
          subtitle="Your long-term areas of focus."
          right={
            <Button title="New" size="sm" icon={<Feather name="plus" size={16} color={colors.controlText} />} onPress={() => router.push('/track/new')} />
          }
        />

        {stale ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing[3] }}>
            <Feather name="wifi-off" size={13} color={colors.warning} />
            <Text variant="meta" style={{ color: colors.warning }}>
              Offline — showing your last saved data.
            </Text>
          </View>
        ) : null}

        {!loading && !error && arcs.length > 0 ? (
          <View style={{ gap: spacing[2], marginBottom: spacing[5] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="layers" size={14} color={colors.textSecondary} />
              <Text variant="meta" tone="secondary">
                Arcs
              </Text>
            </View>
            <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
              Plans from different Tracks grouped into one push.
            </Text>
            {arcs.map((arc) => (
              <ArcCard key={arc.key} arc={arc} onPress={() => router.push(arcPath(arc))} />
            ))}
          </View>
        ) : null}

        <View style={{ marginBottom: spacing[4] }}>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { key: 'active', label: `Active${data ? ` (${data.active.length})` : ''}` },
              { key: 'archived', label: `Archived${data ? ` (${data.archived.length})` : ''}` },
            ]}
          />
        </View>

        {loading ? (
          <LoadingState label="Loading tracks…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Feather name="layers" size={22} color={colors.textSecondary} />}
            title={filter === 'active' ? 'No tracks yet' : 'Nothing archived'}
            description={filter === 'active' ? 'Plan a goal for guided setup, or use + New to build a track from scratch.' : 'Archived tracks will appear here.'}
            action={filter === 'active' ? { label: 'Plan a goal', onPress: () => router.push('/guide') } : undefined}
          />
        ) : (
          <View style={{ gap: spacing[3] }}>
            {list.map((summary) => (
              <TrackCard key={summary.track.id} summary={summary} onPress={() => router.push(`/track/${summary.track.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

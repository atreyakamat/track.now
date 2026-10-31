import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, EmptyState, ErrorState, LoadingState, Segmented, Text } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
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
  const { data, loading, error, reload, refreshing } = useTracksOverview(user?.id)

  const list = data ? data[filter] : []

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
            <Button
              title="New"
              size="sm"
              icon={<Feather name="plus" size={16} color={colors.controlText} />}
              onPress={() => router.push('/track/new')}
            />
          }
        />

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
            description={
              filter === 'active'
                ? 'Create your first track to start organizing your plans and habits.'
                : 'Archived tracks will appear here.'
            }
            action={filter === 'active' ? { label: 'Create a track', onPress: () => router.push('/track/new') } : undefined}
          />
        ) : (
          <View style={{ gap: spacing[3] }}>
            {list.map((summary) => (
              <TrackCard
                key={summary.track.id}
                summary={summary}
                onPress={() => router.push(`/track/${summary.track.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

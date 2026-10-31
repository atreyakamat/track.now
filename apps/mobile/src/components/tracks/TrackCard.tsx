import { Feather } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import type { TrackSummary } from '@tracknow/core/domain/progress'
import { Card, ProgressBar, Text } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { resolveTrackColor, spacing } from '@/theme/tokens'
import { TrackIcon } from './TrackIcon'

interface TrackCardProps {
  summary: TrackSummary
  onPress: () => void
}

export function TrackCard({ summary, onPress }: TrackCardProps) {
  const { colors } = useTheme()
  const { track, progress, activePlans } = summary
  const planCount = activePlans.length

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <Card style={{ gap: spacing[3], opacity: pressed ? 0.9 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
            <TrackIcon icon={track.icon} color={track.color} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3" numberOfLines={1}>
                {track.name}
              </Text>
              <Text variant="caption" tone="secondary">
                {planCount} {planCount === 1 ? 'plan' : 'plans'} · {progress.done}/{progress.total} done
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textTertiary} />
          </View>
          <ProgressBar value={progress.percent} color={resolveTrackColor(track.color)} />
        </Card>
      )}
    </Pressable>
  )
}

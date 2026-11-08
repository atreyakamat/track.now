import { Feather } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import type { ArcSummary } from '@tracknow/core/domain/arcs'
import { pluralize } from '@tracknow/core/utils/format'
import { Badge, Card, ProgressBar, Text } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

export const arcPath = (arc: Pick<ArcSummary, 'key'>) => `/arc/${encodeURIComponent(arc.key)}` as const

/** Compact card for an Arc (Plans grouped across Tracks). */
export function ArcCard({ arc, onPress }: { arc: ArcSummary; onPress: () => void }) {
  const { colors } = useTheme()
  const t = arc.timeline
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open the Arc ${arc.name}`}>
      <Card style={{ gap: spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
          <Feather name="layers" size={16} color={colors.textPrimary} />
          <Text variant="h3" style={{ flexShrink: 1 }} numberOfLines={2}>
            {arc.name}
          </Text>
          {arc.status === 'completed' ? <Badge label="Completed" /> : null}
        </View>
        <Text variant="caption" tone="secondary">
          {pluralize(arc.plans.length, 'Plan')} · {pluralize(arc.trackIds.length, 'Track')}
          {t ? ` · ${t.phase === 'not_started' ? `starts in ${pluralize(t.startsInDays, 'day')}` : t.phase === 'ended' ? 'ended' : `Day ${t.day} of ${t.totalDays}`}` : ''}
        </Text>
        <ProgressBar value={arc.progress.percent} />
      </Card>
    </Pressable>
  )
}

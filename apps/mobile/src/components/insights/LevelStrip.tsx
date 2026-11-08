import { Feather } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import type { LevelInfo } from '@tracknow/core/domain/momentum'
import { pluralize } from '@tracknow/core/utils/format'
import { Text } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

/** Compact level / XP / active-day streak / this-week line for Today. Tapping opens Insights. */
export function LevelStrip({
  level,
  streak,
  week,
  onPress,
}: {
  level: LevelInfo
  streak: number
  week: { done: number; planned: number } | null
  onPress: () => void
}) {
  const { colors } = useTheme()
  const toNext = level.nextLevelXp - level.xp
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Level ${level.level}, ${level.name}. ${level.xp} XP, ${toNext} to the next level. Opens Insights.`}
      style={{ gap: 6, paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <Feather name="award" size={14} color={colors.textPrimary} />
          <Text variant="caption" weight="semibold" numberOfLines={1}>
            Lv {level.level} · {level.name}
          </Text>
        </View>
        <Text variant="caption" tone="secondary">
          {level.xp} XP · {toNext} to Lv {level.level + 1}
        </Text>
      </View>
      <View style={{ height: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
        <View style={{ width: `${level.progress}%`, height: '100%', backgroundColor: colors.controlBg }} />
      </View>
      {streak >= 2 || (week && week.planned > 0) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap' }}>
          {streak >= 2 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="zap" size={13} color={colors.warning} />
              <Text variant="caption" weight="semibold" style={{ color: colors.warning }}>
                {pluralize(streak, 'day')} in a row
              </Text>
            </View>
          ) : null}
          {week && week.planned > 0 ? (
            <Text variant="caption" tone="secondary">
              This week {week.done}/{week.planned}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  )
}

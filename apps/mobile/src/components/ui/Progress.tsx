import { View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'
import { AnimatedBar } from './Motion'
import { Text } from './Text'

interface ProgressBarProps {
  /** 0–100. */
  value: number
  color?: string
  showValue?: boolean
}

export function ProgressBar({ value, color, showValue = true }: ProgressBarProps) {
  const { colors } = useTheme()
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={{ flex: 1 }}>
        <AnimatedBar percent={pct} color={color ?? colors.textPrimary} trackColor={colors.surfaceMuted} />
      </View>
      {showValue ? (
        <Text variant="caption" weight="semibold" style={{ minWidth: 36, textAlign: 'right' }}>
          {pct}%
        </Text>
      ) : null}
    </View>
  )
}

import { View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
      <View
        style={{
          flex: 1,
          height: 6,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceMuted,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: color ?? colors.textPrimary,
          }}
        />
      </View>
      {showValue ? (
        <Text variant="caption" weight="semibold" style={{ minWidth: 36, textAlign: 'right' }}>
          {pct}%
        </Text>
      ) : null}
    </View>
  )
}

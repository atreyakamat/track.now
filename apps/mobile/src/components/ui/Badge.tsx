import { View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'
import { Text } from './Text'

interface BadgeProps {
  label: string
  /** 'accent' uses the lime pill; otherwise a muted neutral pill. */
  tone?: 'neutral' | 'accent'
  color?: string
}

export function Badge({ label, tone = 'neutral', color }: BadgeProps) {
  const { colors } = useTheme()
  const bg = color ?? (tone === 'accent' ? colors.accentPrimary : colors.surfaceMuted)
  const fg = tone === 'accent' || color ? colors.accentPrimaryText : colors.textSecondary
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: 2,
        borderRadius: radius.pill,
        backgroundColor: bg,
        borderWidth: tone === 'accent' || color ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <Text variant="meta" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  )
}

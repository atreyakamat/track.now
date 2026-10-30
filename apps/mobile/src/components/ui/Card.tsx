import { View, type ViewProps } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

interface CardProps extends ViewProps {
  /** 'raised' uses the elevated surface; 'muted' the recessed one. */
  tone?: 'surface' | 'raised' | 'muted'
  padded?: boolean
}

export function Card({ tone = 'surface', padded = true, style, ...rest }: CardProps) {
  const { colors } = useTheme()
  const bg =
    tone === 'raised' ? colors.surfaceRaised : tone === 'muted' ? colors.surfaceMuted : colors.surface
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: padded ? spacing[4] : 0,
        },
        style,
      ]}
      {...rest}
    />
  )
}

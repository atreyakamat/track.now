import { Text as RNText, type TextProps as RNTextProps } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { fontSize, fontWeight } from '@/theme/tokens'

export type TextVariant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'meta'
export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success' | 'accent'

interface TextProps extends RNTextProps {
  variant?: TextVariant
  tone?: TextTone
  weight?: keyof typeof fontWeight
  center?: boolean
}

const variantStyle: Record<TextVariant, { fontSize: number; fontWeight: '400' | '500' | '600'; letterSpacing?: number; textTransform?: 'uppercase' }> = {
  display: { fontSize: fontSize.display, fontWeight: '600', letterSpacing: -0.9 },
  h1: { fontSize: fontSize.h1, fontWeight: '600', letterSpacing: -0.6 },
  h2: { fontSize: fontSize.h2, fontWeight: '600', letterSpacing: -0.3 },
  h3: { fontSize: fontSize.h3, fontWeight: '600' },
  body: { fontSize: fontSize.body, fontWeight: '400' },
  caption: { fontSize: fontSize.caption, fontWeight: '400' },
  meta: { fontSize: fontSize.meta, fontWeight: '600', letterSpacing: 0.9, textTransform: 'uppercase' },
}

export function Text({ variant = 'body', tone = 'primary', weight, center, style, ...rest }: TextProps) {
  const { colors } = useTheme()
  const toneColor: Record<TextTone, string> = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    danger: colors.danger,
    success: colors.success,
    accent: colors.accentPrimaryText,
  }
  const base = variantStyle[variant]
  return (
    <RNText
      style={[
        base,
        { color: toneColor[tone] },
        weight ? { fontWeight: fontWeight[weight] } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  )
}

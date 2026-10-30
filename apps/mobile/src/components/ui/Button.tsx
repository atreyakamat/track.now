import { ActivityIndicator, Pressable, View, type PressableProps, type ViewStyle } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing, type ThemeColors } from '@/theme/tokens'
import { Text } from './Text'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm'

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
  /** Optional icon rendered before the label. */
  icon?: React.ReactNode
  style?: ViewStyle
}

function surfaces(colors: ThemeColors, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return { bg: colors.controlBg, fg: colors.controlText, border: 'transparent' }
    case 'secondary':
      return { bg: colors.surface, fg: colors.textPrimary, border: colors.borderStrong }
    case 'ghost':
      return { bg: 'transparent', fg: colors.textSecondary, border: 'transparent' }
    case 'danger':
      return { bg: colors.danger, fg: colors.dangerText, border: 'transparent' }
  }
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  block,
  loading,
  icon,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme()
  const s = surfaces(colors, variant)
  const isDisabled = Boolean(disabled) || Boolean(loading)
  const minHeight = size === 'sm' ? 40 : 48

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          minHeight,
          paddingHorizontal: size === 'sm' ? spacing[3] : spacing[4],
          borderRadius: size === 'sm' ? radius.sm : radius.md,
          borderWidth: 1,
          borderColor: s.border,
          backgroundColor: s.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[2],
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: block ? 'stretch' : 'flex-start',
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={s.fg} size="small" />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text
            variant={size === 'sm' ? 'caption' : 'body'}
            weight="medium"
            style={{ color: s.fg }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  )
}

import { useState } from 'react'
import { TextInput, View, type TextInputProps } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'
import { Text } from './Text'

interface TextFieldProps extends TextInputProps {
  label?: string
  hint?: string
  error?: string | null
}

export function TextField({ label, hint, error, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  const borderColor = error ? colors.danger : focused ? colors.focusRing : colors.borderStrong

  return (
    <View style={{ gap: spacing.half + 4 }}>
      {label ? (
        <Text variant="caption" weight="medium">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textTertiary}
        style={[
          {
            minHeight: 48,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2] + 2,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor,
            borderRadius: radius.md,
            color: colors.textPrimary,
            fontSize: 15,
          },
          style,
        ]}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        {...rest}
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

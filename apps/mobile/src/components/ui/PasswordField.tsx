import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, TextInput, View, type TextInputProps } from 'react-native'
import { checkPassword } from '@tracknow/core/auth/password'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'
import { Text } from './Text'

interface PasswordFieldProps extends Omit<TextInputProps, 'secureTextEntry' | 'value'> {
  label: string
  value: string
  error?: string | null
  hint?: string
  /** Show the strength meter (for a new password). Never blocks submission. */
  showStrength?: boolean
}

/** Password input with a show/hide toggle and an optional strength meter. */
export function PasswordField({ label, value, error, hint, showStrength, style, onFocus, onBlur, ...rest }: PasswordFieldProps) {
  const { colors } = useTheme()
  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)
  const check = showStrength && value ? checkPassword(value) : null
  const borderColor = error ? colors.danger : focused ? colors.focusRing : colors.borderStrong
  const meterColor = check ? (check.score === 1 ? colors.danger : check.score === 2 ? colors.warning : check.score === 3 ? colors.success : colors.border) : colors.border

  return (
    <View style={{ gap: spacing.half + 4 }}>
      <Text variant="caption" weight="medium">
        {label}
      </Text>
      <View style={{ position: 'relative' }}>
        <TextInput
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          style={[
            {
              minHeight: 48,
              paddingLeft: spacing[3],
              paddingRight: 48,
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
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          hitSlop={6}
          style={{ position: 'absolute', right: 4, top: 4, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name={visible ? 'eye-off' : 'eye'} size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
      {check ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3].map((n) => (
              <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= check.score ? meterColor : colors.border }} />
            ))}
          </View>
          <Text variant="caption" tone="secondary">
            {check.label}
            {check.tip ? ` · ${check.tip}` : ''}
          </Text>
        </View>
      ) : null}
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

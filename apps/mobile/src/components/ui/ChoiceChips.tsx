import { Pressable, View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'
import { Text } from './Text'

interface ChoiceChipsProps<T extends string | number> {
  label?: string
  options: { value: T; label: string }[]
  value: T | T[]
  onChange: (value: T) => void
  /** When true, multiple can be selected (value is an array). */
  multi?: boolean
}

export function ChoiceChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  multi,
}: ChoiceChipsProps<T>) {
  const { colors } = useTheme()
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v)

  return (
    <View style={{ gap: spacing[2] }}>
      {label ? (
        <Text variant="caption" weight="medium">
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
        {options.map((opt) => {
          const active = selected(opt.value)
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              accessibilityRole={multi ? 'checkbox' : 'radio'}
              accessibilityState={{ selected: active }}
              style={{
                minHeight: 40,
                minWidth: 44,
                paddingHorizontal: spacing[3],
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: active ? colors.controlBg : colors.borderStrong,
                backgroundColor: active ? colors.controlBg : colors.surface,
              }}
            >
              <Text
                variant="caption"
                weight={active ? 'semibold' : 'medium'}
                style={{ color: active ? colors.controlText : colors.textPrimary }}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

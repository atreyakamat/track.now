import { Pressable, View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'
import { Text } from './Text'

interface SegmentedProps<T extends string> {
  options: { key: T; label: string }[]
  value: T
  onChange: (next: T) => void
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.md,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.key
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.key)}
            style={{
              flex: 1,
              minHeight: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              backgroundColor: active ? colors.surfaceRaised : 'transparent',
            }}
          >
            <Text variant="caption" weight={active ? 'semibold' : 'medium'} tone={active ? 'primary' : 'secondary'}>
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

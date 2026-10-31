import DateTimePicker from '@react-native-community/datetimepicker'
import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'
import { Text } from './Text'

interface DateFieldProps {
  label?: string
  /** YYYY-MM-DD or null. */
  value: string | null
  onChange: (next: string | null) => void
  placeholder?: string
  clearable?: boolean
  error?: string | null
}

function toDate(value: string | null): Date {
  if (value) {
    const d = new Date(`${value}T00:00:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date(`${getTodayDateString()}T00:00:00`)
}

function fromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function label(value: string | null): string {
  if (!value) return ''
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function DateField({ label: fieldLabel, value, onChange, placeholder = 'Select a date', clearable, error }: DateFieldProps) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <View style={{ gap: spacing.half + 4 }}>
      {fieldLabel ? (
        <Text variant="caption" weight="medium">
          {fieldLabel}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          minHeight: 48,
          paddingHorizontal: spacing[3],
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.borderStrong,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
        }}
      >
        <Feather name="calendar" size={16} color={colors.textTertiary} />
        <Text variant="body" tone={value ? 'primary' : 'tertiary'} style={{ flex: 1 }}>
          {value ? label(value) : placeholder}
        </Text>
        {clearable && value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel="Clear date">
            <Feather name="x" size={16} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </Pressable>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      {open ? (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, selected) => {
            setOpen(Platform.OS === 'ios' && event.type !== 'dismissed' ? false : false)
            if (event.type === 'set' && selected) onChange(fromDate(selected))
          }}
        />
      ) : null}
    </View>
  )
}

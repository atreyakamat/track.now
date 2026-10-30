import { ActivityIndicator, View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'
import { Button } from './Button'
import { Text } from './Text'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ alignItems: 'center', gap: spacing[3], paddingVertical: spacing[7] }}>
      <ActivityIndicator color={colors.textPrimary} />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  )
}

interface MessageStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: { label: string; onPress: () => void }
}

export function EmptyState({ title, description, icon, action }: MessageStateProps) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        alignItems: 'center',
        gap: spacing[3],
        paddingVertical: spacing[7],
        paddingHorizontal: spacing[5],
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.borderStrong,
        borderRadius: radius.lg,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
          }}
        >
          {icon}
        </View>
      ) : null}
      <Text variant="h3" center>
        {title}
      </Text>
      {description ? (
        <Text variant="caption" tone="secondary" center>
          {description}
        </Text>
      ) : null}
      {action ? <Button title={action.label} size="sm" onPress={action.onPress} /> : null}
    </View>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={onRetry ? { label: 'Try again', onPress: onRetry } : undefined}
    />
  )
}

import { Modal, Pressable, View } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'
import { Button } from './Button'
import { Text } from './Text'

interface ConfirmDialogProps {
  visible: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** A centered modal with a title, message and confirm/cancel buttons. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: colors.scrim,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[4],
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing[5],
            gap: spacing[4],
          }}
        >
          <View style={{ gap: spacing[2] }}>
            <Text variant="h2">{title}</Text>
            {message ? (
              <Text variant="caption" tone="secondary">
                {message}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] }}>
            <Button title={cancelLabel} variant="ghost" size="sm" onPress={onCancel} />
            <Button
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              size="sm"
              onPress={onConfirm}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

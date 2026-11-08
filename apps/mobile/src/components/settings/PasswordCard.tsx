import { useRef, useState } from 'react'
import { View } from 'react-native'
import { authService } from '@tracknow/core/auth/authService'
import { MIN_PASSWORD_LENGTH } from '@tracknow/core/auth/password'
import { Button, Card, PasswordField, Text } from '@/components/ui'
import { useToast } from '@/features/notifications/ToastContext'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

/** Change password while signed in. The current password is verified first. */
export function PasswordCard({ email }: { email: string }) {
  const { showToast } = useToast()
  const { colors } = useTheme()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)

  const submit = async () => {
    if (submitting.current) return
    if (!current) return setError('Enter your current password.')
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`The new password should be at least ${MIN_PASSWORD_LENGTH} characters.`)
    if (next !== confirm) return setError('The new passwords do not match.')
    if (next === current) return setError('Choose a new password that is different from your current one.')
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      await authService.changePassword(email, current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      showToast({ title: 'Password changed', message: 'Use the new password next time you sign in.', type: 'success' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <Card style={{ gap: spacing[3] }}>
      <Text variant="meta" tone="tertiary">
        Password
      </Text>
      <Text variant="caption" tone="secondary">
        Change the password for {email}. Forgot it? Sign out and use “Forgot password?” on the sign-in screen.
      </Text>
      {error ? (
        <View style={{ borderWidth: 1, borderColor: colors.danger, borderRadius: 8, padding: spacing[2] }}>
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        </View>
      ) : null}
      <PasswordField label="Current password" value={current} onChangeText={setCurrent} autoComplete="current-password" editable={!busy} />
      <PasswordField label="New password" value={next} onChangeText={setNext} autoComplete="new-password" placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} editable={!busy} showStrength />
      <PasswordField
        label="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
        editable={!busy}
        error={confirm && confirm !== next ? 'Does not match the new password.' : null}
      />
      <Button title={busy ? 'Changing password…' : 'Change password'} variant="secondary" size="sm" loading={busy} onPress={submit} />
    </Card>
  )
}

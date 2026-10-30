import { Link } from 'expo-router'
import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, View } from 'react-native'
import { authService } from '@tracknow/core/auth/authService'
import { Button, Card, Screen, Text, TextField } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

function BrandMark() {
  const { colors } = useTheme()
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.md,
        backgroundColor: colors.controlBg,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
      }}
    >
      <Text variant="h2" style={{ color: colors.controlText }}>
        T
      </Text>
    </View>
  )
}

function Alert({ kind, children }: { kind: 'error' | 'info' | 'success'; children: string }) {
  const { colors } = useTheme()
  const color = kind === 'error' ? colors.danger : kind === 'success' ? colors.success : colors.textSecondary
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: kind === 'info' ? colors.borderStrong : color,
        backgroundColor: kind === 'info' ? colors.surfaceMuted : 'transparent',
        borderRadius: radius.md,
        padding: spacing[3],
      }}
    >
      <Text variant="caption" style={{ color: kind === 'info' ? colors.textSecondary : color }}>
        {children}
      </Text>
    </View>
  )
}

export default function LoginScreen() {
  const { signIn, notice, clearNotice } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [isResetMode, setIsResetMode] = useState(false)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const submitting = useRef(false)

  const handleSignIn = async () => {
    if (submitting.current || busy) return
    if (!email.trim() || !password) {
      setError('Please provide both email and password.')
      return
    }
    submitting.current = true
    setBusy(true)
    setError(null)
    clearNotice()
    try {
      await signIn(email.trim(), password)
      // The root AuthGate redirects into the app once the session is authenticated.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const handleReset = async () => {
    if (submitting.current || busy) return
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    submitting.current = true
    setBusy(true)
    setError(null)
    setResetSuccess(null)
    try {
      await authService.resetPasswordForEmail(email.trim())
      setResetSuccess(
        'If an account exists for that email, a password reset link is on its way. Open it on this device to choose a new password.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <Screen contentStyle={{ justifyContent: 'center', flexGrow: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Card style={{ gap: spacing[4] }}>
          <View style={{ gap: spacing[2], alignItems: 'center' }}>
            <BrandMark />
            <Text variant="h1" center>
              {isResetMode ? 'Reset password' : 'Sign in to Track.now'}
            </Text>
            <Text variant="caption" tone="secondary" center>
              {isResetMode
                ? 'Enter your account email to receive a password reset link.'
                : 'A personal operating system for execution.'}
            </Text>
          </View>

          {notice && !isResetMode ? <Alert kind="info">{notice}</Alert> : null}
          {resetSuccess ? <Alert kind="success">{resetSuccess}</Alert> : null}
          {error ? <Alert kind="error">{error}</Alert> : null}

          <TextField
            label="Email"
            placeholder="you@domain.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
          />

          {!isResetMode ? (
            <>
              <TextField
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoComplete="current-password"
                secureTextEntry
              />
              <View style={{ alignItems: 'flex-end', marginTop: -spacing[2] }}>
                <Button
                  title="Forgot password?"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    setIsResetMode(true)
                    setError(null)
                  }}
                />
              </View>
            </>
          ) : null}

          <Button
            title={
              isResetMode
                ? busy
                  ? 'Sending link…'
                  : 'Send reset link'
                : busy
                  ? 'Signing in…'
                  : 'Sign in'
            }
            block
            loading={busy}
            onPress={isResetMode ? handleReset : handleSignIn}
          />

          {isResetMode ? (
            <Button
              title="Back to sign in"
              variant="ghost"
              size="sm"
              block
              onPress={() => {
                setIsResetMode(false)
                setError(null)
                setResetSuccess(null)
              }}
            />
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing[1] }}>
              <Text variant="caption" tone="secondary">
                Don&apos;t have an account yet?
              </Text>
              <Link href="/(auth)/signup">
                <Text variant="caption" weight="semibold">
                  Create one
                </Text>
              </Link>
            </View>
          )}
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  )
}

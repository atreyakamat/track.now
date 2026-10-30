import { Link } from 'expo-router'
import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, View } from 'react-native'
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

export default function SignupScreen() {
  const { signUp } = useAuth()
  const { colors } = useTheme()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)

  const handleSubmit = async () => {
    if (submitting.current || busy) return
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      const res = await signUp(email.trim(), password, displayName.trim() || email.split('@')[0])
      if (!res.signedIn) {
        setSuccessNotice(
          'Account created! Please check your email to confirm your account before logging in.',
        )
      }
      // When signedIn is true the root AuthGate redirects into the app automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
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
              Create your account
            </Text>
            <Text variant="caption" tone="secondary" center>
              Build your personal execution operating system.
            </Text>
          </View>

          {successNotice ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.success,
                borderRadius: radius.md,
                padding: spacing[3],
              }}
            >
              <Text variant="caption" style={{ color: colors.success }}>
                {successNotice}
              </Text>
            </View>
          ) : null}
          {error ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.danger,
                borderRadius: radius.md,
                padding: spacing[3],
              }}
            >
              <Text variant="caption" tone="danger">
                {error}
              </Text>
            </View>
          ) : null}

          <TextField
            label="Display name"
            placeholder="Your name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
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
          <TextField
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            secureTextEntry
          />
          <TextField
            label="Confirm password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            secureTextEntry
          />

          <Button
            title={busy ? 'Creating account…' : 'Create account'}
            block
            loading={busy}
            onPress={handleSubmit}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing[1] }}>
            <Text variant="caption" tone="secondary">
              Already have an account?
            </Text>
            <Link href="/(auth)/login">
              <Text variant="caption" weight="semibold">
                Sign in
              </Text>
            </Link>
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  )
}

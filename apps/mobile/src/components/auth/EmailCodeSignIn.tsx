import { Feather } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { authService } from '@tracknow/core/auth/authService'
import { RESET_EMAIL_COOLDOWN_SECONDS } from '@tracknow/core/auth/password'
import { track } from '@tracknow/core/services/telemetry'
import { Button, Text, TextField } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

/**
 * Passwordless sign-in: we email a 6-digit code and the user types it here. Ideal on a phone
 * (no link to open, no password to remember). `mode="signup"` creates the account when the
 * email is new; `mode="signin"` refuses unknown emails.
 */
export function EmailCodeSignIn({ mode, email, onEmailChange, displayName }: { mode: 'signin' | 'signup'; email: string; onEmailChange: (v: string) => void; displayName?: string }) {
  const { colors } = useTheme()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const submitting = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const send = async () => {
    if (submitting.current || cooldown > 0) return
    const address = email.trim()
    if (!address) return setError('Enter your email address.')
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      await authService.sendEmailCode(address, { createUser: mode === 'signup', displayName: displayName?.trim() || address.split('@')[0] })
      setStep('code')
      setCode('')
      setCooldown(RESET_EMAIL_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const verify = async (value = code) => {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      // On success the root AuthGate sees the new session and moves into the app.
      await authService.verifyEmailCode(email.trim(), value)
      track(mode === 'signup' ? 'sign_up_completed' : 'sign_in_completed', { method: 'code' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify the code.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: spacing[3] }}>
      {error ? (
        <View style={{ borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, padding: spacing[3] }}>
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        </View>
      ) : null}
      {step === 'email' ? (
        <>
          <TextField label="Email" placeholder="you@domain.com" value={email} onChangeText={onEmailChange} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" onSubmitEditing={send} />
          <Button
            title={busy ? 'Sending the code…' : cooldown > 0 ? `Send again in ${cooldown}s` : 'Email me a sign-in code'}
            block
            loading={busy}
            disabled={cooldown > 0}
            icon={<Feather name="mail" size={16} color={colors.controlText} />}
            onPress={send}
          />
          <Text variant="caption" tone="secondary" center>
            No password needed. We email a 6-digit code.
          </Text>
        </>
      ) : (
        <>
          <View style={{ borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing[3] }}>
            <Text variant="caption" tone="secondary">
              We sent a 6-digit code to {email.trim()}. It expires in about an hour. Check spam if it is not there in a minute.
            </Text>
          </View>
          <TextField
            label="6-digit code"
            value={code}
            onChangeText={(t) => {
              const v = t.replace(/\D/g, '').slice(0, 6)
              setCode(v)
              if (v.length === 6) void verify(v)
            }}
            placeholder="123456"
            keyboardType="number-pad"
            inputMode="numeric"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            autoFocus
            style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
          />
          <Button title={busy ? 'Checking…' : 'Sign in'} block loading={busy} disabled={code.length < 6} onPress={() => verify()} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Button title="Different email" variant="ghost" size="sm" onPress={() => setStep('email')} disabled={busy} />
            <Button title={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend the code'} variant="ghost" size="sm" onPress={send} disabled={busy || cooldown > 0} />
          </View>
        </>
      )}
    </View>
  )
}

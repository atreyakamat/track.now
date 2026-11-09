import { useEffect, useRef, useState } from 'react'
import { Mail } from 'lucide-react'
import { authService } from '@/features/auth/authService'
import { RESET_EMAIL_COOLDOWN_SECONDS } from '@tracknow/core/auth/password'
import { track } from '@tracknow/core/services/telemetry'
import { Button, Input } from '@/components/ui'

/**
 * Passwordless sign-in: we email a 6-digit code, the user types it here. No password, no
 * third-party account. `mode="signup"` creates the account if the email is new; `mode="signin"`
 * refuses unknown emails so nobody creates an account by mistyping.
 */
export function EmailCodeSignIn({
  mode,
  email,
  onEmailChange,
  displayName,
  onSignedIn,
}: {
  mode: 'signin' | 'signup'
  email: string
  onEmailChange: (email: string) => void
  displayName?: string
  onSignedIn: () => void
}) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const submitting = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  const send = async () => {
    if (submitting.current || cooldown > 0) return
    const address = email.trim()
    if (!address) return setError('Enter your email address.')
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      await authService.sendEmailCode(address, {
        createUser: mode === 'signup',
        displayName: displayName?.trim() || address.split('@')[0],
        redirectTo: `${window.location.origin}${mode === 'signup' ? '/start' : '/today'}`,
      })
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
      await authService.verifyEmailCode(email.trim(), value)
      track(mode === 'signup' ? 'sign_up_completed' : 'sign_in_completed', { method: 'code' })
      onSignedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify the code.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <div className="stack code-signin" style={{ gap: 'var(--space-3)' }}>
      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}
      {step === 'email' ? (
        <>
          <Input
            name="email"
            label="Email"
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            autoComplete="email"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void send()
              }
            }}
          />
          <Button type="button" variant="primary" block onClick={() => void send()} disabled={busy || cooldown > 0} aria-busy={busy}>
            <Mail size={16} aria-hidden="true" /> {busy ? 'Sending the code…' : cooldown > 0 ? `Send again in ${cooldown}s` : 'Email me a sign-in code'}
          </Button>
          <p className="t-caption" style={{ margin: 0, textAlign: 'center' }}>
            {mode === 'signup' ? 'No password needed. We email a 6-digit code to confirm it is you.' : 'We email a 6-digit code. No password needed.'}
          </p>
        </>
      ) : (
        <div className="stack fade-up" style={{ gap: 'var(--space-3)' }}>
          <p className="alert alert--info" role="status" style={{ margin: 0 }}>
            We sent a 6-digit code to <strong>{email.trim()}</strong>. It expires in about an hour. Check spam if it is not there in a minute.
          </p>
          <Input
            autoFocus
            name="one-time-code"
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={8}
            placeholder="123456"
            value={code}
            className="control code-signin__code"
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6)
              setCode(v)
              if (v.length === 6) void verify(v)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void verify()
              }
            }}
          />
          <Button type="button" variant="primary" block onClick={() => void verify()} disabled={busy || code.length < 6} aria-busy={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </Button>
          <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStep('email')} disabled={busy}>
              Use a different email
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void send()} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend the code'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

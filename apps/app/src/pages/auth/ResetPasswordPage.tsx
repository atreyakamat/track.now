import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { authService } from '@/features/auth/authService'
import { Button, Input, LoadingState } from '@/components/ui'

/**
 * Landing page for the password-recovery email link.
 *
 * Supabase signs the user in from the link (detectSessionInUrl, PKCE `?code=`) and emits
 * PASSWORD_RECOVERY; this page then lets them choose a new password via
 * supabase.auth.updateUser. The form is shown ONLY for a recovery session: an ordinary
 * signed-in session (e.g. someone at an unlocked computer) cannot set a new password here.
 */

/** Reads an auth error that Supabase appends to the redirect (`#error_description=…`). */
export function readLinkError(hash: string, search: string): string | null {
  for (const raw of [hash.replace(/^#/, ''), search.replace(/^\?/, '')]) {
    const params = new URLSearchParams(raw)
    const description = params.get('error_description') || params.get('error')
    if (description) return description.replace(/\+/g, ' ').slice(0, 200)
  }
  return null
}
export function ResetPasswordPage() {
  const { status, passwordRecovery, completePasswordRecovery, signOut } = useAuth()
  const [leaving, setLeaving] = useState(false)

  // A recovery session is routed here from every page; signing out is the way to abandon it.
  const cancelRecovery = async () => {
    if (leaving) return
    setLeaving(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out. Please try again.')
      setLeaving(false)
    }
  }
  const linkError = useMemo(
    () => (typeof window === 'undefined' ? null : readLinkError(window.location.hash, window.location.search)),
    [],
  )
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const submittingRef = useRef(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    if (password.length < 6) {
      setError('Password should be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    submittingRef.current = true
    setBusy(true)
    setError(null)
    try {
      await authService.updatePassword(password)
      completePasswordRecovery()
      setDone(true)
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password.')
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div style={{ textAlign: 'center' }}>
          <div
            className="brand__mark"
            style={{ width: '36px', height: '36px', margin: '0 auto var(--space-2)', fontSize: '18px' }}
            aria-hidden="true"
          >
            T
          </div>
          <h1 className="t-h1">Choose a new password</h1>
          <p className="t-caption" style={{ marginTop: '4px' }}>
            Set the password you will use to sign in to Track.now.
          </p>
        </div>

        {status === 'loading' && <LoadingState label="Verifying your reset link…" />}

        {status !== 'loading' && linkError && !done && (
          <div className="auth__form">
            <div className="alert alert--error" role="alert">
              This password reset link could not be used ({linkError}). Request a new link from the sign-in page.
            </div>
            <Link to="/login" className="btn btn--primary btn--block">
              Back to Sign In
            </Link>
          </div>
        )}

        {status === 'authenticated' && !passwordRecovery && !done && !linkError && (
          <div className="auth__form">
            <div className="alert alert--info" role="status">
              For your security, a new password can only be set from the link in a password reset email. Sign out and
              use “Forgot password?” on the sign-in page to receive one.
            </div>
            <Link to="/settings" className="btn btn--primary btn--block">
              Back to Settings
            </Link>
          </div>
        )}

        {(status === 'unauthenticated' || status === 'offline') && !linkError && (
          <div className="auth__form">
            <div className="alert alert--error" role="alert">
              This password reset link is invalid or has expired. Request a new link from the sign-in page.
            </div>
            <Link to="/login" className="btn btn--primary btn--block">
              Back to Sign In
            </Link>
          </div>
        )}

        {status === 'authenticated' && done && (
          <div className="auth__form">
            <div className="alert alert--success" role="status">
              Your password has been updated.
            </div>
            <Button variant="primary" block onClick={() => navigate('/dashboard', { replace: true })}>
              Continue to Dashboard
            </Button>
          </div>
        )}

        {status === 'authenticated' && passwordRecovery && !done && !linkError && (
          <form onSubmit={handleSubmit} className="auth__form" noValidate aria-busy={busy}>
            {error && (
              <div className="alert alert--error" role="alert">
                {error}
              </div>
            )}
            <Input
              name="new-password"
              label="New password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
              autoFocus
            />
            <Input
              name="confirm-new-password"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={busy}
              required
            />
            <Button type="submit" variant="primary" block disabled={busy || leaving}>
              {busy ? 'Updating password…' : 'Update Password'}
            </Button>
            <Button type="button" variant="ghost" block disabled={busy || leaving} onClick={cancelRecovery}>
              {leaving ? 'Signing out…' : 'Cancel and sign out'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

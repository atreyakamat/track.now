import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { authService } from '@/features/auth/authService'
import { Button, Input } from '@/components/ui'

export function LoginPage() {
  const { signIn, notice, clearNotice } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [isResetMode, setIsResetMode] = useState(false)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Please provide both email and password.')
      return
    }

    try {
      setBusy(true)
      setError(null)
      clearNotice()
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      await signIn(email.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setBusy(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    try {
      setBusy(true)
      setError(null)
      setResetSuccess(null)
      await authService.resetPasswordForEmail(email.trim())
      setResetSuccess('Password reset instructions have been sent to your email.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div style={{ textAlign: 'center' }}>
          <div
            className="brand__mark"
            style={{
              width: '36px',
              height: '36px',
              margin: '0 auto var(--space-2)',
              fontSize: '18px',
            }}
            aria-hidden="true"
          >
            T
          </div>
          <h1 className="t-h1">{isResetMode ? 'Reset password' : 'Sign in to Track.now'}</h1>
          <p className="t-caption" style={{ marginTop: '4px' }}>
            {isResetMode
              ? 'Enter your account email to receive a password reset link.'
              : 'A personal operating system for execution.'}
          </p>
        </div>

        {isResetMode ? (
          <form onSubmit={handleResetPassword} className="auth__form" noValidate>
            {resetSuccess && <div className="alert alert--success">{resetSuccess}</div>}
            {error && <div className="alert alert--error">{error}</div>}

            <Input
              name="email"
              label="Email"
              type="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />

            <Button type="submit" variant="primary" block disabled={busy}>
              {busy ? 'Sending link…' : 'Send Reset Link'}
            </Button>

            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ marginTop: 'var(--space-2)' }}
              onClick={() => {
                setIsResetMode(false)
                setError(null)
                setResetSuccess(null)
              }}
            >
              Back to Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="auth__form" noValidate>
            {notice && <div className="alert alert--info">{notice}</div>}
            {error && <div className="alert alert--error">{error}</div>}

            <Input
              name="email"
              label="Email"
              type="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />

            <Input
              name="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ padding: 0, height: 'auto', minHeight: 0, fontSize: 'var(--text-caption)' }}
                onClick={() => {
                  setIsResetMode(true)
                  setError(null)
                }}
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" variant="primary" block disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        )}

        <p className="auth__alt">
          Don't have an account yet? <Link to="/signup">Create one</Link>
        </p>
        <p className="auth__alt" style={{ marginTop: 'var(--space-2)' }}>
          <a href="https://tracknow.atreyakamat.dev" style={{ color: 'var(--text-secondary)' }}>
            ← Back to Track.now
          </a>
        </p>
      </div>
    </div>
  )
}

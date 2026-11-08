import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button, Input, PasswordInput } from '@/components/ui'
import { BrandMark } from '@/components/ui/BrandMark'

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isSubmittingRef = useRef(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    // Prevent duplicate in-flight requests from rapid clicks or Enter key repeats
    if (isSubmittingRef.current || busy) {
      return
    }

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

    isSubmittingRef.current = true
    setBusy(true)
    setError(null)

    try {
      // Dismiss any open browser autofill/password suggestion popups cleanly
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }

      const res = await signUp(
        email.trim(),
        password,
        displayName.trim() || email.split('@')[0],
      )

      if (res.signedIn) {
        navigate('/today', { replace: true })
      } else {
        setSuccessNotice(
          'Account created! Please check your email to confirm your account before logging in.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      isSubmittingRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-2)' }}>
            <BrandMark size={44} />
          </div>
          <h1 className="t-h1">Create your Track.now account</h1>
          <p className="t-caption" style={{ marginTop: '4px' }}>
            Build your personal execution operating system.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (isSubmittingRef.current || busy)) {
              e.preventDefault()
            }
          }}
          className="auth__form"
          noValidate
        >
          {successNotice ? (
            <div className="alert alert--info" role="status" style={{ textAlign: 'center' }}>
              <p>{successNotice}</p>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Link to="/login" className="btn btn--primary btn--sm">
                  Go to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="alert alert--error" role="alert">
                  {error}
                </div>
              )}

              <Input
                name="displayName"
                label="Your Name or Alias"
                placeholder="Alex, Builder, Athlete"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                disabled={busy}
                autoFocus
              />

              <Input
                name="email"
                label="Email"
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={busy}
                required
              />

              <PasswordInput
                name="password"
                label="Password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={busy}
                required
                showStrength
              />

              <PasswordInput
                name="confirmPassword"
                label="Confirm Password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={busy}
                required
                error={confirmPassword && confirmPassword !== password ? 'Does not match the password above.' : null}
              />

              <Button
                type="submit"
                variant="primary"
                block
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? 'Creating Account…' : 'Sign Up'}
              </Button>
            </>
          )}
        </form>

        <p className="auth__alt">
          Already have an account? <Link to="/login">Sign in</Link>
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

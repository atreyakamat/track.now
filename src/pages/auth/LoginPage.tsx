import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button, Input } from '@/components/ui'

export function LoginPage() {
  const { signIn, notice, clearNotice } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
      await signIn(email.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
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
          <h1 className="t-h1">Sign in to Track.now</h1>
          <p className="t-caption" style={{ marginTop: '4px' }}>
            A personal operating system for execution.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth__form">
          {notice && <div className="alert alert--info">{notice}</div>}
          {error && <div className="alert alert--error">{error}</div>}

          <Input
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
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <Button type="submit" variant="primary" block disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <p className="auth__alt">
          Don't have an account yet? <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  )
}

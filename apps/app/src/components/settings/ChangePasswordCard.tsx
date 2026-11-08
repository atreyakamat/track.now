import { useRef, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { authService } from '@/features/auth/authService'
import { useToast } from '@/features/notifications/ToastContext'
import { Button, PasswordInput } from '@/components/ui'
import { MIN_PASSWORD_LENGTH } from '@tracknow/core/auth/password'

/**
 * Change password while signed in. The current password is checked first, so the
 * emailed reset link stays the only way in for someone who does not know it.
 */
export function ChangePasswordCard({ email }: { email: string }) {
  const { showToast } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
    <section className="card" aria-labelledby="settings-password-heading">
      <h2 id="settings-password-heading" className="t-h2 row" style={{ alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <KeyRound size={18} aria-hidden="true" /> Password
      </h2>
      <p className="t-caption" style={{ marginBottom: 'var(--space-4)' }}>
        Change the password for {email}. Forgot it? Sign out and use “Forgot password?” on the sign-in page to get a
        reset link by email.
      </p>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--space-3)', maxWidth: 420 }} noValidate aria-busy={busy}>
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}
        {/* Hidden username field so password managers file the change under the right account. */}
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden aria-hidden="true" tabIndex={-1} />
        <PasswordInput
          name="current-password"
          label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={busy}
          required
        />
        <PasswordInput
          name="new-password"
          label="New password"
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          disabled={busy}
          required
          showStrength
        />
        <PasswordInput
          name="confirm-new-password"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
          required
          error={confirm && confirm !== next ? 'Does not match the new password.' : null}
        />
        <div>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Changing password…' : 'Change password'}
          </Button>
        </div>
      </form>
    </section>
  )
}

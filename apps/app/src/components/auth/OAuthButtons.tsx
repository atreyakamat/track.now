import { useState } from 'react'
import { authService } from '@/features/auth/authService'
import { Button } from '@/components/ui'

/**
 * Google / Apple sign-in. Supabase handles the OAuth round-trip; the buttons work as soon as
 * the provider is enabled in the Supabase dashboard (until then, a clear message says so).
 */
export function OAuthButtons({ onError }: { onError: (message: string) => void }) {
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null)
  const go = async (provider: 'google' | 'apple') => {
    if (busy) return
    setBusy(provider)
    try {
      await authService.signInWithProvider(provider, `${window.location.origin}/today`)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not start sign-in.')
      setBusy(null)
    }
  }
  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      <Button type="button" variant="secondary" block onClick={() => void go('google')} disabled={Boolean(busy)} aria-busy={busy === 'google'}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1C3.2 21.3 7.3 24 12 24z" />
          <path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8l4.1-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l4.1 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
        </svg>
        {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </Button>
      <Button type="button" variant="secondary" block onClick={() => void go('apple')} disabled={Boolean(busy)} aria-busy={busy === 'apple'}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.2-.9-1.7 0-3.2 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.2-1.2 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.8-1.1-3.1-4zM14 5.3c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.4z" />
        </svg>
        {busy === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}
      </Button>
      <div className="row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span className="t-meta">or with email</span>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
    </div>
  )
}

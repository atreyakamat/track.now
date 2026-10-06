import { LogOut, Moon, Sun, User } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/hooks/useTheme'
import { Button, PageHeader } from '@/components/ui'

export function SettingsPage() {
  const { user, profile, displayName, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (err) {
      console.error('Sign out failed:', err)
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account profile, preferences, and workspace configuration."
      />

      <div className="stack" style={{ gap: 'var(--space-6)', maxWidth: '640px' }}>
        {/* Profile Info */}
        <section className="card">
          <div className="row" style={{ alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div
              className="icon-chip"
              style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-text)' }}
            >
              <User size={20} />
            </div>
            <div>
              <h2 className="t-h2">{displayName}</h2>
              <p className="t-caption">{user?.email}</p>
            </div>
          </div>

          <div className="stack" style={{ gap: 'var(--space-2)', fontSize: 'var(--text-caption)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="t-muted">User ID</span>
              <code style={{ fontSize: '0.75rem' }}>{user?.id}</code>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="t-muted">Timezone</span>
              <span>{profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
          </div>
        </section>

        {/* Appearance Settings */}
        <section className="card">
          <h3 className="t-h3" style={{ marginBottom: 'var(--space-3)' }}>
            Appearance & Theme
          </h3>
          <p className="t-caption" style={{ marginBottom: 'var(--space-4)' }}>
            Toggle between the warm cream editorial light mode and the near-black focused dark mode.
          </p>

          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Current Theme: <strong>{theme === 'light' ? 'Warm Cream (Light)' : 'Near Black (Dark)'}</strong></span>
            <Button variant="secondary" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              <span>Switch to {theme === 'light' ? 'Dark' : 'Light'}</span>
            </Button>
          </div>
        </section>

        {/* Session / Account Actions */}
        <section className="card">
          <h3 className="t-h3" style={{ marginBottom: 'var(--space-3)' }}>
            Account Session
          </h3>
          <p className="t-caption" style={{ marginBottom: 'var(--space-4)' }}>
            Signed in with Supabase Authentication. Passwords are never stored on device.
          </p>

          <Button variant="danger" onClick={handleSignOut}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </Button>
        </section>
      </div>
    </div>
  )
}

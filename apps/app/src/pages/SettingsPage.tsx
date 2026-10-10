import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Bell,
  Info,
  LogOut,
  Moon,
  RefreshCw,
  Save,
  Smartphone,
  Sun,
  User,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/hooks/useTheme'
import { updateProfile } from '@/services/tracksService'
import { Button, Input, PageHeader, Select } from '@/components/ui'
import { useToast } from '@/features/notifications/ToastContext'
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '@/services/notificationPreferences'
import {
  dispatchBrowserNotification,
  requestNotificationPermission,
} from '@/services/webNotificationEngine'
import {
  buildWidgetDataPayload,
  loadWidgetData,
  saveWidgetData,
} from '@/services/widgetDataService'
import { listTodayExecutionItems } from '@/services/executionService'
import type { NotificationPreferences, ReminderPreset } from '@/types/notifications'

export function SettingsPage() {
  const { user, profile, displayName, signOut, refreshProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { showToast } = useToast()

  const [nameInput, setNameInput] = useState(displayName)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Notification and Widget preferences
  const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
    loadNotificationPreferences(user?.id || ''),
  )
  const [permissionState, setPermissionState] = useState<NotificationPermission>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default',
  )
  const [widgetInfo, setWidgetInfo] = useState(() => loadWidgetData())
  const [syncingWidget, setSyncingWidget] = useState(false)

  useEffect(() => {
    if (displayName) setNameInput(displayName)
  }, [displayName])

  useEffect(() => {
    if (user?.id) {
      setPrefs(loadNotificationPreferences(user.id))
      setWidgetInfo(loadWidgetData())
    }
  }, [user?.id])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!nameInput.trim()) {
      setErrorMsg('Display name cannot be empty')
      return
    }

    try {
      setSaving(true)
      setErrorMsg(null)
      setSuccessMsg(null)
      await updateProfile(user.id, {
        full_name: nameInput.trim(),
      })
      await refreshProfile()
      setSuccessMsg('Profile updated successfully')
      setTimeout(() => setSuccessMsg(null), 3500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (err) {
      console.error('Sign out failed:', err)
    }
  }

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission()
    setPermissionState(perm)
    if (perm === 'granted' && user) {
      const updated = { ...prefs, masterEnabled: true }
      setPrefs(updated)
      saveNotificationPreferences(user.id, updated)
      showToast({
        title: 'Notifications Granted',
        message: 'Track.now will proactively remind you of your scheduled execution items.',
        type: 'success',
      })
    } else if (perm === 'denied') {
      showToast({
        title: 'Permission Denied',
        message: 'Please allow notifications in your browser settings to receive reminders.',
        type: 'warning',
      })
    }
  }

  const updatePref = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => {
    if (!user) return
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    saveNotificationPreferences(user.id, updated)
  }

  const handleTestNotification = async () => {
    showToast({
      id: `test-toast-${Date.now()}`,
      title: 'Track.now Test Notification',
      message: 'In-app celebratory feedback is functioning smoothly.',
      nextUp: "Today's Execution Queue",
      type: 'info',
    })

    if (permissionState === 'granted') {
      await dispatchBrowserNotification('Track.now Test Notification', {
        body: 'Smart reminders are active and ready.',
        data: { url: '/today' },
      })
    }
  }

  const handleForceSyncWidget = async () => {
    if (!user) return
    try {
      setSyncingWidget(true)
      const items = await listTodayExecutionItems()
      const payload = await buildWidgetDataPayload(user.id, items)
      saveWidgetData(payload)
      setWidgetInfo(payload)
      showToast({
        title: 'Widget Synchronized',
        message: `${payload.items.length} items formatted for Android and iOS widgets.`,
        type: 'success',
      })
    } catch (err) {
      console.error('Widget sync failed:', err)
      showToast({
        title: 'Sync Failed',
        message: 'Could not refresh widget payload.',
        type: 'warning',
      })
    } finally {
      setSyncingWidget(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account profile, preferences, and workspace configuration."
      />

      <div className="stack" style={{ gap: 'var(--space-6)', maxWidth: '680px' }}>
        {/* Profile Info & Editing */}
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

          <form onSubmit={handleSaveProfile} className="form" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            {successMsg && <div className="alert alert--success">{successMsg}</div>}
            {errorMsg && <div className="alert alert--error">{errorMsg}</div>}

            <Input
              label="Display Name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name"
              required
            />

            <Button type="submit" variant="primary" size="sm" disabled={saving} style={{ alignSelf: 'flex-start' }}>
              <Save size={14} />
              <span>{saving ? 'Saving…' : 'Save Profile'}</span>
            </Button>
          </form>

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

        {/* Smart Reminders & Notifications */}
        <section className="card">
          <div className="row" style={{ alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div
              className="icon-chip"
              style={{ background: 'var(--control-bg)', color: 'var(--control-text)' }}
            >
              <Bell size={20} />
            </div>
            <div>
              <h2 className="t-h2">Smart Reminders & Notifications</h2>
              <p className="t-caption">Configure proactive reminders, celebrations, and system alerts.</p>
            </div>
          </div>

          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            {/* Permission Status */}
            <div
              className="row"
              style={{
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-3)',
                background: 'var(--surface-muted)',
                borderRadius: 'var(--radius-md)',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
              }}
            >
              <div>
                <span style={{ fontWeight: 600, fontSize: 'var(--text-body)' }}>Browser Permission: </span>
                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{permissionState}</span>
              </div>
              {permissionState !== 'granted' && (
                <Button variant="secondary" size="sm" onClick={handleRequestPermission}>
                  Enable Browser Notifications
                </Button>
              )}
            </div>

            {permissionState === 'denied' && (
              <div
                className="alert alert--error"
                style={{ fontSize: 'var(--text-caption)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Notifications are blocked in your browser.</strong>
                  <br />
                  To receive reminders, click the padlock/settings icon beside the URL in your browser address bar and set <strong>Notifications</strong> to <strong>Allow</strong>.
                </div>
              </div>
            )}

            {/* Master Toggle */}
            <label
              className="row"
              style={{
                alignItems: 'center',
                gap: 'var(--space-3)',
                cursor: 'pointer',
                padding: 'var(--space-2) 0',
              }}
            >
              <input
                type="checkbox"
                checked={prefs.masterEnabled}
                onChange={(e) => updatePref('masterEnabled', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontWeight: 600, display: 'block' }}>Master Notification Toggle</span>
                <span className="t-caption">Turn all smart reminders and background notifications on or off.</span>
              </div>
            </label>

            {prefs.masterEnabled && (
              <div
                className="stack"
                style={{
                  gap: 'var(--space-3)',
                  paddingLeft: 'var(--space-4)',
                  borderLeft: '2px solid var(--border)',
                }}
              >
                <Select
                  label="Default Reminder Preset for New Items"
                  value={prefs.defaultPreset}
                  onChange={(e) => updatePref('defaultPreset', e.target.value as ReminderPreset)}
                >
                  <option value="none">None (manual)</option>
                  <option value="10m">10 minutes before</option>
                  <option value="30m">30 minutes before</option>
                  <option value="1h">1 hour before</option>
                  <option value="2h">2 hours before</option>
                  <option value="scheduled_time">At scheduled habit time</option>
                </Select>

                <label className="row" style={{ alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={prefs.completionAcknowledgement}
                    onChange={(e) => updatePref('completionAcknowledgement', e.target.checked)}
                  />
                  <div>
                    <span style={{ fontWeight: 500 }}>Completion Celebrations & Next-Up Suggestions</span>
                    <span className="t-caption" style={{ display: 'block' }}>
                      Shows celebratory toast feedback and suggests the next item in today's queue.
                    </span>
                  </div>
                </label>

                <label className="row" style={{ alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={prefs.overdueRemindersEnabled}
                    onChange={(e) => updatePref('overdueRemindersEnabled', e.target.checked)}
                  />
                  <div>
                    <span style={{ fontWeight: 500 }}>Overdue Item Alerts</span>
                    <span className="t-caption" style={{ display: 'block' }}>
                      Alerts when tasks pass their designated due date.
                    </span>
                  </div>
                </label>

                <label className="row" style={{ alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={prefs.dailySummaryEnabled}
                    onChange={(e) => updatePref('dailySummaryEnabled', e.target.checked)}
                  />
                  <div>
                    <span style={{ fontWeight: 500 }}>Daily Execution Briefing</span>
                    <span className="t-caption" style={{ display: 'block' }}>
                      Presents a daily morning summary of planned execution items.
                    </span>
                  </div>
                </label>

                {prefs.dailySummaryEnabled && (
                  <div style={{ maxWidth: '200px' }}>
                    <Input
                      label="Briefing Time"
                      type="time"
                      value={prefs.dailySummaryTime}
                      onChange={(e) => updatePref('dailySummaryTime', e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="row" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" size="sm" onClick={handleTestNotification}>
                Send Test Notification
              </Button>
            </div>

            {/* Platform Capability Matrix */}
            <div style={{ marginTop: 'var(--space-3)' }}>
              <h4 className="t-h3" style={{ fontSize: '0.9rem', marginBottom: 'var(--space-2)' }}>
                Platform Delivery Capabilities
              </h4>
              <div
                style={{
                  overflowX: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-muted)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-caption)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Platform Mode</th>
                      <th style={{ padding: '8px 12px' }}>Delivery Engine</th>
                      <th style={{ padding: '8px 12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>Browser Foreground</td>
                      <td style={{ padding: '8px 12px' }}>In-app accessible toast + browser notification</td>
                      <td style={{ padding: '8px 12px', color: 'var(--success, #22c55e)' }}>Supported</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>Browser Background Tab</td>
                      <td style={{ padding: '8px 12px' }}>Web Notification API & Service Worker monitor</td>
                      <td style={{ padding: '8px 12px', color: 'var(--success, #22c55e)' }}>Supported</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>App Closed (PWA)</td>
                      <td style={{ padding: '8px 12px' }}>OS Web Push Subscription (Requires backend push server)</td>
                      <td style={{ padding: '8px 12px', color: 'var(--warning, #e67e22)' }}>Device Limited</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>Native Shell (Android / iOS)</td>
                      <td style={{ padding: '8px 12px' }}>OS AlarmManager / UNUserNotificationCenter</td>
                      <td style={{ padding: '8px 12px', color: 'var(--success, #22c55e)' }}>Native Bridge Ready</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Home Screen Widgets */}
        <section className="card">
          <div className="row" style={{ alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div
              className="icon-chip"
              style={{ background: 'var(--control-bg)', color: 'var(--control-text)' }}
            >
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="t-h2">Home Screen Widgets (Android & iOS)</h2>
              <p className="t-caption">Zero-latency glanceable execution overview on your mobile home screen.</p>
            </div>
          </div>

          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <p className="t-body" style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
              Track.now provides native Small (2x2) and Medium (4x2) home screen widgets that display your today completion progress and upcoming queue items.
            </p>

            <div
              style={{
                padding: 'var(--space-3)',
                background: 'var(--surface-muted)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
              }}
            >
              <div>
                <span style={{ fontWeight: 600, fontSize: 'var(--text-body)' }}>Widget Cache Status: </span>
                <span>
                  {widgetInfo
                    ? `${widgetInfo.items.length} items cached · Updated ${new Date(widgetInfo.lastUpdated).toLocaleTimeString()}`
                    : 'Not yet synchronized'}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleForceSyncWidget}
                disabled={syncingWidget}
              >
                <RefreshCw size={14} className={syncingWidget ? 'spin' : ''} />
                <span>{syncingWidget ? 'Syncing…' : 'Force Widget Sync'}</span>
              </Button>
            </div>

            <div
              className="row"
              style={{
                gap: '8px',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-secondary)',
                alignItems: 'center',
              }}
            >
              <Info size={14} style={{ flexShrink: 0 }} />
              <span>
                <strong>Privacy Guarantee:</strong> Widget data is restricted to item titles and streak counts. Authentication tokens and passwords are never stored in widget memory, and data is completely wiped upon sign-out.
              </span>
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

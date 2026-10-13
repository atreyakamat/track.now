import { useEffect, useState } from 'react'
import { AlertCircle, Bell, Info, LogOut, Moon, RefreshCw, Save, Smartphone, Sun, User } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/hooks/useTheme'
import { updateProfile } from '@/services/tracksService'
import { Button, Input, PageHeader, Select } from '@/components/ui'
import { useToast } from '@/features/notifications/ToastContext'
import {
  getNotificationCapabilityStatus,
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '@/services/notificationPreferences'
import {
  dispatchBrowserNotification,
  isNotificationSupported,
  requestNotificationPermission,
} from '@/services/webNotificationEngine'
import { buildWidgetDataPayload, loadWidgetData, saveWidgetData } from '@/services/widgetDataService'
import { isNativePlatform } from '@/services/nativeMobileBridge'
import { listCompletionsForDate, listTodayExecutionItems } from '@/services/executionService'
import type { NotificationPreferences, ReminderPreset } from '@/types/notifications'

type PermissionState = NotificationPermission | 'unsupported'

const readPermission = (): PermissionState =>
  isNotificationSupported() ? Notification.permission : 'unsupported'

const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: 'Allowed',
  denied: 'Blocked',
  default: 'Not enabled yet',
  unsupported: 'Not supported by this browser',
}

type Support = 'yes' | 'partial' | 'no'
const SUPPORT_LABEL: Record<Support, string> = { yes: 'Works', partial: 'Limited', no: 'Not available' }
const SUPPORT_COLOR: Record<Support, string> = {
  yes: 'var(--success)',
  partial: 'var(--warning)',
  no: 'var(--text-secondary)',
}

export function SettingsPage() {
  const { user, displayName, signOut, refreshProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { showToast } = useToast()

  const [nameInput, setNameInput] = useState(displayName)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const [prefs, setPrefs] = useState<NotificationPreferences>(() => loadNotificationPreferences(user?.id || ''))
  const [permissionState, setPermissionState] = useState<PermissionState>(readPermission)
  const [widgetInfo, setWidgetInfo] = useState(() => (user?.id ? loadWidgetData(user.id) : null))
  const [syncingWidget, setSyncingWidget] = useState(false)

  useEffect(() => {
    if (displayName) setNameInput(displayName)
  }, [displayName])

  useEffect(() => {
    if (user?.id) {
      setPrefs(loadNotificationPreferences(user.id))
      setWidgetInfo(loadWidgetData(user.id))
    }
  }, [user?.id])

  // Permission can change in browser settings while the page is open.
  useEffect(() => {
    const refresh = () => setPermissionState(readPermission())
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  const capability = getNotificationCapabilityStatus({
    notificationSupported: permissionState !== 'unsupported',
    permission: permissionState === 'unsupported' ? undefined : permissionState,
    masterEnabled: prefs.masterEnabled,
  })
  const native = isNativePlatform()

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const trimmed = nameInput.trim()
    if (!trimmed) {
      setErrorMsg('Display name cannot be empty.')
      return
    }
    if (trimmed.length > 80) {
      setErrorMsg('Display name must be 80 characters or fewer.')
      return
    }
    try {
      setSaving(true)
      setErrorMsg(null)
      setSuccessMsg(null)
      await updateProfile(user.id, { full_name: trimmed })
      await refreshProfile()
      setSuccessMsg('Profile updated.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    if (signingOut) return
    try {
      setSigningOut(true)
      await signOut()
    } catch (err) {
      setSigningOut(false)
      showToast({
        title: 'Sign out failed',
        message: err instanceof Error ? err.message : 'Please try again.',
        type: 'warning',
      })
    }
  }

  const savePrefs = (updated: NotificationPreferences) => {
    if (!user) return
    setPrefs(updated)
    saveNotificationPreferences(user.id, updated)
  }

  const updatePref = <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
    savePrefs({ ...prefs, [key]: value })
  }

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission()
    setPermissionState(perm)
    if (perm === 'granted') {
      savePrefs({ ...prefs, masterEnabled: true })
      showToast({
        title: 'Browser notifications enabled',
        message: 'Reminders will also appear as system notifications while Track.now is open.',
        type: 'success',
      })
    } else if (perm === 'denied') {
      showToast({
        title: 'Notifications blocked',
        message: 'Allow notifications for this site in your browser settings to receive system alerts.',
        type: 'warning',
      })
    } else if (perm === 'unsupported') {
      showToast({
        title: 'Not supported',
        message: 'This browser does not support system notifications. In-app reminders still work.',
        type: 'info',
      })
    }
  }

  const handleTestNotification = async () => {
    const wantsBrowser = prefs.masterEnabled && permissionState === 'granted'
    const shown = wantsBrowser
      ? await dispatchBrowserNotification('Track.now test notification', {
          body: 'System notifications are working.',
          data: { url: '/settings' },
          tag: 'tracknow-test',
        })
      : false
    showToast({
      title: 'Test reminder',
      message: shown
        ? 'An in-app alert and a system notification were sent.'
        : wantsBrowser
          ? 'In-app alert shown. The system notification could not be displayed by this browser.'
          : 'In-app alert shown. System notifications are off or not permitted, so none was sent.',
      type: shown || !wantsBrowser ? 'info' : 'warning',
    })
  }

  const handleRefreshWidgetCache = async () => {
    if (!user) return
    try {
      setSyncingWidget(true)
      const [items, completedTodayIds] = await Promise.all([
        listTodayExecutionItems(),
        listCompletionsForDate(user.id),
      ])
      const payload = await buildWidgetDataPayload(user.id, items, { completedTodayIds })
      await saveWidgetData(payload)
      setWidgetInfo(payload)
      showToast({
        title: 'Widget data refreshed',
        message: native
          ? `${payload.progress.statusText}. Sent to the native widget bridge if it is installed.`
          : `${payload.progress.statusText}. Saved on this device only; no native widget is connected in the web app.`,
        type: 'success',
      })
    } catch (err) {
      showToast({
        title: 'Refresh failed',
        message: err instanceof Error ? err.message : 'Could not refresh widget data.',
        type: 'warning',
      })
    } finally {
      setSyncingWidget(false)
    }
  }

  const browserNotificationSupport: Support =
    permissionState === 'granted' && prefs.masterEnabled ? 'yes' : permissionState === 'unsupported' ? 'no' : 'partial'

  const capabilityRows: Array<{ mode: string; detail: string; support: Support }> = [
    {
      mode: 'Track.now open (active tab)',
      detail: 'In-app reminder alert, plus a system notification if enabled below.',
      support: 'yes',
    },
    {
      mode: 'Track.now open in a background tab',
      detail:
        browserNotificationSupport === 'yes'
          ? 'System notification, unless another Track.now tab is visible (that tab shows the in-app alert instead). Browsers may delay timers in background tabs; missed reminders are caught up when you return.'
          : 'Needs browser notifications to be allowed and switched on below. Otherwise reminders appear when you return to the tab.',
      support: browserNotificationSupport,
    },
    {
      mode: 'Browser or installed app fully closed',
      detail:
        'Nothing can fire: there is no push server. Reminders that came due are shown when you reopen Track.now (up to 3 individually; more than that, or anything over a day old, as one summary).',
      support: 'no',
    },
    {
      mode: 'Native Android / iOS app',
      detail: 'Not available. Widget source files exist in the repository, but no native app is built or published.',
      support: 'no',
    },
  ]

  return (
    <div>
      <PageHeader title="Settings" description="Manage your profile, reminders, and appearance." />

      <div className="stack" style={{ gap: 'var(--space-6)', maxWidth: '680px' }}>
        {/* Profile */}
        <section className="card" aria-labelledby="settings-profile-heading">
          <div className="row" style={{ alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div className="icon-chip" style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-text)' }} aria-hidden="true">
              <User size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 id="settings-profile-heading" className="t-h2">{displayName}</h2>
              <p className="t-caption" style={{ overflowWrap: 'anywhere' }}>{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="form" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }} noValidate>
            {successMsg && (
              <div className="alert alert--success" role="status">
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="alert alert--error" role="alert">
                {errorMsg}
              </div>
            )}
            <Input
              label="Display name"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value)
                setSuccessMsg(null)
              }}
              placeholder="Your name"
              maxLength={80}
              required
            />
            <Button type="submit" variant="primary" size="sm" disabled={saving} aria-busy={saving} style={{ alignSelf: 'flex-start' }}>
              <Save size={14} aria-hidden="true" />
              <span>{saving ? 'Saving…' : 'Save Profile'}</span>
            </Button>
          </form>

          <dl className="stack" style={{ gap: 'var(--space-2)', fontSize: 'var(--text-caption)', margin: 0 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <dt className="t-muted">Timezone (from this device)</dt>
              <dd style={{ margin: 0 }}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</dd>
            </div>
          </dl>
        </section>

        {/* Reminders & notifications */}
        <section className="card" aria-labelledby="settings-reminders-heading">
          <div className="row" style={{ alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div className="icon-chip" style={{ background: 'var(--control-bg)', color: 'var(--control-text)' }} aria-hidden="true">
              <Bell size={20} />
            </div>
            <div>
              <h2 id="settings-reminders-heading" className="t-h2">Reminders & Notifications</h2>
              <p className="t-caption">
                Reminders are stored on this device and fire while Track.now is open.
              </p>
            </div>
          </div>

          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            <div
              className="row"
              style={{
                justifyContent: 'space-between',
                padding: 'var(--space-3)',
                background: 'var(--surface-muted)',
                borderRadius: 'var(--radius-md)',
                gap: 'var(--space-2)',
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>Browser permission: </span>
                <span>{PERMISSION_LABEL[permissionState]}</span>
              </div>
              {(permissionState === 'default' || permissionState === 'denied') && (
                <Button variant="secondary" size="sm" onClick={handleRequestPermission} disabled={permissionState === 'denied'}>
                  Enable browser notifications
                </Button>
              )}
            </div>

            <p className="t-caption" role="status">
              {capability.explanation}
            </p>

            {permissionState === 'denied' && (
              <div className="alert alert--error" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <div>
                  Notifications are blocked for this site. Open your browser's site settings (the icon beside the
                  address bar) and set <strong>Notifications</strong> to <strong>Allow</strong>, then return here.
                </div>
              </div>
            )}

            <label className="row" style={{ gap: 'var(--space-3)', cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={prefs.masterEnabled}
                onChange={(e) => updatePref('masterEnabled', e.target.checked)}
                style={{ width: '20px', height: '20px', flexShrink: 0, marginTop: '2px' }}
              />
              <span>
                <span style={{ fontWeight: 600, display: 'block' }}>System notifications and daily alerts</span>
                <span className="t-caption">
                  Also show reminders as browser notifications (when permitted) and enable the daily briefing and
                  overdue alerts below. In-app reminder alerts always appear while Track.now is open.
                </span>
              </span>
            </label>

            {prefs.masterEnabled && (
              <div className="stack" style={{ gap: 'var(--space-3)', paddingLeft: 'var(--space-4)', borderLeft: '2px solid var(--border)' }}>
                <label className="row" style={{ gap: 'var(--space-2)', cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={prefs.completionAcknowledgement}
                    onChange={(e) => updatePref('completionAcknowledgement', e.target.checked)}
                    style={{ width: '20px', height: '20px', flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ fontWeight: 500, display: 'block' }}>Completion feedback</span>
                    <span className="t-caption">Shows a confirmation and suggests the next open item when you complete something.</span>
                  </span>
                </label>

                <label className="row" style={{ gap: 'var(--space-2)', cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={prefs.dailySummaryEnabled}
                    onChange={(e) => updatePref('dailySummaryEnabled', e.target.checked)}
                    style={{ width: '20px', height: '20px', flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ fontWeight: 500, display: 'block' }}>Daily briefing</span>
                    <span className="t-caption">
                      Once a day at the time below (or the first time you open Track.now after it), summarises what is
                      due today, scheduled habits, and overdue items.
                    </span>
                  </span>
                </label>

                <label className="row" style={{ gap: 'var(--space-2)', cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={prefs.overdueRemindersEnabled}
                    onChange={(e) => updatePref('overdueRemindersEnabled', e.target.checked)}
                    style={{ width: '20px', height: '20px', flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ fontWeight: 500, display: 'block' }}>Overdue alert</span>
                    <span className="t-caption">Once a day at the time below, lists tasks whose due date has passed.</span>
                  </span>
                </label>

                {(prefs.dailySummaryEnabled || prefs.overdueRemindersEnabled) && (
                  <div style={{ maxWidth: '220px' }}>
                    <Input
                      label="Daily alert time"
                      type="time"
                      value={prefs.dailySummaryTime}
                      onChange={(e) => updatePref('dailySummaryTime', e.target.value || '09:00')}
                    />
                  </div>
                )}
              </div>
            )}

            <Select
              label="Default reminder for new items"
              value={prefs.defaultPreset}
              onChange={(e) => updatePref('defaultPreset', e.target.value as ReminderPreset)}
              hint="Pre-selected in the Add Item form. You can change it per item."
            >
              <option value="none">None</option>
              <optgroup label="Relative to due / scheduled time">
                <option value="scheduled_time">At the scheduled time</option>
                <option value="10m_before">10 minutes before</option>
                <option value="30m_before">30 minutes before</option>
                <option value="1h_before">1 hour before</option>
                <option value="2h_before">2 hours before</option>
              </optgroup>
              <optgroup label="From now">
                <option value="10m_in">In 10 minutes</option>
                <option value="30m_in">In 30 minutes</option>
                <option value="1h_in">In 1 hour</option>
                <option value="2h_in">In 2 hours</option>
              </optgroup>
            </Select>

            <div className="row">
              <Button variant="secondary" size="sm" onClick={handleTestNotification}>
                Send test reminder
              </Button>
            </div>

            <div>
              <h3 className="t-h3" style={{ marginBottom: 'var(--space-2)' }}>
                Where reminders can reach you
              </h3>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-muted)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-caption)' }}>
                  <caption className="sr-only">Reminder delivery by situation</caption>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th scope="col" style={{ padding: '8px 12px' }}>Situation</th>
                      <th scope="col" style={{ padding: '8px 12px' }}>What happens</th>
                      <th scope="col" style={{ padding: '8px 12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capabilityRows.map((row, idx) => (
                      <tr key={row.mode} style={idx < capabilityRows.length - 1 ? { borderBottom: '1px solid var(--border)' } : undefined}>
                        <th scope="row" style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'left', verticalAlign: 'top' }}>
                          {row.mode}
                        </th>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>{row.detail}</td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top', color: SUPPORT_COLOR[row.support], fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {SUPPORT_LABEL[row.support]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Widgets */}
        <section className="card" aria-labelledby="settings-widgets-heading">
          <div className="row" style={{ alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div className="icon-chip" style={{ background: 'var(--control-bg)', color: 'var(--control-text)' }} aria-hidden="true">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 id="settings-widgets-heading" className="t-h2">Home-screen widgets</h2>
              <p className="t-caption">Not available yet: there is no published native Android or iOS app.</p>
            </div>
          </div>

          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <p className="t-caption">
              Track.now keeps a small widget data snapshot of today's queue on this device (item names, types, due
              status and streak counts). A future native app could read it to power home-screen widgets. In the web app
              it is only used for preview.
            </p>

            <div
              className="row"
              style={{
                padding: 'var(--space-3)',
                background: 'var(--surface-muted)',
                borderRadius: 'var(--radius-md)',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>Snapshot: </span>
                <span>
                  {widgetInfo
                    ? `${widgetInfo.progress.statusText} · updated ${new Date(widgetInfo.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Not created yet'}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={handleRefreshWidgetCache} disabled={syncingWidget} aria-busy={syncingWidget}>
                <RefreshCw size={14} className={syncingWidget ? 'spin' : ''} aria-hidden="true" />
                <span>{syncingWidget ? 'Refreshing…' : 'Refresh snapshot'}</span>
              </Button>
            </div>

            <div className="row" style={{ gap: '8px', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: '3px' }} aria-hidden="true" />
              <span>
                The snapshot never contains passwords or session tokens. It is deleted whenever you are signed out on
                this device.
              </span>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="card" aria-labelledby="settings-appearance-heading">
          <h2 id="settings-appearance-heading" className="t-h2" style={{ marginBottom: 'var(--space-3)' }}>
            Appearance
          </h2>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              Theme: <strong>{theme === 'light' ? 'Light (warm cream)' : 'Dark (near black)'}</strong>
            </span>
            <Button variant="secondary" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
              <span>Switch to {theme === 'light' ? 'dark' : 'light'}</span>
            </Button>
          </div>
          <p className="t-caption" style={{ marginTop: 'var(--space-2)' }}>
            Saved on this device.
          </p>
        </section>

        {/* Session */}
        <section className="card" aria-labelledby="settings-session-heading">
          <h2 id="settings-session-heading" className="t-h2" style={{ marginBottom: 'var(--space-3)' }}>
            Account session
          </h2>
          <p className="t-caption" style={{ marginBottom: 'var(--space-4)' }}>
            Signing out ends your session (on all devices when the server can be reached) and removes this device's
            reminders and widget snapshot. Saved review notes for your account stay on this device until you delete
            them in Reviews.
          </p>
          <Button variant="danger" onClick={handleSignOut} disabled={signingOut} aria-busy={signingOut}>
            <LogOut size={16} aria-hidden="true" />
            <span>{signingOut ? 'Signing out…' : 'Sign Out'}</span>
          </Button>
        </section>
      </div>
    </div>
  )
}

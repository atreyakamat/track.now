import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast, type ToastOptions } from '@/features/notifications/ToastContext'
import {
  isSafeInAppPath,
  registerServiceWorker,
  startNotificationMonitor,
  type NotificationMonitorHandlers,
} from '@/services/webNotificationEngine'
import { snoozeReminder } from '@/services/reminderService'
import { listCompletionsForDate, listTodayExecutionItems } from '@/services/executionService'

export interface AppShellSessionDeps {
  showToast: (options: ToastOptions) => void
  clearToasts: () => void
  startMonitor?: (userId: string, handlers: NotificationMonitorHandlers) => () => void
  registerWorker?: () => Promise<unknown>
}

/**
 * Starts the signed-in session services (reminder monitor) for one user. The returned cleanup
 * stops the monitor AND clears every toast: reminder toasts carry item names and a Snooze
 * action bound to this user, so they must not survive sign-out or an account switch.
 */
export function startAppShellSession(userId: string, deps: AppShellSessionDeps): () => void {
  const { showToast, clearToasts } = deps
  const startMonitor = deps.startMonitor ?? startNotificationMonitor
  ;(deps.registerWorker ?? registerServiceWorker)().catch(() => undefined)

  const stopMonitor = startMonitor(userId, {
    onReminder: (reminder) => {
      showToast({
        id: `reminder-${reminder.id}`,
        title: `Reminder: ${reminder.itemName}`,
        message: 'Scheduled reminder from Track.now.',
        type: 'info',
        duration: 0, // stays until dismissed: this may be the only delivery channel
        action: {
          label: 'Snooze 10 min',
          onClick: () => {
            const snoozed = snoozeReminder(userId, reminder.id, 10)
            showToast({
              title: snoozed ? `Snoozed: ${reminder.itemName}` : 'Could not snooze',
              message: snoozed
                ? 'You will be reminded again in 10 minutes.'
                : 'This reminder was removed, or its item was completed or archived.',
              type: snoozed ? 'info' : 'warning',
            })
          },
        },
      })
    },
    onDigest: (alert) => {
      showToast({
        id: `digest-${alert.kind}`,
        title: alert.title,
        message: alert.body,
        type: alert.kind === 'overdue' ? 'warning' : 'info',
        duration: 0,
      })
    },
    loadDailySnapshot: async () => {
      const [items, completedTodayIds] = await Promise.all([
        listTodayExecutionItems(),
        listCompletionsForDate(userId),
      ])
      return { items, completedTodayIds }
    },
  })

  return () => {
    stopMonitor()
    clearToasts()
  }
}

/**
 * Listens for in-app navigation requests from a notification click: the service worker posts
 * `{ type: 'tracknow:navigate', url }`, and the non-SW Notification fallback dispatches a
 * `tracknow:navigate` window event. Only same-origin paths are honoured.
 */
export function subscribeToNavigationRequests(onNavigate: (url: string) => void): () => void {
  const handle = (url: unknown) => {
    if (isSafeInAppPath(url)) onNavigate(url)
  }
  const onSwMessage = (event: MessageEvent) => {
    const data = event.data as { type?: unknown; url?: unknown } | null
    if (data && data.type === 'tracknow:navigate') handle(data.url)
  }
  const onWindowEvent = (event: Event) => handle((event as CustomEvent<{ url?: unknown }>).detail?.url)

  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
  sw?.addEventListener('message', onSwMessage)
  if (typeof window !== 'undefined') window.addEventListener('tracknow:navigate', onWindowEvent)
  return () => {
    sw?.removeEventListener('message', onSwMessage)
    if (typeof window !== 'undefined') window.removeEventListener('tracknow:navigate', onWindowEvent)
  }
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { user } = useAuth()
  const { showToast, clearAll } = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  // Close the mobile drawer whenever the route changes (including browser back/forward).
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Notification clicks route inside the running app instead of reloading the page.
  useEffect(() => subscribeToNavigationRequests((url) => navigate(url)), [navigate])

  // Runs per user: the cleanup (unmount on sign-out, or a different user id) stops the
  // monitor and clears all toasts belonging to the previous session.
  useEffect(() => {
    if (!user?.id) return
    return startAppShellSession(user.id, { showToast, clearToasts: clearAll })
  }, [user?.id, showToast, clearAll])

  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Sidebar />
      <div className="main">
        <MobileNav
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((prev) => !prev)}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
        <main className="content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

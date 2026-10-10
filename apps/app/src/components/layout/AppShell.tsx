import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { registerServiceWorker, startNotificationMonitor } from '@/services/webNotificationEngine'
import { snoozeReminder } from '@/services/reminderService'

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { user } = useAuth()
  const { showToast } = useToast()

  useEffect(() => {
    if (!user) return

    registerServiceWorker().catch(() => undefined)

    const stopMonitor = startNotificationMonitor(user.id, (reminder) => {
      showToast({
        id: `reminder-${reminder.id}`,
        title: `Reminder: ${reminder.itemName}`,
        message: 'Scheduled execution reminder',
        type: 'info',
        action: {
          label: 'Snooze 10m',
          onClick: () => {
            snoozeReminder(user.id, reminder.id, 10)
            showToast({
              title: `Snoozed: ${reminder.itemName}`,
              message: 'Reminder snoozed for 10 minutes.',
              type: 'info',
            })
          },
        },
      })
    })

    return () => {
      stopMonitor()
    }
  }, [user?.id, showToast])

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <MobileNav
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((prev) => !prev)}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

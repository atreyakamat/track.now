import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { configureNotifications, startReminderSync } from '@/lib/notifications'
import { useAuth } from '@/features/auth/AuthProvider'

/** Routes a notification tap to the item's plan, when the payload carries one. */
function openFromResponse(response: Notifications.NotificationResponse | null, go: (planId: string) => void) {
  const data = response?.notification.request.content.data as { planId?: unknown } | undefined
  if (data && typeof data.planId === 'string' && data.planId) go(data.planId)
}

/**
 * Mounts inside the authenticated area. Requests notification permission, keeps the OS
 * schedule in sync with the user's reminders, and opens the right plan when a reminder is
 * tapped (whether the app was foregrounded or launched cold).
 */
export function NotificationsBridge() {
  const { user, status } = useAuth()
  const router = useRouter()
  const userId = user?.id

  useEffect(() => {
    if (status !== 'authenticated' || !userId) return
    let stopSync: (() => void) | undefined
    let active = true

    configureNotifications().then((granted) => {
      if (!active || !granted) return
      stopSync = startReminderSync(userId)
    })

    const go = (planId: string) => router.push(`/plan/${planId}`)

    // Cold start: the app may have been launched by tapping a notification.
    Notifications.getLastNotificationResponseAsync()
      .then((resp) => openFromResponse(resp, go))
      .catch(() => undefined)

    const sub = Notifications.addNotificationResponseReceivedListener((resp) => openFromResponse(resp, go))

    return () => {
      active = false
      stopSync?.()
      sub.remove()
    }
  }, [status, userId, router])

  return null
}

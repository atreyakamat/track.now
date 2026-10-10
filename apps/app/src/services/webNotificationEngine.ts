import { checkDueReminders } from './reminderService'
import { loadNotificationPreferences } from './notificationPreferences'
import type { ItemReminder } from '@/types/notifications'

let swRegistration: ServiceWorkerRegistration | null = null
let monitorIntervalId: any = null

/**
 * Initializes and registers the service worker if supported by the browser.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    swRegistration = reg
    return reg
  } catch (err) {
    console.warn('Track.now Service Worker registration failed:', err)
    return null
  }
}

/**
 * Requests browser notification permission after an explicit user interaction.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }

  try {
    const perm = await Notification.requestPermission()
    return perm
  } catch (err) {
    console.error('Error requesting notification permission:', err)
    return 'denied'
  }
}

/**
 * Dispatches an immediate browser notification if permission has been granted.
 */
export async function dispatchBrowserNotification(
  title: string,
  options?: {
    body?: string
    icon?: string
    data?: { url?: string; [key: string]: any }
    tag?: string
  },
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }

  if (Notification.permission !== 'granted') {
    return false
  }

  const notificationOptions: NotificationOptions = {
    body: options?.body || '',
    icon: options?.icon || '/favicon.svg',
    badge: '/favicon.svg',
    data: options?.data || { url: '/today' },
    tag: options?.tag,
  }

  try {
    // Attempt ServiceWorker showNotification first (optimal for mobile & PWA)
    if (swRegistration && 'showNotification' in swRegistration) {
      await swRegistration.showNotification(title, notificationOptions)
      return true
    }

    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notificationOptions)
        return true
      }
    }

    // Standard Window Notification fallback
    const n = new Notification(title, notificationOptions)
    n.onclick = (e) => {
      e.preventDefault()
      window.focus()
      const url = options?.data?.url
      if (url && window.location.pathname !== url) {
        window.location.href = url
      }
      n.close()
    }
    return true
  } catch (err) {
    console.warn('Browser notification dispatch encountered an issue:', err)
    return false
  }
}

/**
 * Starts the client-side reminder delivery loop.
 * Runs on timer and on document visibility change (catching up when user switches back to tab).
 */
export function startNotificationMonitor(
  userId: string,
  onDelivered?: (reminder: ItemReminder) => void,
): () => void {
  if (!userId || typeof window === 'undefined') {
    return () => {}
  }

  const runSweep = async () => {
    const prefs = loadNotificationPreferences(userId)
    if (!prefs.masterEnabled || !prefs.remindersEnabled) {
      return
    }

    const due = checkDueReminders(userId)
    for (const rem of due) {
      const url = rem.planId ? `/plans/${rem.planId}` : '/today'
      await dispatchBrowserNotification(`Upcoming: ${rem.itemName}`, {
        body: 'Scheduled execution reminder in Track.now.',
        data: { url, itemId: rem.itemId },
        tag: `reminder-${rem.id}`,
      })
      if (onDelivered) {
        onDelivered(rem)
      }
      window.dispatchEvent(
        new CustomEvent('tracknow:reminder-fired', { detail: { reminder: rem } }),
      )
    }
  }

  // Initial check
  runSweep()

  // Run every 20 seconds while app is active
  if (monitorIntervalId) clearInterval(monitorIntervalId)
  monitorIntervalId = setInterval(runSweep, 20000)

  // Catch-up upon tab becoming visible or window focused
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      runSweep()
    }
  }
  const handleFocus = () => runSweep()

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleFocus)

  return () => {
    if (monitorIntervalId) clearInterval(monitorIntervalId)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', handleFocus)
  }
}

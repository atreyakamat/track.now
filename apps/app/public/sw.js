/**
 * Track.now Service Worker
 * Handles PWA shell caching, notification click routing, and push listener skeleton.
 */

const CACHE_NAME = 'tracknow-shell-v1'
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key)
        }),
      ),
    ).then(() => self.clients.claim()),
  )
})

// Notification Click Handler: Focus existing tab or open new window to target deep link
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = (event.notification.data && event.notification.data.url) || '/today'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    }),
  )
})

// Web Push Listener (Prepared for future push provider connection)
self.addEventListener('push', (event) => {
  let title = 'Track.now Reminder'
  let body = 'You have an upcoming execution item.'
  let targetUrl = '/today'

  if (event.data) {
    try {
      const payload = event.data.json()
      if (payload.title) title = payload.title
      if (payload.body) body = payload.body
      if (payload.url) targetUrl = payload.url
    } catch {
      body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: targetUrl },
    }),
  )
})

/**
 * Track.now Service Worker
 *
 * Responsibilities (and honest limits):
 *  - App-shell caching: navigation requests are network-first with an offline
 *    fallback to the cached shell; content-hashed /assets/* files are cache-first.
 *    The assets referenced by index.html are precached on install (and whenever a
 *    new index.html is seen) so the app opens offline after the first visit.
 *    Asset entries not referenced by the current index.html are pruned when a new
 *    deploy is detected, so the cache does not grow forever.
 *  - Notification click routing to the relevant in-app route (same-origin paths only).
 *  - A Web Push *listener* so a future server-side push provider could display
 *    notifications. There is NO push subscription or sender in this project, so
 *    reminders are only delivered while the app is open (see webNotificationEngine).
 *
 * Privacy: only same-origin GET requests are ever cached. Supabase API/auth
 * responses are cross-origin and are never intercepted or stored.
 */

const CACHE_VERSION = 'v3'
const SHELL_CACHE = `tracknow-shell-${CACHE_VERSION}`
const ASSET_CACHE = `tracknow-assets-${CACHE_VERSION}`
const PRECACHE_ASSETS = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest', '/theme-init.js']
const DEFAULT_TARGET = '/today'

/** Same-origin `/assets/...` paths referenced by script src / link href in an HTML document. */
function extractAssetPaths(html) {
  const paths = new Set()
  const re = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi
  let match
  while ((match = re.exec(html || '')) !== null) {
    try {
      const url = new URL(match[1], self.location.origin)
      if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) paths.add(url.pathname)
    } catch {
      /* ignore malformed */
    }
  }
  return Array.from(paths)
}

/** A response is only cacheable as a build asset if it is OK and not an HTML (SPA fallback) page. */
function isCacheableAssetResponse(response) {
  if (!response || !response.ok || response.type === 'opaque') return false
  const type = (response.headers && response.headers.get('content-type')) || ''
  return !type.toLowerCase().includes('text/html')
}

/** Fetches and stores each referenced asset (best effort: one failure does not abort the rest). */
function precacheAssets(paths) {
  return caches.open(ASSET_CACHE).then((cache) =>
    Promise.all(
      paths.map((path) =>
        cache
          .match(path)
          .then((hit) => {
            if (hit) return undefined
            return fetch(path).then((response) => {
              if (isCacheableAssetResponse(response)) return cache.put(path, response)
              return undefined
            })
          })
          .catch(() => undefined),
      ),
    ),
  )
}

/**
 * Removes cached /assets/ scripts and stylesheets that the given index.html no longer
 * references. Other assets (fonts, images) are referenced from CSS, not index.html, so they
 * are kept; otherwise every deploy would evict the fonts and offline starts would lose them.
 */
function pruneAssets(paths) {
  const keep = new Set(paths)
  return caches.open(ASSET_CACHE).then((cache) =>
    cache.keys().then((requests) =>
      Promise.all(
        requests
          .filter((req) => {
            const path = new URL(req.url).pathname
            return /\.(?:js|css)$/.test(path) && !keep.has(path)
          })
          .map((req) => cache.delete(req)),
      ),
    ),
  )
}

/** Syncs the asset cache with an index.html document: precache what it needs, drop the rest. */
function syncAssetsWithIndex(html) {
  const paths = extractAssetPaths(html)
  if (paths.length === 0) return Promise.resolve() // never prune against an unexpected document
  return precacheAssets(paths).then(() => pruneAssets(paths))
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).then(() => cache.match('/index.html')))
      .then((indexResponse) => (indexResponse ? indexResponse.text() : ''))
      .then((html) => precacheAssets(extractAssetPaths(html)))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => caches.open(SHELL_CACHE))
      .then((cache) => cache.match('/index.html'))
      .then((indexResponse) => (indexResponse ? indexResponse.text().then((html) => pruneAssets(extractAssetPaths(html)).then(() => undefined)) : undefined))
      .catch(() => undefined)
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

/** Only same-origin GET requests are eligible for caching. */
function isCacheableRequest(request) {
  if (request.method !== 'GET') return false
  let url
  try {
    url = new URL(request.url)
  } catch {
    return false
  }
  return url.origin === self.location.origin
}

/**
 * Stores a fresh index.html; when it differs from the cached one (a new deploy), precaches the
 * newly referenced assets and prunes the ones no longer referenced.
 */
function updateShell(response) {
  return Promise.all([response.clone().text(), caches.open(SHELL_CACHE)]).then(([html, cache]) =>
    cache
      .match('/index.html')
      .then((previous) => (previous ? previous.text() : ''))
      .then((previousHtml) =>
        cache.put('/index.html', response).then(() => (previousHtml === html ? undefined : syncAssetsWithIndex(html))),
      ),
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (!isCacheableRequest(request)) return // cross-origin (Supabase) and non-GET: never touched

  const url = new URL(request.url)

  // 1. Navigations: network-first so deployments are picked up immediately; cached
  //    shell only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const type = (response && response.headers && response.headers.get('content-type')) || ''
          if (response && response.ok && type.includes('text/html')) {
            const copy = response.clone()
            event.waitUntil(updateShell(copy).catch(() => undefined))
          }
          return response
        })
        .catch(() =>
          caches
            .open(SHELL_CACHE)
            .then((cache) => cache.match('/index.html'))
            .then((cached) => cached || Response.error()),
        ),
    )
    return
  }

  // 2. Content-hashed build assets: immutable, so cache-first is safe. Only real assets are
  //    stored: a non-OK response or an HTML page (SPA fallback for a missing file) never is.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches
        .open(ASSET_CACHE)
        .then((cache) => cache.match(request))
        .then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              if (isCacheableAssetResponse(response)) {
                const copy = response.clone()
                event.waitUntil(
                  caches
                    .open(ASSET_CACHE)
                    .then((cache) => cache.put(request, copy))
                    .catch(() => undefined),
                )
              }
              return response
            }),
        ),
    )
    return
  }

  // 3. Precached shell files: network-first with cache fallback.
  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            event.waitUntil(
              caches
                .open(SHELL_CACHE)
                .then((cache) => cache.put(request, copy))
                .catch(() => undefined),
            )
          }
          return response
        })
        .catch(() =>
          caches
            .open(SHELL_CACHE)
            .then((cache) => cache.match(request))
            .then((cached) => cached || Response.error()),
        ),
    )
  }
  // Everything else falls through to the network untouched.
})

/**
 * Returns a safe same-origin path for a notification target, or the default route.
 * Rejects protocol-relative (`//host`), backslash tricks (`/\host`), schemes and anything
 * that resolves to another origin.
 */
function safeTargetPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return DEFAULT_TARGET
  }
  try {
    const url = new URL(raw, self.location.origin)
    if (url.origin !== self.location.origin) return DEFAULT_TARGET
    return url.pathname + url.search + url.hash
  } catch {
    return DEFAULT_TARGET
  }
}

// Notification click: focus an existing app window and ask it to route in-app; otherwise open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = safeTargetPath(event.notification.data && event.notification.data.url)

  event.waitUntil(
    Promise.all([
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }),
      self.clients.matchAll({ type: 'window' }),
    ]).then(([allClients, controlledClients]) => {
      const sameOrigin = allClients.filter((client) => {
        try {
          return new URL(client.url).origin === self.location.origin
        } catch {
          return false
        }
      })
      const client = sameOrigin.find((c) => c.focused) || sameOrigin[0]
      if (client) {
        const focused = 'focus' in client ? Promise.resolve(client.focus()).catch(() => client) : Promise.resolve(client)
        return focused.then(() => {
          try {
            client.postMessage({ type: 'tracknow:navigate', url: targetUrl })
            return undefined
          } catch {
            const controlled = controlledClients.some((c) => c.id === client.id)
            if (controlled && 'navigate' in client) return client.navigate(targetUrl).catch(() => undefined)
            return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined
          }
        })
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
      return undefined
    }),
  )
})

// Web Push listener (no subscription/sender exists in this project yet; kept so a
// future provider can deliver reminders while the app is closed).
self.addEventListener('push', (event) => {
  let title = 'Track.now Reminder'
  let body = 'You have an upcoming execution item.'
  let targetUrl = DEFAULT_TARGET

  if (event.data) {
    try {
      const payload = event.data.json()
      if (payload.title) title = String(payload.title)
      if (payload.body) body = String(payload.body)
      targetUrl = safeTargetPath(payload.url)
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

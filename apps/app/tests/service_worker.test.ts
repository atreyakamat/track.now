import { readFileSync } from 'fs'
import { resolve } from 'path'
import vm from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeToNavigationRequests } from '../src/components/layout/AppShell'

/**
 * Loads public/sw.js in a minimal simulated ServiceWorkerGlobalScope (node:vm with stubbed
 * self / caches / clients / fetch) and drives its event listeners.
 */
const ORIGIN = 'https://app.test'
const SW_SOURCE = readFileSync(resolve(__dirname, '../public/sw.js'), 'utf-8')

type Listener = (event: any) => void
type Routes = Record<string, () => Response>

function html(body: string, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}
function js(body = 'console.log(1)') {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/javascript' } })
}

function createScope(routes: Routes, clientList: any[] = []) {
  const listeners: Record<string, Listener> = {}
  const stores = new Map<string, Map<string, Response>>()
  const keyOf = (req: any) => new URL(typeof req === 'string' ? req : req.url, ORIGIN).href

  const fetchStub = vi.fn(async (input: any) => {
    const url = new URL(typeof input === 'string' ? input : input.url, ORIGIN)
    const route = url.origin === ORIGIN ? routes[url.pathname] : undefined
    if (route) return route()
    if (url.origin !== ORIGIN) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    // Behaves like a SPA host without a 404 rule: index.html with 200 for anything.
    return html('<!doctype html><title>spa</title>')
  })

  const makeCache = (store: Map<string, Response>) => ({
    match: async (req: any) => store.get(keyOf(req))?.clone(),
    put: async (req: any, res: Response) => {
      store.set(keyOf(req), res)
    },
    addAll: async (paths: string[]) => {
      for (const p of paths) store.set(keyOf(p), await fetchStub(p))
    },
    keys: async () => Array.from(store.keys()).map((url) => ({ url })),
    delete: async (req: any) => store.delete(keyOf(req)),
  })

  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map())
      return makeCache(stores.get(name)!)
    },
    keys: async () => Array.from(stores.keys()),
    delete: async (name: string) => stores.delete(name),
    match: async (req: any) => {
      for (const store of stores.values()) {
        const hit = store.get(keyOf(req))
        if (hit) return hit.clone()
      }
      return undefined
    },
  }

  const clients = {
    matchAll: vi.fn(async (opts: { includeUncontrolled?: boolean } = {}) =>
      clientList.filter((c) => opts.includeUncontrolled || c.controlled),
    ),
    openWindow: vi.fn(async (url: string) => ({ url })),
    claim: vi.fn(async () => undefined),
  }
  const registration = { showNotification: vi.fn(async () => undefined) }

  const self: any = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn
    },
    skipWaiting: vi.fn(async () => undefined),
    clients,
    registration,
  }
  const context = vm.createContext({ self, caches, fetch: fetchStub, URL, Response, Promise, Set, console })
  vm.runInContext(SW_SOURCE, context)

  const allCachedUrls = () => Array.from(stores.values()).flatMap((s) => Array.from(s.keys()))

  async function dispatchFetch(request: { url: string; method?: string; mode?: string }) {
    let responded = null as Promise<Response> | null
    const waits: Promise<unknown>[] = []
    listeners.fetch({
      request: { method: 'GET', mode: 'cors', ...request },
      respondWith: (p: Promise<Response>) => {
        responded = Promise.resolve(p)
      },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    const response: Response | null = responded ? await responded : null
    await Promise.all(waits)
    return { intercepted: responded !== null, response }
  }

  async function dispatchExtendable(type: string, extra: Record<string, unknown> = {}) {
    const waits: Promise<unknown>[] = []
    listeners[type]({ ...extra, waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
  }

  return { listeners, stores, allCachedUrls, fetchStub, clients, registration, dispatchFetch, dispatchExtendable }
}

describe('service worker: asset caching (L5/L6)', () => {
  it('never caches an HTML (SPA fallback) response for a missing /assets/ file', async () => {
    const sw = createScope({})
    const { intercepted, response } = await sw.dispatchFetch({ url: `${ORIGIN}/assets/missing-abc.js` })
    expect(intercepted).toBe(true)
    expect(response!.headers.get('content-type')).toContain('text/html')
    expect(sw.allCachedUrls().some((u) => u.includes('/assets/missing-abc.js'))).toBe(false)
  })

  it('never caches a non-OK asset response', async () => {
    const sw = createScope({ '/assets/gone.js': () => new Response('nope', { status: 404 }) })
    await sw.dispatchFetch({ url: `${ORIGIN}/assets/gone.js` })
    expect(sw.allCachedUrls().some((u) => u.includes('/assets/gone.js'))).toBe(false)
  })

  it('caches a real asset and serves it cache-first', async () => {
    const sw = createScope({ '/assets/app-1.js': () => js() })
    await sw.dispatchFetch({ url: `${ORIGIN}/assets/app-1.js` })
    expect(sw.allCachedUrls()).toContain(`${ORIGIN}/assets/app-1.js`)
    sw.fetchStub.mockClear()
    const again = await sw.dispatchFetch({ url: `${ORIGIN}/assets/app-1.js` })
    expect(again.response!.ok).toBe(true)
    expect(sw.fetchStub).not.toHaveBeenCalled()
  })

  it('does not intercept Supabase / cross-origin requests or non-GET requests', async () => {
    const sw = createScope({})
    expect((await sw.dispatchFetch({ url: 'https://abc.supabase.co/rest/v1/items' })).intercepted).toBe(false)
    expect((await sw.dispatchFetch({ url: 'https://abc.supabase.co/auth/v1/token', method: 'POST' })).intercepted).toBe(false)
    expect((await sw.dispatchFetch({ url: `${ORIGIN}/assets/app.js`, method: 'POST' })).intercepted).toBe(false)
    expect(sw.allCachedUrls().some((u) => u.includes('supabase'))).toBe(false)
  })

  it('install precaches the assets referenced by index.html (offline shell)', async () => {
    const indexHtml =
      '<script type="module" crossorigin src="/assets/index-a1.js"></script>' +
      '<link rel="modulepreload" crossorigin href="/assets/vendor-b2.js">' +
      '<link rel="stylesheet" crossorigin href="/assets/index-c3.css">' +
      '<link rel="icon" href="https://cdn.example.com/assets/evil.js">'
    const sw = createScope({
      '/': () => html(indexHtml),
      '/index.html': () => html(indexHtml),
      '/assets/index-a1.js': () => js(),
      '/assets/vendor-b2.js': () => js(),
      '/assets/index-c3.css': () => new Response('body{}', { headers: { 'content-type': 'text/css' } }),
    })
    await sw.dispatchExtendable('install')
    const cached = sw.allCachedUrls()
    expect(cached).toEqual(
      expect.arrayContaining([
        `${ORIGIN}/assets/index-a1.js`,
        `${ORIGIN}/assets/vendor-b2.js`,
        `${ORIGIN}/assets/index-c3.css`,
      ]),
    )
    expect(cached.some((u) => u.includes('cdn.example.com'))).toBe(false)

    // Offline navigation falls back to the cached shell.
    sw.fetchStub.mockImplementationOnce(async () => {
      throw new TypeError('offline')
    })
    const offline = await sw.dispatchFetch({ url: `${ORIGIN}/today`, mode: 'navigate' })
    expect(await offline.response!.text()).toBe(indexHtml)
  })

  it('a new deploy (different index.html) prunes assets it no longer references; activate drops old caches', async () => {
    let indexHtml = '<script type="module" src="/assets/index-old.js"></script>'
    const sw = createScope({
      '/': () => html(indexHtml),
      '/index.html': () => html(indexHtml),
      '/today': () => html(indexHtml),
      '/assets/index-old.js': () => js(),
      '/assets/index-new.js': () => js(),
    })
    sw.stores.set('tracknow-shell-v1', new Map([[`${ORIGIN}/assets/ancient.js`, js()]]))
    await sw.dispatchExtendable('install')
    await sw.dispatchExtendable('activate')
    expect(Array.from(sw.stores.keys()).some((k) => k === 'tracknow-shell-v1')).toBe(false)
    expect(sw.allCachedUrls()).toContain(`${ORIGIN}/assets/index-old.js`)

    indexHtml = '<script type="module" src="/assets/index-new.js"></script>'
    await sw.dispatchFetch({ url: `${ORIGIN}/today`, mode: 'navigate' })
    const cached = sw.allCachedUrls()
    expect(cached).toContain(`${ORIGIN}/assets/index-new.js`)
    expect(cached).not.toContain(`${ORIGIN}/assets/index-old.js`)
  })
})

describe('service worker: notification routing', () => {
  const click = async (sw: ReturnType<typeof createScope>, url: unknown) => {
    const close = vi.fn()
    await sw.dispatchExtendable('notificationclick', { notification: { close, data: { url } } })
    expect(close).toHaveBeenCalled()
  }

  it.each(['//evil.example/phish', '/\\evil.example', '\\\\evil.example', 'https://evil.example/', 'javascript:alert(1)', 42])(
    'rejects unsafe target %s and opens /today instead',
    async (target) => {
      const sw = createScope({})
      await click(sw, target)
      expect(sw.clients.openWindow).toHaveBeenCalledWith('/today')
    },
  )

  it('opens a same-origin path when no window exists', async () => {
    const sw = createScope({})
    await click(sw, '/plans/abc-123')
    expect(sw.clients.openWindow).toHaveBeenCalledWith('/plans/abc-123')
  })

  it('focuses an existing window and asks it to navigate in-app instead of reloading it', async () => {
    const client = {
      id: 'c1',
      url: `${ORIGIN}/today`,
      controlled: true,
      focused: false,
      focus: vi.fn(async () => client),
      navigate: vi.fn(async () => client),
      postMessage: vi.fn(),
    }
    const sw = createScope({}, [client])
    await click(sw, '/plans/abc-123')
    expect(client.focus).toHaveBeenCalled()
    expect(client.postMessage).toHaveBeenCalledWith({ type: 'tracknow:navigate', url: '/plans/abc-123' })
    expect(client.navigate).not.toHaveBeenCalled()
    expect(sw.clients.openWindow).not.toHaveBeenCalled()
  })

  it('push payload URLs get the same validation', async () => {
    const sw = createScope({})
    await sw.dispatchExtendable('push', {
      data: { json: () => ({ title: 'T', body: 'B', url: '/\\evil.example' }), text: () => '' },
    })
    expect(sw.registration.showNotification).toHaveBeenCalledWith('T', expect.objectContaining({ data: { url: '/today' } }))
  })
})

describe('app side: in-app navigation requests', () => {
  let win: EventTarget & { location: { origin: string } }
  let swContainer: EventTarget
  beforeEach(() => {
    win = Object.assign(new EventTarget(), { location: { origin: ORIGIN } })
    swContainer = new EventTarget()
    vi.stubGlobal('window', win)
    vi.stubGlobal('navigator', { serviceWorker: swContainer })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('navigates only to safe same-origin paths from SW messages and the fallback event', () => {
    const navigate = vi.fn()
    const unsubscribe = subscribeToNavigationRequests(navigate)
    const message = (data: unknown) => swContainer.dispatchEvent(Object.assign(new Event('message'), { data }))

    message({ type: 'tracknow:navigate', url: '//evil.example' })
    message({ type: 'tracknow:navigate', url: '/\\evil.example' })
    message({ type: 'other', url: '/today' })
    win.dispatchEvent(new CustomEvent('tracknow:navigate', { detail: { url: 'https://evil.example' } }))
    expect(navigate).not.toHaveBeenCalled()

    message({ type: 'tracknow:navigate', url: '/plans/p1' })
    win.dispatchEvent(new CustomEvent('tracknow:navigate', { detail: { url: '/today' } }))
    expect(navigate.mock.calls).toEqual([['/plans/p1'], ['/today']])

    unsubscribe()
    message({ type: 'tracknow:navigate', url: '/today' })
    expect(navigate).toHaveBeenCalledTimes(2)
  })
})

describe('hosting config: missing assets 404 and CSP hardening', () => {
  const files = ['../public/_redirects', '../netlify.toml', '../../../netlify/app/netlify.toml']
  it('declares an /assets/* 404 rule before the SPA catch-all', () => {
    for (const f of files) {
      const text = readFileSync(resolve(__dirname, f), 'utf-8')
      const assetRule = text.search(/\/assets\/\*[\s\S]{0,80}?404/)
      const catchAll = text.search(/["\s]\/\*["\s]/)
      expect(assetRule, f).toBeGreaterThanOrEqual(0)
      expect(assetRule, f).toBeLessThan(catchAll)
    }
  })

  it('keeps the existing CSP and adds the hardening directives', () => {
    for (const f of files.slice(1)) {
      const text = readFileSync(resolve(__dirname, f), 'utf-8')
      for (const directive of [
        "default-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "object-src 'none'",
        "worker-src 'self'",
        "manifest-src 'self'",
      ]) {
        expect(text, `${f}: ${directive}`).toContain(directive)
      }
    }
  })
})

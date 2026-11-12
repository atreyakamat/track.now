import { useEffect, useRef } from 'react'

/** Human label for a path, used for the tab title and the screen-reader announcement. */
export function routeLabel(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/'
  // Exact, common destinations first.
  const exact: Record<string, string> = {
    '/': 'Today',
    '/today': 'Today',
    '/dashboard': 'Today',
    '/tracks': 'Tracks',
    '/tracks/new': 'New track',
    '/plans': 'Plans',
    '/start': 'Start',
    '/library': 'Library',
    '/calendar': 'Calendar',
    '/reviews': 'Reviews',
    '/analytics': 'Analytics',
    '/settings': 'Settings',
    '/login': 'Sign in',
    '/signup': 'Create account',
    '/reset-password': 'Reset password',
  }
  if (exact[p]) return exact[p]
  // Prefix matches for dynamic routes, most specific first.
  if (/^\/tracks\/[^/]+\/plans\/new$/.test(p)) return 'New plan'
  if (/^\/tracks\/[^/]+\/plans\//.test(p)) return 'Plan'
  if (/^\/tracks\//.test(p)) return 'Track'
  if (/^\/plans\//.test(p)) return 'Plan'
  if (/^\/arcs\//.test(p)) return 'Arc'
  if (/^\/share\//.test(p)) return 'Shared plan'
  return 'Track.now'
}

interface RouteAnnounceOptions {
  /** The current pathname (from react-router's useLocation). */
  pathname: string
  /** The element focus should land on after a route change (the main content region). */
  focusTarget: { current: HTMLElement | null }
  /** The visually-hidden live region that announces the new page to screen readers. */
  announcer: { current: HTMLElement | null }
}

/**
 * On every route change after the first, moves keyboard focus to the main content region,
 * announces the new page name politely, and updates the document title. The first render is
 * skipped so we never steal focus on initial load or announce the landing page over itself.
 *
 * Why focus `<main>` rather than scroll: a keyboard or screen-reader user who follows a link
 * otherwise stays parked on the old, now-unmounted control. Landing on `<main tabIndex={-1}>`
 * puts the next Tab at the top of the new page, which is what a native page load would do.
 */
export function useRouteAnnounce({ pathname, focusTarget, announcer }: RouteAnnounceOptions): void {
  const firstRender = useRef(true)

  useEffect(() => {
    const label = routeLabel(pathname)
    document.title = label === 'Track.now' ? 'Track.now' : `${label} · Track.now`

    if (firstRender.current) {
      firstRender.current = false
      return
    }

    if (announcer.current) announcer.current.textContent = label
    // Focus without yanking the viewport: the browser keeps scroll when preventScroll is honoured.
    const target = focusTarget.current
    if (target) {
      try {
        target.focus({ preventScroll: true })
      } catch {
        target.focus()
      }
    }
  }, [pathname, focusTarget, announcer])
}

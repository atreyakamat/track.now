/**
 * Validates a post-login return destination.
 *
 * Only same-origin, path-style app routes are allowed. Anything that could navigate
 * off-site (protocol-relative `//host`, backslash tricks such as `/\host`, absolute
 * URLs, `javascript:`), embedded control characters, or auth pages themselves fall
 * back to the dashboard. This also neutralises the react-router `<Link>`/`navigate`
 * backslash open-redirect advisory for every value that flows through here.
 */
const AUTH_ROUTES = /^\/(login|signup|reset-password)(?:[/?#]|$)/i
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

export function safeReturnPath(raw: unknown, fallback = '/dashboard'): string {
  if (typeof raw !== 'string') return fallback
  const value = raw.trim()
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  if (value.includes('\\') || CONTROL_CHARS.test(value)) return fallback
  if (AUTH_ROUTES.test(value)) return fallback

  try {
    const base = 'https://tracknow.invalid'
    const url = new URL(value, base)
    if (url.origin !== base) return fallback
    // Re-check AFTER normalisation: dot segments can collapse into `//host`
    // (e.g. `/..//evil.com`) and `/./login` into an auth route.
    if (url.pathname.startsWith('//')) return fallback
    if (AUTH_ROUTES.test(url.pathname)) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

/** Extracts `from` from react-router location state without trusting its shape. */
export function returnPathFromState(state: unknown, fallback = '/dashboard'): string {
  if (state && typeof state === 'object' && 'from' in state) {
    return safeReturnPath((state as { from: unknown }).from, fallback)
  }
  return fallback
}

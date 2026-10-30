import { configureAuth } from '@tracknow/core/auth/authService'

export * from '@tracknow/core/auth/authService'

/**
 * Public origin used in emailed links. VITE_APP_URL wins (required for native shells,
 * whose origin is https://localhost or tracknow://localhost); otherwise the web origin.
 */
export function appOrigin(): string {
  const configured = (import.meta.env.VITE_APP_URL as string | undefined)?.trim()
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') return url.origin
    } catch {
      /* fall through to the current origin */
    }
  }
  return window.location.origin
}

// The recovery link lands on /reset-password where the user sets a new password.
configureAuth({ passwordResetRedirectTo: () => `${appOrigin()}/reset-password` })

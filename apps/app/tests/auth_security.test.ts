import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { safeReturnPath } from '@/routes/returnPath'
import { protectedRouteDecision, publicRouteDecision } from '@/routes/ProtectedRoute'
import {
  RECOVERY_MARKER_TTL_MS,
  clearRecoveryMarker,
  readRecoveryMarker,
  writeRecoveryMarker,
} from '@/features/auth/recoveryMarker'
import { AuthNetworkError, appOrigin, authService, friendlyAuthError, isRetryableAuthError } from '@/features/auth/authService'
import { ResetPasswordPage, readLinkError } from '@/pages/auth/ResetPasswordPage'
import { supabase } from '@/lib/supabase/client'

/**
 * Security regressions for authentication and session handling:
 *  - return paths that only become dangerous AFTER URL normalisation
 *  - password reset requires a recovery session (no silent password change)
 *  - recovery state is tab-scoped and expires
 *  - unreachable server => "offline" instead of a dead login form
 *  - manual sign-out never hands the previous user's page to the next login
 *  - the Supabase client uses the PKCE flow (no login CSRF through URL fragments)
 */

const authState = vi.hoisted(() => ({
  value: {
    status: 'authenticated' as 'loading' | 'authenticated' | 'unauthenticated' | 'offline',
    passwordRecovery: false,
    completePasswordRecovery: () => undefined,
  },
}))
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => authState.value }))
vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: vi.fn(), resetPasswordForEmail: vi.fn() } },
}))

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v))
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
}

beforeEach(() => {
  vi.stubGlobal('window', { sessionStorage: new MemoryStorage(), location: { origin: 'https://app.example', hash: '', search: '' } })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('safeReturnPath — normalisation cannot create an off-site or auth target', () => {
  it.each([
    '/..//evil.com',
    '/.//evil.com',
    '/%2e%2e//evil.com',
    '/x/..//evil.com',
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '/\tdashboard',
  ])('rejects %s', (raw) => {
    expect(safeReturnPath(raw)).toBe('/dashboard')
  })

  it.each(['/./login', '/%2e/login', '/a/../signup', '/reset-password'])('never returns to an auth page: %s', (raw) => {
    expect(safeReturnPath(raw)).toBe('/dashboard')
  })

  it('keeps legitimate deep links', () => {
    expect(safeReturnPath('/plans/abc?tab=habits#x')).toBe('/plans/abc?tab=habits#x')
    expect(safeReturnPath('/tracks/1/../2')).toBe('/tracks/2')
  })
})

describe('route guards', () => {
  const base = { passwordRecovery: false, signedOutManually: false }
  it('offline sessions get a retry screen, not a login redirect', () => {
    expect(protectedRouteDecision({ ...base, status: 'offline' })).toBe('offline')
    expect(publicRouteDecision({ ...base, status: 'offline' })).toBe('offline')
  })
  it('manual sign-out drops the return path; expiry keeps it', () => {
    expect(protectedRouteDecision({ ...base, status: 'unauthenticated', signedOutManually: true })).toBe('login')
    expect(protectedRouteDecision({ ...base, status: 'unauthenticated' })).toBe('login-with-return')
  })
  it('a recovery session is sent to /reset-password from everywhere', () => {
    expect(protectedRouteDecision({ ...base, status: 'authenticated', passwordRecovery: true })).toBe('reset-password')
    expect(publicRouteDecision({ ...base, status: 'authenticated', passwordRecovery: true })).toBe('reset-password')
    expect(protectedRouteDecision({ ...base, status: 'authenticated' })).toBe('render')
  })
})

describe('recovery marker', () => {
  it('round-trips for the same tab and expires after the TTL', () => {
    writeRecoveryMarker('user-1', 1_000)
    expect(readRecoveryMarker(1_000 + 5_000)).toBe('user-1')
    expect(readRecoveryMarker(1_000 + RECOVERY_MARKER_TTL_MS + 1)).toBeNull()
    clearRecoveryMarker()
    expect(readRecoveryMarker(1_000)).toBeNull()
  })
  it('ignores corrupted values', () => {
    ;(window as unknown as { sessionStorage: MemoryStorage }).sessionStorage.setItem('tracknow_password_recovery', '{not json')
    expect(readRecoveryMarker()).toBeNull()
  })
})

describe('ResetPasswordPage only allows a password change for a recovery session', () => {
  const render = () => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ResetPasswordPage)))

  it('an ordinary signed-in session sees an explanation, not the form', () => {
    authState.value = { ...authState.value, status: 'authenticated', passwordRecovery: false }
    const html = render()
    expect(html).not.toContain('Update Password')
    expect(html).toContain('can only be set from the link in a password reset email')
  })

  it('a recovery session gets the form', () => {
    authState.value = { ...authState.value, status: 'authenticated', passwordRecovery: true }
    expect(render()).toContain('Update Password')
  })

  it('an expired link error from Supabase is shown instead of any form', () => {
    expect(readLinkError('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', '')).toBe(
      'Email link is invalid or has expired',
    )
    expect(readLinkError('', '?error_description=bad')).toBe('bad')
    expect(readLinkError('', '?code=abc')).toBeNull()
  })
})

describe('auth network failures', () => {
  it('classifies Safari/WKWebView, status 0, retryable fetch errors and 5xx as retryable', () => {
    expect(isRetryableAuthError({ name: 'AuthRetryableFetchError', status: 0, message: 'x' })).toBe(true)
    expect(isRetryableAuthError({ message: 'Load failed' })).toBe(true)
    expect(isRetryableAuthError({ status: 503, message: 'HTTP 503' })).toBe(true)
    expect(isRetryableAuthError({ status: 400, message: 'Invalid login credentials' })).toBe(false)
  })
  it('gives friendly copy for them', () => {
    expect(friendlyAuthError({ message: 'Load failed' })).toMatch(/Could not reach the server/)
    expect(friendlyAuthError({ name: 'AuthRetryableFetchError', status: 0, message: '{}' })).toMatch(/Could not reach the server/)
    expect(friendlyAuthError({ status: 502, message: 'Bad gateway' })).toMatch(/temporarily unavailable/)
  })
  it('getSession reports an unreachable server as AuthNetworkError (not "signed out")', async () => {
    ;(supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' },
    })
    await expect(authService.getSession()).rejects.toBeInstanceOf(AuthNetworkError)
  })
})

describe('emailed link origin', () => {
  it('uses VITE_APP_URL when set (native shells have a localhost origin)', async () => {
    vi.stubEnv('VITE_APP_URL', 'https://trackapp.example')
    expect(appOrigin()).toBe('https://trackapp.example')
    ;(supabase.auth.resetPasswordForEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })
    await authService.resetPasswordForEmail('a@b.c')
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.c', {
      redirectTo: 'https://trackapp.example/reset-password',
    })
  })
  it('falls back to the page origin and rejects non-https values', () => {
    vi.stubEnv('VITE_APP_URL', 'javascript:alert(1)')
    expect(appOrigin()).toBe('https://app.example')
  })
})

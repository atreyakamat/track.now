import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authService, friendlyAuthError } from '@/features/auth/authService'
import { safeReturnPath, returnPathFromState } from '@/routes/returnPath'
import { supabase } from '@/lib/supabase/client'

/**
 * Mocked-only auth tests: every Supabase Auth call is stubbed with vi.spyOn. The unit
 * test environment also points the client at an unroutable loopback URL, so no request
 * can reach a live project even if a stub were missing.
 */
beforeEach(() => {
  vi.restoreAllMocks()
})

describe('safeReturnPath', () => {
  it('keeps same-origin app paths including query and hash', () => {
    expect(safeReturnPath('/plans/p1?tab=habits#x')).toBe('/plans/p1?tab=habits#x')
    expect(safeReturnPath('/today')).toBe('/today')
  })

  it('rejects protocol-relative, backslash, absolute, scheme and control-character targets', () => {
    const bad: unknown[] = [
      '//evil.example/x',
      '/\\evil.example',
      '\\\\evil',
      'https://evil.example',
      'javascript:alert(1)',
      '/to\u0000day',
      'today',
      '',
      null,
      42,
    ]
    for (const value of bad) {
      expect(safeReturnPath(value)).toBe('/dashboard')
    }
  })

  it('never returns to auth pages (avoids login loops)', () => {
    expect(safeReturnPath('/login')).toBe('/dashboard')
    expect(safeReturnPath('/signup?x=1')).toBe('/dashboard')
    expect(safeReturnPath('/reset-password')).toBe('/dashboard')
  })

  it('reads `from` defensively from router state', () => {
    expect(returnPathFromState({ from: '/analytics' })).toBe('/analytics')
    expect(returnPathFromState({ from: { pathname: '/x' } })).toBe('/dashboard')
    expect(returnPathFromState(undefined)).toBe('/dashboard')
  })
})

describe('authService.signOut', () => {
  it('reports a full sign-out when the server revokes the session', async () => {
    const spy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null })
    await expect(authService.signOut()).resolves.toEqual({ remoteRevoked: true })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('falls back to a local sign-out when the server is unreachable, so the user is never stuck signed in', async () => {
    const spy = vi
      .spyOn(supabase.auth, 'signOut')
      .mockResolvedValueOnce({ error: { message: 'Failed to fetch', status: 0 } as never })
      .mockResolvedValueOnce({ error: null })
    await expect(authService.signOut()).resolves.toEqual({ remoteRevoked: false })
    expect(spy).toHaveBeenNthCalledWith(2, { scope: 'local' })
  })

  it('also falls back when the network call throws', async () => {
    const spy = vi
      .spyOn(supabase.auth, 'signOut')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ error: null })
    await expect(authService.signOut()).resolves.toEqual({ remoteRevoked: false })
    expect(spy).toHaveBeenLastCalledWith({ scope: 'local' })
  })
})

describe('password recovery', () => {
  it('sends the recovery email with a redirect to the in-app reset page', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://trackapp.atreyakamat.dev' } })
    const spy = vi
      .spyOn(supabase.auth, 'resetPasswordForEmail')
      .mockResolvedValue({ data: {}, error: null })
    await authService.resetPasswordForEmail('person@example.com')
    expect(spy).toHaveBeenCalledTimes(1)
    const options = spy.mock.calls[0][1]
    expect(options?.redirectTo).toBe('https://trackapp.atreyakamat.dev/reset-password')
    vi.unstubAllGlobals()
  })

  it('updates the password through updateUser and maps errors', async () => {
    const spy = vi
      .spyOn(supabase.auth, 'updateUser')
      .mockResolvedValueOnce({ data: { user: null }, error: null } as never)
    await authService.updatePassword('a-new-password')
    expect(spy).toHaveBeenCalledWith({ password: 'a-new-password' })

    spy.mockResolvedValueOnce({
      data: { user: null },
      error: {
        message: 'New password should be different from the old password.',
        code: 'same_password',
        status: 422,
      },
    } as never)
    await expect(authService.updatePassword('a-new-password')).rejects.toThrow(
      'different from your current one',
    )
  })

  it('rejects too-short passwords before calling Supabase', async () => {
    const spy = vi.spyOn(supabase.auth, 'updateUser')
    await expect(authService.updatePassword('123')).rejects.toThrow('at least 6 characters')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('friendlyAuthError additions', () => {
  it('parses the current GoTrue "after N seconds" cooldown wording', () => {
    expect(
      friendlyAuthError({
        message: 'For security purposes, you can only request this after 42 seconds.',
        status: 429,
      }),
    ).toBe('Too many attempts. For security, please wait 42 seconds before trying again.')
  })

  it('maps raw network failures to an actionable message', () => {
    expect(friendlyAuthError('Failed to fetch')).toBe(
      'Could not reach the server. Check your connection and try again.',
    )
  })

  it('maps a mocked HTTP 429 without details to the generic rate-limit message (no live request involved)', () => {
    expect(friendlyAuthError({ message: 'Too Many Requests', status: 429 })).toBe(
      'Too many attempts. Rate limit reached. Please wait a few minutes before trying again.',
    )
  })
})

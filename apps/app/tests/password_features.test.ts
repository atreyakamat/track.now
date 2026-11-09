import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkPassword, MIN_PASSWORD_LENGTH, RESET_EMAIL_COOLDOWN_SECONDS } from '@tracknow/core/auth/password'
import { authService } from '@/features/auth/authService'
import { supabase } from '@/lib/supabase/client'

describe('checkPassword', () => {
  it('rejects nothing the server accepts, but labels honestly', () => {
    expect(checkPassword('abc').strength).toBe('too_short')
    expect(checkPassword('123456')).toMatchObject({ strength: 'weak', score: 1 })
    expect(checkPassword('aaaaaaaaaaaa').strength).toBe('weak')
    expect(checkPassword('password1').strength).toBe('weak')
    expect(checkPassword('sunny day').strength).toBe('fair')
    expect(checkPassword('Tr4ck.now!winter').strength).toBe('strong')
    expect(checkPassword('Tr4ck.now!winter').tip).toBeNull()
    expect(MIN_PASSWORD_LENGTH).toBe(6)
    expect(RESET_EMAIL_COOLDOWN_SECONDS).toBe(60)
  })
})

describe('changePassword (signed in)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('verifies the current password before updating', async () => {
    const signIn = vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({ data: {}, error: null } as never)
    const update = vi.spyOn(supabase.auth, 'updateUser').mockResolvedValue({ data: { user: null }, error: null } as never)
    await authService.changePassword('me@example.com', 'old-secret', 'new-secret-123')
    expect(signIn).toHaveBeenCalledWith({ email: 'me@example.com', password: 'old-secret' })
    expect(update).toHaveBeenCalledWith({ password: 'new-secret-123' })
  })

  it('refuses when the current password is wrong and never calls updateUser', async () => {
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials', status: 400 },
    } as never)
    const update = vi.spyOn(supabase.auth, 'updateUser')
    await expect(authService.changePassword('me@example.com', 'wrong', 'new-secret-123')).rejects.toThrow('current password is not correct')
    expect(update).not.toHaveBeenCalled()
  })

  it('validates locally before touching the network', async () => {
    const signIn = vi.spyOn(supabase.auth, 'signInWithPassword')
    await expect(authService.changePassword('me@example.com', '', 'new-secret-123')).rejects.toThrow('current password')
    await expect(authService.changePassword('me@example.com', 'old', '123')).rejects.toThrow('at least 6')
    await expect(authService.changePassword('me@example.com', 'same-pass', 'same-pass')).rejects.toThrow('different')
    expect(signIn).not.toHaveBeenCalled()
  })
})

describe('email code sign-in (passwordless)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('requests a code; sign-in never creates accounts, sign-up does', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithOtp').mockResolvedValue({ data: {}, error: null } as never)
    await authService.sendEmailCode('me@example.com', { createUser: false })
    expect(spy.mock.calls[0][0]).toMatchObject({ email: 'me@example.com', options: { shouldCreateUser: false } })
    await authService.sendEmailCode('new@example.com', { createUser: true, displayName: 'New Person' })
    expect(spy.mock.calls[1][0]).toMatchObject({ options: { shouldCreateUser: true, data: { display_name: 'New Person' } } })
  })

  it('verifies a 6-digit code and explains a wrong or expired one', async () => {
    const spy = vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({ data: {}, error: null } as never)
    await authService.verifyEmailCode('me@example.com', '123 456')
    expect(spy).toHaveBeenCalledWith({ email: 'me@example.com', token: '123456', type: 'email' })
    await expect(authService.verifyEmailCode('me@example.com', '12')).rejects.toThrow('6-digit code')
    spy.mockResolvedValueOnce({ data: {}, error: { message: 'Token has expired or is invalid', code: 'otp_expired', status: 403 } } as never)
    await expect(authService.verifyEmailCode('me@example.com', '000000')).rejects.toThrow('wrong or has expired')
  })

  it('an unknown email on the sign-in screen gets a clear message', async () => {
    vi.spyOn(supabase.auth, 'signInWithOtp').mockResolvedValue({ data: {}, error: { message: 'Signups not allowed for otp', code: 'otp_disabled', status: 422 } } as never)
    await expect(authService.sendEmailCode('nobody@example.com', { createUser: false })).rejects.toThrow('Create one first')
  })
})

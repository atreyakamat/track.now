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

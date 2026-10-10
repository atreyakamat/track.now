import { describe, expect, it, vi, beforeEach } from 'vitest'
import { authService, friendlyAuthError } from '@/features/auth/authService'
import { supabase } from '@/lib/supabase/client'

describe('Signup & Auth Rate Limit Error Handling', () => {
  describe('friendlyAuthError translation and rate-limit parsing', () => {
    it('handles explicit server cooldown durations accurately', () => {
      const errWith60s = {
        message: 'For security purposes, you can only request this once every 60 seconds.',
        status: 429,
      }
      expect(friendlyAuthError(errWith60s)).toBe(
        'Too many attempts. For security, please wait 60 seconds before trying again.',
      )

      const errWithWait30 = {
        message: 'Rate limit reached. Please wait 30 seconds before retrying.',
        status: 429,
      }
      expect(friendlyAuthError(errWithWait30)).toBe(
        'Too many attempts. For security, please wait 30 seconds before trying again.',
      )
    })

    it('handles HTTP 429 status without explicit cooldown reasonably without guessing cooldown', () => {
      const err429 = {
        message: 'Too Many Requests',
        status: 429,
      }
      expect(friendlyAuthError(err429)).toBe(
        'Too many attempts. Rate limit reached. Please wait a few minutes before trying again.',
      )
    })

    it('handles Supabase rate-limit error codes explicitly', () => {
      expect(
        friendlyAuthError({ code: 'over_request_rate_limit', message: 'Request limit exceeded' }),
      ).toBe('Too many attempts. Rate limit reached. Please wait a few minutes before trying again.')

      expect(
        friendlyAuthError({ code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' }),
      ).toBe('Too many attempts. Rate limit reached. Please wait a few minutes before trying again.')

      expect(
        friendlyAuthError({ code: 'rate_limit_exceeded', message: 'Rate limit exceeded' }),
      ).toBe('Too many attempts. Rate limit reached. Please wait a few minutes before trying again.')
    })

    it('handles case-insensitive message keyword detections', () => {
      expect(friendlyAuthError('Error: email rate limit exceeded')).toBe(
        'Too many attempts. Rate limit reached. Please wait a few minutes before trying again.',
      )
      expect(friendlyAuthError('Too many requests from this IP address')).toBe(
        'Too many attempts. Rate limit reached. Please wait a few minutes before trying again.',
      )
    })

    it('preserves unrelated authentication and validation errors without masking as rate limits', () => {
      expect(friendlyAuthError('Invalid login credentials')).toBe('Incorrect email or password.')
      expect(friendlyAuthError('Email not confirmed')).toBe(
        'Please confirm your email address before signing in.',
      )
      expect(friendlyAuthError('User already registered')).toBe(
        'An account with this email already exists. Try signing in instead.',
      )
      expect(friendlyAuthError('Password should be at least 6 characters.')).toBe(
        'Password should be at least 6 characters.',
      )
      expect(friendlyAuthError('Invalid email format')).toBe('Please enter a valid email address.')
      expect(friendlyAuthError('Signup disabled')).toBe('Signups are currently disabled.')
      expect(friendlyAuthError('Network error connecting to backend')).toBe(
        'Network error connecting to backend',
      )
    })
  })

  describe('authService.signUp in-flight concurrency lock & idempotency', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('allows a normal signup to succeed with mocked Supabase response', async () => {
      vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
        data: {
          session: { access_token: 'tok' } as any,
          user: { id: 'u1', identities: [{ id: 'id1' }] } as any,
        },
        error: null,
      })

      const res = await authService.signUp('test@example.com', 'password123', 'Tester')
      expect(res.signedIn).toBe(true)
    })

    it('blocks duplicate concurrent signup requests and prevents multiple in-flight calls', async () => {
      let resolveFirstCall: (value: any) => void = () => {}
      const firstCallPromise = new Promise((resolve) => {
        resolveFirstCall = resolve
      })

      const signUpSpy = vi.spyOn(supabase.auth, 'signUp').mockImplementation(
        () => firstCallPromise as any,
      )

      // Start the first signup request (in flight)
      const p1 = authService.signUp('test@example.com', 'password123', 'Tester')

      // Second immediate concurrent call while first is in flight
      await expect(
        authService.signUp('test@example.com', 'password123', 'Tester'),
      ).rejects.toThrow('A signup request is already in progress. Please wait.')

      // Exactly ONE call was made to Supabase
      expect(signUpSpy).toHaveBeenCalledTimes(1)

      // Resolve the first call
      resolveFirstCall({
        data: {
          session: { access_token: 'tok' } as any,
          user: { id: 'u1', identities: [{ id: 'id1' }] } as any,
        },
        error: null,
      })

      const res1 = await p1
      expect(res1.signedIn).toBe(true)

      // After first request completes, subsequent sequential requests are allowed
      signUpSpy.mockResolvedValueOnce({
        data: {
          session: null,
          user: { id: 'u2', identities: [{ id: 'id2' }] } as any,
        },
        error: null,
      })

      const res2 = await authService.signUp('another@example.com', 'password123', 'Tester 2')
      expect(res2.signedIn).toBe(false)
      expect(signUpSpy).toHaveBeenCalledTimes(2)
    })

    it('restores submission lock reliably when a request fails with an error', async () => {
      vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { message: 'Password should be at least 6 characters.', status: 400 } as any,
      })

      await expect(
        authService.signUp('test@example.com', '123', 'Tester'),
      ).rejects.toThrow('Password should be at least 6 characters.')

      // Lock must be released so user can retry
      vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
        data: {
          session: { access_token: 'tok' } as any,
          user: { id: 'u1', identities: [{ id: 'id1' }] } as any,
        },
        error: null,
      })

      const res = await authService.signUp('test@example.com', 'correctpassword', 'Tester')
      expect(res.signedIn).toBe(true)
    })

    it('does not automatically retry signup when a rate limit is returned', async () => {
      const signUpSpy = vi.spyOn(supabase.auth, 'signUp').mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'over_request_rate_limit', status: 429 } as any,
      })

      await expect(
        authService.signUp('test@example.com', 'password123', 'Tester'),
      ).rejects.toThrow('Too many attempts. Rate limit reached. Please wait a few minutes before trying again.')

      // Verifies no automatic retry loops or synthetic re-requests occurred
      expect(signUpSpy).toHaveBeenCalledTimes(1)
    })
  })
})

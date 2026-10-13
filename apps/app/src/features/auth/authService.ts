import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export interface SignUpResult {
  /** True when a session exists immediately; false when email confirmation is required. */
  signedIn: boolean
}

export interface AuthErrorLike {
  message?: string
  status?: number
  code?: string
}

/** True for failures where the server was not reached (offline, DNS, CORS, 5xx). */
export function isRetryableAuthError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: unknown; status?: unknown; message?: unknown }
  if (e.name === 'AuthRetryableFetchError') return true
  if (typeof e.status === 'number' && (e.status === 0 || e.status >= 500)) return true
  const m = typeof e.message === 'string' ? e.message.toLowerCase() : ''
  return m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network request failed') || m.includes('load failed')
}

/** Thrown when the session could not be checked because the server was unreachable. */
export class AuthNetworkError extends Error {
  readonly retryable = true
}

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

export function friendlyAuthError(err: string | AuthErrorLike | unknown): string {
  const message = typeof err === 'string'
    ? err
    : (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string')
      ? (err as { message: string }).message
      : 'Authentication request failed'

  const status = (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number')
    ? (err as { status: number }).status
    : undefined

  const code = (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string')
    ? (err as { code: string }).code.toLowerCase()
    : ''

  const m = message.toLowerCase()

  // 1. Rate limit detection (HTTP 429, known Supabase error codes, or message keywords)
  const isRateLimit =
    status === 429 ||
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    code === 'rate_limit_exceeded' ||
    m.includes('rate limit') ||
    m.includes('too many requests') ||
    m.includes('rate_limit') ||
    m.includes('only request this once every')

  if (isRateLimit) {
    // Check if the server explicitly provided a cooldown duration
    const secondsMatch =
      m.match(/once every (\d+)\s*(?:seconds|secs|s)/i) ||
      m.match(/wait (\d+)\s*(?:seconds|secs|s)/i) ||
      m.match(/after (\d+)\s*(?:seconds|secs|s)/i)
    if (secondsMatch && secondsMatch[1]) {
      return `Too many attempts. For security, please wait ${secondsMatch[1]} seconds before trying again.`
    }
    // If no exact cooldown duration was provided by the server, provide a helpful general instruction
    return 'Too many attempts. Rate limit reached. Please wait a few minutes before trying again.'
  }

  // 2. Specific auth error mappings (do not hide unrelated errors)
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.'
  if (m.includes('email not confirmed')) return 'Please confirm your email address before signing in.'
  if (m.includes('already registered') || m.includes('already been registered') || code === 'user_already_exists')
    return 'An account with this email already exists. Try signing in instead.'
  if (m.includes('password should be at least')) return message
  if (m.includes('invalid email') || code === 'email_address_invalid') return 'Please enter a valid email address.'
  if (m.includes('signup disabled') || code === 'signup_disabled') return 'Signups are currently disabled.'
  if (code === 'same_password' || m.includes('should be different from the old password'))
    return 'Choose a new password that is different from your current one.'
  if (code === 'weak_password') return message
  if (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m.includes('load failed') ||
    status === 0 ||
    (err && typeof err === 'object' && (err as { name?: unknown }).name === 'AuthRetryableFetchError')
  )
    return 'Could not reach the server. Check your connection and try again.'
  if (status !== undefined && status >= 500)
    return 'The sign-in service is temporarily unavailable. Please try again in a moment.'

  return message
}

export interface SignOutResult {
  /** False when the server could not be reached; the session was still cleared on this device. */
  remoteRevoked: boolean
}

let activeSignUpPromise: Promise<SignUpResult> | null = null

export const authService = {
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      if (isRetryableAuthError(error)) throw new AuthNetworkError(friendlyAuthError(error))
      throw new Error(friendlyAuthError(error))
    }
    return data.session
  },

  async signUp(email: string, password: string, displayName: string): Promise<SignUpResult> {
    // Concurrency guard: Ensure one intentional form submission produces at most one in-flight signup request
    if (activeSignUpPromise) {
      throw new Error('A signup request is already in progress. Please wait.')
    }

    activeSignUpPromise = (async () => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName, full_name: displayName } },
      })
      if (error) throw new Error(friendlyAuthError(error))
      // Supabase returns an obfuscated user with no identities for already-registered emails.
      if (data.user && data.user.identities?.length === 0) {
        throw new Error(friendlyAuthError('User already registered'))
      }
      return { signedIn: Boolean(data.session) }
    })()

    try {
      return await activeSignUpPromise
    } finally {
      activeSignUpPromise = null
    }
  },

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(friendlyAuthError(error))
  },

  /**
   * Signs out of this device and attempts to revoke the refresh token server-side.
   * If the server cannot be reached, the local session is still cleared (scope 'local')
   * so the user is never left signed in after pressing "Sign out".
   */
  async signOut(): Promise<SignOutResult> {
    let remoteError: unknown = null
    try {
      const { error } = await supabase.auth.signOut()
      if (!error) return { remoteRevoked: true }
      remoteError = error
    } catch (err) {
      remoteError = err
    }
    const { error: localError } = await supabase.auth.signOut({ scope: 'local' })
    if (localError) throw new Error(friendlyAuthError(localError ?? remoteError))
    return { remoteRevoked: false }
  },

  async resetPasswordForEmail(email: string): Promise<void> {
    // The recovery link lands on /reset-password where the user sets a new password.
    // NOTE (owner action): this URL must be in Supabase Auth > URL Configuration > Redirect URLs.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appOrigin()}/reset-password`,
    })
    if (error) throw new Error(friendlyAuthError(error))
  },

  /** Sets a new password for the currently authenticated (or recovery) session. */
  async updatePassword(newPassword: string): Promise<void> {
    if (newPassword.length < 6) throw new Error('Password should be at least 6 characters.')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(friendlyAuthError(error))
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session))
    return () => data.subscription.unsubscribe()
  },
}

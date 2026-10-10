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
    const secondsMatch = m.match(/once every (\d+)\s*(?:seconds|secs|s)/i) || m.match(/wait (\d+)\s*(?:seconds|secs|s)/i)
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

  return message
}

let activeSignUpPromise: Promise<SignUpResult> | null = null

export const authService = {
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw new Error(friendlyAuthError(error))
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

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(friendlyAuthError(error))
  },

  async resetPasswordForEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) throw new Error(friendlyAuthError(error))
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session))
    return () => data.subscription.unsubscribe()
  },
}

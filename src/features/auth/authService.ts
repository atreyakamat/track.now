import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export interface SignUpResult {
  /** True when a session exists immediately; false when email confirmation is required. */
  signedIn: boolean
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.'
  if (m.includes('email not confirmed')) return 'Please confirm your email address before signing in.'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'An account with this email already exists. Try signing in instead.'
  if (m.includes('password should be at least')) return message
  if (m.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.'
  return message
}

export const authService = {
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw new Error(friendlyAuthError(error.message))
    return data.session
  },

  async signUp(email: string, password: string, displayName: string): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, full_name: displayName } },
    })
    if (error) throw new Error(friendlyAuthError(error.message))
    // Supabase returns an obfuscated user with no identities for already-registered emails.
    if (data.user && data.user.identities?.length === 0) {
      throw new Error(friendlyAuthError('User already registered'))
    }
    return { signedIn: Boolean(data.session) }
  },

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(friendlyAuthError(error.message))
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(friendlyAuthError(error.message))
  },

  async resetPasswordForEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) throw new Error(friendlyAuthError(error.message))
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session))
    return () => data.subscription.unsubscribe()
  },
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { ensureProfile, getProfile } from '@/services/tracksService'
import type { Profile } from '@/types/domain'
import { authService, type SignUpResult } from './authService'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  profile: Profile | null
  /** Human-friendly name for UI. */
  displayName: string
  /** One-shot message (e.g. session expired) shown on the login page. */
  notice: string | null
  clearNotice: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const wasAuthenticated = useRef(false)
  const manualSignOut = useRef(false)

  const applySession = useCallback((next: Session | null) => {
    setSession(next)
    setStatus(next ? 'authenticated' : 'unauthenticated')
    if (!next) setProfile(null)
  }, [])

  useEffect(() => {
    let active = true
    authService
      .getSession()
      .then((s) => {
        if (!active) return
        wasAuthenticated.current = Boolean(s)
        applySession(s)
      })
      .catch(() => active && applySession(null))

    const unsubscribe = authService.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT' && wasAuthenticated.current && !manualSignOut.current) {
        setNotice('Your session expired. Please sign in again.')
      }
      if (event === 'SIGNED_OUT') manualSignOut.current = false
      wasAuthenticated.current = Boolean(next)
      applySession(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [applySession])

  const userId = session?.user.id
  const metaName = (session?.user.user_metadata?.display_name as string | undefined) ?? null

  // Ensure a profile row exists (a DB trigger normally creates it; this is a safety net).
  useEffect(() => {
    if (!userId) return
    let active = true
    ensureProfile(userId, metaName)
      .then((p) => active && setProfile(p))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [userId, metaName])

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    try {
      const p = await getProfile(userId)
      if (p) setProfile(p)
    } catch {
      // ignore
    }
  }, [userId])

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null
    return {
      status,
      user,
      profile,
      displayName: profile?.display_name || metaName || user?.email?.split('@')[0] || 'You',
      notice,
      clearNotice: () => setNotice(null),
      signIn: (email, password) => authService.signIn(email, password),
      signUp: (email, password, name) => authService.signUp(email, password, name),
      signOut: async () => {
        manualSignOut.current = true
        await authService.signOut()
      },
      refreshProfile,
    }
  }, [status, session, profile, metaName, notice, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { ensureProfile, getProfile } from '@tracknow/core/services/tracksService'
import type { Profile } from '@tracknow/core/types/domain'
import { clearRemindersForUser } from '@tracknow/core/services/reminderService'
import { setTelemetryUser, track } from '@tracknow/core/services/telemetry'
import { releaseSyncedCopies } from '@tracknow/core/services/syncedState'
import {
  AuthNetworkError,
  authService,
  type SignUpResult,
} from '@tracknow/core/auth/authService'

/**
 * 'offline': a stored session exists but could not be verified because the server was
 * unreachable. The UI shows a retry screen instead of a login form that cannot work.
 */
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'offline'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  profile: Profile | null
  displayName: string
  notice: string | null
  clearNotice: () => void
  signedOutManually: boolean
  retrySession: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Removes device-local data belonging to a user who is no longer signed in here. */
function wipeLocalUserData(userId: string | null): void {
  if (userId) clearRemindersForUser(userId)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [signedOutManually, setSignedOutManually] = useState(false)
  const [sessionCheck, setSessionCheck] = useState(0)
  const wasAuthenticated = useRef(false)
  const manualSignOut = useRef(false)
  const signOutInFlight = useRef<Promise<void> | null>(null)
  const lastUserId = useRef<string | null>(null)

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
        if (s?.user?.id) lastUserId.current = s.user.id
        applySession(s)
      })
      .catch((err) => {
        if (!active) return
        // Unreachable server: keep the stored session (auth-js retries the refresh and
        // emits TOKEN_REFRESHED once online) instead of bouncing to an unusable login form.
        if (err instanceof AuthNetworkError) setStatus('offline')
        else applySession(null)
      })

    const unsubscribe = authService.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'SIGNED_IN') {
        setNotice(null)
        setSignedOutManually(false)
      }
      if (event === 'SIGNED_OUT') {
        if (wasAuthenticated.current && !manualSignOut.current) {
          setNotice('You were signed out. Please sign in again.')
        }
        manualSignOut.current = false
        wipeLocalUserData(lastUserId.current)
      }
      if (next?.user?.id) {
        if (lastUserId.current && lastUserId.current !== next.user.id) {
          wipeLocalUserData(lastUserId.current)
        }
        lastUserId.current = next.user.id
      }
      wasAuthenticated.current = Boolean(next)
      applySession(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [applySession, sessionCheck])

  const userId = session?.user.id
  const metaName = (session?.user.user_metadata?.display_name as string | undefined) ?? null

  // Usage events and error reports are only sent for a signed-in user.
  useEffect(() => {
    setTelemetryUser(userId ?? null)
  }, [userId])

  // Ensure a profile row exists (a DB trigger normally creates it; this is a safety net).
  useEffect(() => {
    setProfile(null)
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
      /* the settings screen reports its own save errors */
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
      signedOutManually,
      retrySession: () => {
        setStatus('loading')
        setSessionCheck((n) => n + 1)
      },
      signIn: async (email, password) => {
        await authService.signIn(email, password)
        track('sign_in_completed', { method: 'password' })
        setNotice(null)
        setSignedOutManually(false)
      },
      signUp: async (email, password, name) => {
        const result = await authService.signUp(email, password, name)
        track('sign_up_completed', { method: 'password' })
        return result
      },
      signOut: async () => {
        if (signOutInFlight.current) return signOutInFlight.current
        const run = async () => {
          const userIdAtSignOut = session?.user?.id ?? lastUserId.current
          manualSignOut.current = true
          setSignedOutManually(true)
          // While the session still exists: make sure review notes are on the account, then
          // remove this device's copy (kept when the account does not have them).
          if (userIdAtSignOut) await releaseSyncedCopies(userIdAtSignOut)
          try {
            const result = await authService.signOut()
            if (!result.remoteRevoked) {
              setNotice(
                'Signed out on this device. The server could not be reached, so other active sessions may stay signed in until they expire.',
              )
            }
          } catch (err) {
            manualSignOut.current = false
            setSignedOutManually(false)
            throw err
          }
          if (userIdAtSignOut) clearRemindersForUser(userIdAtSignOut)
        }
        signOutInFlight.current = run().finally(() => {
          signOutInFlight.current = null
        })
        return signOutInFlight.current
      },
      refreshProfile,
    }
  }, [status, session, profile, metaName, notice, signedOutManually, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { ensureProfile, getProfile } from '@/services/tracksService'
import type { Profile } from '@/types/domain'
import { clearRemindersForUser } from '@/services/reminderService'
import { clearWidgetData } from '@/services/widgetDataService'
import { AuthNetworkError, authService, type SignUpResult } from './authService'
import { clearRecoveryMarker, readRecoveryMarker, writeRecoveryMarker } from './recoveryMarker'

/**
 * 'offline': a stored session exists but could not be verified because the server was
 * unreachable. Routes show a retry screen instead of a login form that cannot work.
 */
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'offline'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  profile: Profile | null
  /** Human-friendly name for UI. */
  displayName: string
  /** One-shot message (e.g. session expired) shown on the login page. */
  notice: string | null
  clearNotice: () => void
  /**
   * True only while the current session came from a password-recovery email link
   * (PASSWORD_RECOVERY event). The reset page refuses to change the password otherwise.
   */
  passwordRecovery: boolean
  completePasswordRecovery: () => void
  /** True right after the user pressed "Sign out" (login must not return to their last page). */
  signedOutManually: boolean
  /** Re-checks the stored session (used by the offline screen). */
  retrySession: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Closes system notifications already on screen (they contain item names). */
function closeShownNotifications(): void {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready
      .then((reg) => reg.getNotifications())
      .then((list) => list.forEach((n) => n.close()))
      .catch(() => undefined)
  } catch {
    /* unsupported environment */
  }
}

/** Removes device-local data that belongs to a user who is no longer signed in here. */
function wipeLocalUserData(userId: string | null): void {
  if (userId) clearRemindersForUser(userId)
  clearWidgetData().catch(() => undefined)
  closeShownNotifications()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(() => readRecoveryMarker())
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
        setRecoveryUserId(readRecoveryMarker())
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
      // Start-up state comes from getSession() above. INITIAL_SESSION arrives at about the same
      // time and, when an expired token cannot be refreshed offline, carries a null session:
      // handling it here would race the 'offline' state and bounce the user to an unusable login.
      if (event === 'INITIAL_SESSION') return
      if (event === 'PASSWORD_RECOVERY' && next?.user?.id) {
        writeRecoveryMarker(next.user.id)
        setRecoveryUserId(next.user.id)
      }
      if (event === 'SIGNED_IN') {
        setNotice(null)
        setSignedOutManually(false)
      }
      if (event === 'SIGNED_OUT') {
        if (wasAuthenticated.current && !manualSignOut.current) {
          setNotice('You were signed out. Please sign in again.')
        }
        manualSignOut.current = false
        clearRecoveryMarker()
        setRecoveryUserId(null)
        // Any sign-out (manual, expiry, revocation, another tab) removes the previous user's
        // device-local reminders, widget snapshot and visible notifications, so a shared
        // device never shows them to the next person.
        wipeLocalUserData(lastUserId.current)
      }
      if (next?.user?.id) {
        // A different account signed in without a sign-out in between (e.g. a link for
        // another user): drop the previous user's local data and recovery state.
        if (lastUserId.current && lastUserId.current !== next.user.id) {
          wipeLocalUserData(lastUserId.current)
          if (readRecoveryMarker() !== next.user.id) clearRecoveryMarker()
        }
        lastUserId.current = next.user.id
      }
      // The module-level listener may have recorded a recovery before this subscription existed.
      if (event !== 'SIGNED_OUT') setRecoveryUserId(readRecoveryMarker())
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

  // Ensure a profile row exists (a DB trigger normally creates it; this is a safety net).
  // The previous user's profile is dropped first so their name never shows for another account.
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
      // The settings page reports its own save errors; a stale name here is harmless.
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
      passwordRecovery: Boolean(user && recoveryUserId === user.id),
      completePasswordRecovery: () => {
        clearRecoveryMarker()
        setRecoveryUserId(null)
      },
      signedOutManually,
      retrySession: () => {
        setStatus('loading')
        setSessionCheck((n) => n + 1)
      },
      signIn: async (email, password) => {
        await authService.signIn(email, password)
        setNotice(null)
        setSignedOutManually(false)
      },
      signUp: (email, password, name) => authService.signUp(email, password, name),
      signOut: async () => {
        // A double click must not start a second sign-out (it would leave the manual flag set).
        if (signOutInFlight.current) return signOutInFlight.current
        const run = async () => {
          const userIdAtSignOut = session?.user?.id ?? lastUserId.current
          manualSignOut.current = true
          setSignedOutManually(true)
          try {
            // Sign out first: local data is only wiped once the session is really gone.
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
          await clearWidgetData()
          closeShownNotifications()
        }
        signOutInFlight.current = run().finally(() => {
          signOutInFlight.current = null
        })
        return signOutInFlight.current
      },
      refreshProfile,
    }
  }, [status, session, profile, metaName, notice, recoveryUserId, signedOutManually, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

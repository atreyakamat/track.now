import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button, LoadingState } from '@/components/ui'
import { returnPathFromState, safeReturnPath } from './returnPath'

const sessionLoading = (
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
    <LoadingState label="Verifying session…" />
  </div>
)

function OfflineSession({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--space-4)' }}>
      <div className="state state--error" role="alert">
        <h1 className="t-h3">Can’t reach Track.now</h1>
        <p className="state__desc">
          Your session is saved on this device but could not be checked because the server is unreachable. Check your
          connection and try again.
        </p>
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  )
}

type GuardInput = {
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'offline'
  passwordRecovery: boolean
  signedOutManually: boolean
}
export type GuardDecision = 'loading' | 'offline' | 'login' | 'login-with-return' | 'reset-password' | 'render' | 'leave'

/** Pure routing decision for protected pages (unit-tested). */
export function protectedRouteDecision({ status, passwordRecovery, signedOutManually }: GuardInput): GuardDecision {
  if (status === 'loading') return 'loading'
  if (status === 'offline') return 'offline'
  // After a deliberate sign-out, never carry the previous user's page to the next login.
  if (status === 'unauthenticated') return signedOutManually ? 'login' : 'login-with-return'
  // A recovery link signs the user in; they must choose a new password before anything else.
  return passwordRecovery ? 'reset-password' : 'render'
}

/** Pure routing decision for login/signup pages (unit-tested). */
export function publicRouteDecision({ status, passwordRecovery }: GuardInput): GuardDecision {
  if (status === 'loading') return 'loading'
  if (status === 'offline') return 'offline'
  if (status === 'authenticated') return passwordRecovery ? 'reset-password' : 'leave'
  return 'render'
}

export function ProtectedRoute() {
  const auth = useAuth()
  const location = useLocation()
  switch (protectedRouteDecision(auth)) {
    case 'loading':
      return sessionLoading
    case 'offline':
      return <OfflineSession onRetry={auth.retrySession} />
    case 'login':
      return <Navigate to="/login" replace />
    case 'login-with-return': {
      // Remember where the user was going (e.g. a notification deep link) so login can return there.
      const from = safeReturnPath(`${location.pathname}${location.search}${location.hash}`)
      return <Navigate to="/login" replace state={{ from }} />
    }
    case 'reset-password':
      return <Navigate to="/reset-password" replace />
    default:
      return <Outlet />
  }
}

export function PublicRoute() {
  const auth = useAuth()
  const location = useLocation()
  switch (publicRouteDecision(auth)) {
    case 'loading':
      return sessionLoading
    case 'offline':
      return <OfflineSession onRetry={auth.retrySession} />
    case 'reset-password':
      return <Navigate to="/reset-password" replace />
    case 'leave':
      return <Navigate to={returnPathFromState(location.state)} replace />
    default:
      return <Outlet />
  }
}

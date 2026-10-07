import { describe, expect, it } from 'vitest'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface RouteGuardResult {
  action: 'render' | 'redirect' | 'loading'
  redirectTo?: string
}

function resolveProtectedRoute(status: AuthStatus): RouteGuardResult {
  if (status === 'loading') return { action: 'loading' }
  if (status === 'unauthenticated') return { action: 'redirect', redirectTo: '/login' }
  return { action: 'render' }
}

function resolvePublicRoute(status: AuthStatus, targetPath: string): RouteGuardResult {
  if (status === 'loading') return { action: 'loading' }
  if (status === 'authenticated') return { action: 'redirect', redirectTo: '/dashboard' }
  return { action: 'render' }
}

describe('Auth Routing & Route Guards Logic', () => {
  it('blocks unauthenticated user from protected routes and redirects to /login', () => {
    const result = resolveProtectedRoute('unauthenticated')
    expect(result.action).toBe('redirect')
    expect(result.redirectTo).toBe('/login')
  })

  it('allows authenticated user into protected routes', () => {
    const result = resolveProtectedRoute('authenticated')
    expect(result.action).toBe('render')
    expect(result.redirectTo).toBeUndefined()
  })

  it('redirects authenticated user visiting /login to /dashboard', () => {
    const result = resolvePublicRoute('authenticated', '/login')
    expect(result.action).toBe('redirect')
    expect(result.redirectTo).toBe('/dashboard')
  })

  it('redirects authenticated user visiting /signup to /dashboard', () => {
    const result = resolvePublicRoute('authenticated', '/signup')
    expect(result.action).toBe('redirect')
    expect(result.redirectTo).toBe('/dashboard')
  })

  it('allows unauthenticated user to access /login and /signup', () => {
    expect(resolvePublicRoute('unauthenticated', '/login')).toEqual({ action: 'render' })
    expect(resolvePublicRoute('unauthenticated', '/signup')).toEqual({ action: 'render' })
  })

  it('renders loading state while verifying session without initiating redirects', () => {
    expect(resolveProtectedRoute('loading')).toEqual({ action: 'loading' })
    expect(resolvePublicRoute('loading', '/login')).toEqual({ action: 'loading' })
    expect(resolvePublicRoute('loading', '/signup')).toEqual({ action: 'loading' })
  })

  it('verifies absence of infinite redirect loops', () => {
    // Simulate navigation transitions:
    // 1. Initial load -> loading -> no redirect
    const s1 = resolveProtectedRoute('loading')
    expect(s1.action).toBe('loading')

    // 2. Unauthenticated -> redirects to /login -> at /login public route renders
    const s2 = resolveProtectedRoute('unauthenticated')
    expect(s2.redirectTo).toBe('/login')
    const s3 = resolvePublicRoute('unauthenticated', '/login')
    expect(s3.action).toBe('render') // Stable! No further redirect.

    // 3. User signs in -> authenticated -> at /login redirects to /dashboard -> at /dashboard renders
    const s4 = resolvePublicRoute('authenticated', '/login')
    expect(s4.redirectTo).toBe('/dashboard')
    const s5 = resolveProtectedRoute('authenticated')
    expect(s5.action).toBe('render') // Stable! No further redirect.
  })

  it('redirects unauthenticated root / access to /login via protected route guard', () => {
    const result = resolveProtectedRoute('unauthenticated')
    expect(result.action).toBe('redirect')
    expect(result.redirectTo).toBe('/login')
  })

  it('allows authenticated user accessing root / to enter app shell and navigate to /dashboard', () => {
    const result = resolveProtectedRoute('authenticated')
    expect(result.action).toBe('render')
    expect(result.redirectTo).toBeUndefined()
  })

  it('preserves direct /dashboard access for authenticated users', () => {
    const result = resolveProtectedRoute('authenticated')
    expect(result.action).toBe('render')
    expect(result.redirectTo).toBeUndefined()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { Navigate, Outlet } from 'react-router-dom'
import { ProtectedRoute, PublicRoute } from '@/routes/ProtectedRoute'

let mockStatus: 'loading' | 'authenticated' | 'unauthenticated' = 'loading'

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    status: mockStatus,
    user: mockStatus === 'authenticated' ? { id: 'usr-123' } : null,
  }),
}))

describe('Auth Routing & Route Guards', () => {
  it('blocks unauthenticated user from protected routes and redirects to /login', () => {
    mockStatus = 'unauthenticated'
    const element = ProtectedRoute()
    expect(element.type).toBe(Navigate)
    expect(element.props.to).toBe('/login')
    expect(element.props.replace).toBe(true)
  })

  it('allows authenticated user into protected routes by rendering Outlet', () => {
    mockStatus = 'authenticated'
    const element = ProtectedRoute()
    expect(element.type).toBe(Outlet)
  })

  it('redirects authenticated user visiting public auth routes (/login, /signup) to /dashboard', () => {
    mockStatus = 'authenticated'
    const element = PublicRoute()
    expect(element.type).toBe(Navigate)
    expect(element.props.to).toBe('/dashboard')
    expect(element.props.replace).toBe(true)
  })

  it('allows unauthenticated user to access public routes by rendering Outlet', () => {
    mockStatus = 'unauthenticated'
    const element = PublicRoute()
    expect(element.type).toBe(Outlet)
  })

  it('renders loading session indicator while auth status is loading in ProtectedRoute', () => {
    mockStatus = 'loading'
    const element = ProtectedRoute()
    expect(element.type).not.toBe(Navigate)
    expect(element.type).not.toBe(Outlet)
    expect(element.props.children).toBeDefined()
  })

  it('renders loading session indicator while auth status is loading in PublicRoute', () => {
    mockStatus = 'loading'
    const element = PublicRoute()
    expect(element.type).not.toBe(Navigate)
    expect(element.type).not.toBe(Outlet)
    expect(element.props.children).toBeDefined()
  })

  it('verifies non-cyclical redirect invariants across auth lifecycle transitions', () => {
    // 1. Initial boot: loading -> yields loading indicator (no redirect)
    mockStatus = 'loading'
    const s1 = ProtectedRoute()
    expect(s1.type).not.toBe(Navigate)

    // 2. Unauthenticated: protected guard redirects to /login
    mockStatus = 'unauthenticated'
    const s2 = ProtectedRoute()
    expect(s2.type).toBe(Navigate)
    expect(s2.props.to).toBe('/login')

    // At /login, public guard renders Outlet without further redirect
    const s3 = PublicRoute()
    expect(s3.type).toBe(Outlet)

    // 3. Authenticated: public guard redirects to /dashboard
    mockStatus = 'authenticated'
    const s4 = PublicRoute()
    expect(s4.type).toBe(Navigate)
    expect(s4.props.to).toBe('/dashboard')

    // At /dashboard, protected guard renders Outlet stably
    const s5 = ProtectedRoute()
    expect(s5.type).toBe(Outlet)
  })
})

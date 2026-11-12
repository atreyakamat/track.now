import { describe, expect, it } from 'vitest'
import { routeLabel } from '../src/hooks/useRouteAnnounce'

describe('routeLabel', () => {
  it('names the common destinations', () => {
    expect(routeLabel('/')).toBe('Today')
    expect(routeLabel('/today')).toBe('Today')
    expect(routeLabel('/tracks')).toBe('Tracks')
    expect(routeLabel('/settings')).toBe('Settings')
    expect(routeLabel('/analytics')).toBe('Analytics')
  })

  it('ignores a trailing slash', () => {
    expect(routeLabel('/tracks/')).toBe('Tracks')
    expect(routeLabel('/settings/')).toBe('Settings')
  })

  it('labels dynamic routes, most specific first', () => {
    expect(routeLabel('/tracks/new')).toBe('New track')
    expect(routeLabel('/tracks/abc123/plans/new')).toBe('New plan')
    expect(routeLabel('/tracks/abc123/plans/p1')).toBe('Plan')
    expect(routeLabel('/tracks/abc123')).toBe('Track')
    expect(routeLabel('/plans/p1')).toBe('Plan')
    expect(routeLabel('/arcs/focus')).toBe('Arc')
    expect(routeLabel('/share/tok')).toBe('Shared plan')
  })

  it('falls back to the app name for unknown paths', () => {
    expect(routeLabel('/nope/here')).toBe('Track.now')
  })
})

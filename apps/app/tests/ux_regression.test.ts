import { describe, expect, it } from 'vitest'
import { pluralize } from '@/utils/format'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Frontend UX and Responsive Regression Suite', () => {
  it('pluralizes completed items and active plans correctly', () => {
    expect(pluralize(0, 'completed item')).toBe('0 completed items')
    expect(pluralize(1, 'completed item')).toBe('1 completed item')
    expect(pluralize(2, 'completed item')).toBe('2 completed items')

    expect(pluralize(0, 'active plan')).toBe('0 active plans')
    expect(pluralize(1, 'active plan')).toBe('1 active plan')
    expect(pluralize(3, 'active plan')).toBe('3 active plans')
  })

  it('guarantees CalendarHeatmap does not use undefined tokens or hardcoded dark fallbacks', () => {
    const file = readFileSync(
      resolve(__dirname, '../src/components/analytics/CalendarHeatmap.tsx'),
      'utf-8',
    )
    expect(file).not.toContain('--surface-card')
    expect(file).not.toContain('--border-subtle')
    expect(file).toContain('var(--surface)')
    expect(file).toContain('var(--border)')
    expect(file).toContain('var(--surface-muted)')
  })

  it('guarantees modals and forms use canonical surface tokens instead of --bg-secondary', () => {
    const createModal = readFileSync(
      resolve(__dirname, '../src/components/execution/CreateItemModal.tsx'),
      'utf-8',
    )
    const editModal = readFileSync(
      resolve(__dirname, '../src/components/execution/EditItemModal.tsx'),
      'utf-8',
    )
    const newTrack = readFileSync(
      resolve(__dirname, '../src/pages/tracks/NewTrackPage.tsx'),
      'utf-8',
    )

    expect(createModal).not.toContain('--bg-secondary')
    expect(editModal).not.toContain('--bg-secondary')
    expect(newTrack).not.toContain('--bg-secondary')

    expect(createModal).toContain('var(--surface-muted)')
    expect(editModal).toContain('var(--surface-muted)')
    expect(newTrack).toContain('var(--surface-muted)')
  })

  it('guarantees DashboardPage does not apply --accent-primary-text on dark stat values', () => {
    const dashboard = readFileSync(
      resolve(__dirname, '../src/pages/DashboardPage.tsx'),
      'utf-8',
    )
    expect(dashboard).not.toContain("color: 'var(--accent-primary-text)'")
    expect(dashboard).not.toContain('<ButtonLink to="/tracks/new" variant="primary" icon>')
  })

  it('guarantees landing page styles contain mobile drawer protection for nav actions', () => {
    const landingCss = readFileSync(
      resolve(__dirname, '../../landing/src/styles/landing.css'),
      'utf-8',
    )
    expect(landingCss).toContain('.landing__nav-signin')
    expect(landingCss).toContain('.landing__nav-cta')
    expect(landingCss).toContain('.landing__preview-url')
    expect(landingCss).toContain('white-space: nowrap')
    expect(landingCss).toContain('display: none !important')
  })

  it('guarantees safe area support and touch target minimums in layout.css', () => {
    const layoutCss = readFileSync(
      resolve(__dirname, '../src/styles/layout.css'),
      'utf-8',
    )
    expect(layoutCss).toContain('env(safe-area-inset-bottom')
    expect(layoutCss).toContain('calc(var(--bottom-nav-height)')
    expect(layoutCss).toContain('.card__body .t-h3')
    expect(layoutCss).toContain('.plan-card__main .t-h3')
    expect(layoutCss).toContain('.section__head a')
    expect(layoutCss).toContain('.auth__alt a')
  })
})

import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { FOCUS_PANEL, isTopOverlay, nextFocusTarget } from '@/components/ui/Overlay'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { nextRovingIndex, TabPanel, Tabs } from '@/components/ui/Tabs'
import { RovingRadioGroup } from '@/components/ui/Fields'
import { TrackCard } from '@/components/tracks/TrackCard'
import {
  CalendarHeatmap,
  formatHeatmapCount,
  formatHeatmapDate,
  heatmapAccessibleDays,
} from '@/components/analytics/CalendarHeatmap'
import { generateHeatmapMatrix } from '@/domain/streaks'
import { checkForDuplicateTrack, findDuplicateTrack } from '@/pages/tracks/NewTrackPage'
import type { TrackSummary } from '@/domain/progress'
import type { Track } from '@/types/domain'

const src = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf-8')

const track = (overrides: Partial<Track> = {}): Track =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    user_id: 'u1',
    name: 'Fitness',
    description: null,
    template_type: 'fitness',
    template_key: 'fitness',
    icon: 'Activity',
    color: '#c8f169',
    status: 'active',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }) as Track

describe('L3 Overlay focus trap (nextFocusTarget)', () => {
  it('pulls focus back into the panel when it is outside (e.g. on body after Save was disabled)', () => {
    expect(nextFocusTarget(3, -1, false, false)).toBe(0)
    expect(nextFocusTarget(3, -1, false, true)).toBe(2)
  })

  it('wraps at the first/last tabbable element', () => {
    expect(nextFocusTarget(3, 2, true, false)).toBe(0)
    expect(nextFocusTarget(3, 0, true, true)).toBe(2)
  })

  it('lets the browser move focus between inner elements', () => {
    expect(nextFocusTarget(3, 1, true, false)).toBeNull()
    expect(nextFocusTarget(3, 1, true, true)).toBeNull()
    expect(nextFocusTarget(3, 0, true, false)).toBeNull()
  })

  it('focuses the panel when it has nothing tabbable', () => {
    expect(nextFocusTarget(0, -1, false, false)).toBe(FOCUS_PANEL)
  })

  it('wraps from a non-tabbable inner element (roving option) only at the edges', () => {
    // After every tabbable element -> Tab wraps to first.
    expect(nextFocusTarget(3, -1, true, false, 3)).toBe(0)
    // Before every tabbable element -> Shift+Tab wraps to last.
    expect(nextFocusTarget(3, -1, true, true, 0)).toBe(2)
    // In the middle -> natural order.
    expect(nextFocusTarget(3, -1, true, false, 1)).toBeNull()
  })

  it('only the top-most overlay handles keys', () => {
    const a = Symbol('drawer')
    const b = Symbol('dialog')
    expect(isTopOverlay([a, b], b)).toBe(true)
    expect(isTopOverlay([a, b], a)).toBe(false)
    expect(isTopOverlay([], a)).toBe(false)
  })

  it('restores focus to the opener and gates Escape/backdrop on `dismissible`', () => {
    const overlay = src('src/components/ui/Overlay.tsx')
    expect(overlay).toContain('previouslyFocused.focus()')
    expect(overlay).toMatch(/if \(dismissibleRef\.current\) onCloseRef\.current\(\)/)
    expect(overlay).toContain('[data-autofocus]')
  })
})

describe('L4 ConfirmDialog ignores close while busy', () => {
  const props = {
    open: true,
    title: 'Delete?',
    message: 'Gone forever',
    confirmLabel: 'Delete',
    destructive: true,
    onConfirm: () => {},
  }

  it('does not call onCancel from Escape/backdrop while busy', () => {
    const onCancel = vi.fn()
    const el = ConfirmDialog({ ...props, busy: true, onCancel }) as ReactElement<{
      onClose: () => void
      dismissible: boolean
    }>
    expect(el.props.dismissible).toBe(false)
    el.props.onClose()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('closes normally when idle', () => {
    const onCancel = vi.fn()
    const el = ConfirmDialog({ ...props, busy: false, onCancel }) as ReactElement<{
      onClose: () => void
      dismissible: boolean
    }>
    expect(el.props.dismissible).toBe(true)
    el.props.onClose()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Modal forwards dismissible to the Overlay', () => {
    const el = Modal({ open: true, onClose: () => {}, title: 'x', dismissible: false }) as ReactElement<{
      dismissible: boolean
    }>
    expect(el.props.dismissible).toBe(false)
  })
})

describe('L6 roving keyboard model (nextRovingIndex)', () => {
  it('horizontal: Left/Right wrap, Home/End jump, Up/Down ignored', () => {
    expect(nextRovingIndex('ArrowRight', 0, 3)).toBe(1)
    expect(nextRovingIndex('ArrowRight', 2, 3)).toBe(0)
    expect(nextRovingIndex('ArrowLeft', 0, 3)).toBe(2)
    expect(nextRovingIndex('Home', 2, 3)).toBe(0)
    expect(nextRovingIndex('End', 0, 3)).toBe(2)
    expect(nextRovingIndex('ArrowDown', 0, 3)).toBeNull()
    expect(nextRovingIndex('a', 0, 3)).toBeNull()
  })

  it('both: Up/Down also move (radiogroup)', () => {
    expect(nextRovingIndex('ArrowDown', 0, 3, 'both')).toBe(1)
    expect(nextRovingIndex('ArrowUp', 0, 3, 'both')).toBe(2)
  })

  it('handles empty lists and out-of-range current index', () => {
    expect(nextRovingIndex('ArrowRight', 0, 0)).toBeNull()
    expect(nextRovingIndex('ArrowRight', -1, 3)).toBe(1)
  })
})

describe('L6 Tabs semantics', () => {
  const tabs = [
    { id: 'active', label: 'Active' },
    { id: 'archived', label: 'Archived' },
  ]

  it('only the selected tab is tabbable and only it points at a (rendered) panel', () => {
    const html = renderToStaticMarkup(
      createElement('div', null,
        createElement(Tabs, { tabs, active: 'archived', onChange: () => {}, label: 'Filter' }),
        createElement(TabPanel, { id: 'archived', active: 'archived', children: 'content' }),
      ),
    )
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html).toMatch(/id="tab-archived"[^>]*aria-controls="panel-archived"[^>]*tabindex="0"/)
    expect(html).not.toContain('aria-controls="panel-active"')
    expect(html).toContain('id="panel-archived"')
    expect(html).toContain('aria-labelledby="tab-archived"')
  })

  it('omits aria-controls entirely when the page renders no panels', () => {
    const html = renderToStaticMarkup(
      createElement(Tabs, { tabs, active: 'active', onChange: () => {}, label: 'Filter', controlsPanels: false }),
    )
    expect(html).not.toContain('aria-controls')
  })

  it('TracksPage wraps its list in the matching TabPanel', () => {
    expect(src('src/pages/tracks/TracksPage.tsx')).toContain('<TabPanel id={tab} active={tab}>')
  })
})

describe('L6 RovingRadioGroup (NewTrackPage colour/icon pickers)', () => {
  const options = [
    { value: 'a', label: 'Lime' },
    { value: 'b', label: 'Sky' },
    { value: 'c', label: 'Rose' },
  ]

  it('is a labelled radiogroup with only the checked radio tabbable', () => {
    const html = renderToStaticMarkup(
      createElement(RovingRadioGroup, { labelledBy: 'color-label', options, value: 'b', onChange: () => {} }),
    )
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-labelledby="color-label"')
    expect(html.match(/role="radio"/g)).toHaveLength(3)
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-checked="true"[^>]*aria-label="Sky"[^>]*tabindex="0"/)
  })

  it('keeps the first radio tabbable when nothing is checked', () => {
    const html = renderToStaticMarkup(
      createElement(RovingRadioGroup, { labelledBy: 'x', options, value: 'zzz', onChange: () => {} }),
    )
    expect(html).toMatch(/aria-label="Lime"[^>]*tabindex="0"/)
  })

  it('NewTrackPage uses it and ties picker labels to their groups', () => {
    const page = src('src/pages/tracks/NewTrackPage.tsx')
    expect(page).toContain('labelledBy={colorLabelId}')
    expect(page).toContain('labelledBy={iconLabelId}')
    expect(page).toContain('aria-labelledby={templateLabelId}')
    // No orphan <label> elements without htmlFor remain.
    expect(page).not.toMatch(/<label className="field__label"/)
  })
})

describe('L6 TrackCard archive/restore names include the Track', () => {
  // react-router's Link uses useLayoutEffect, which warns under server rendering.
  let consoleError: MockInstance
  beforeAll(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterAll(() => consoleError.mockRestore())

  const summary = (status: 'active' | 'archived'): TrackSummary =>
    ({
      track: track({ name: 'Marathon 2027', status }),
      activePlans: [],
      archivedPlans: [],
      progress: { percent: 0, done: 0, total: 0 },
    }) as unknown as TrackSummary

  const render = (status: 'active' | 'archived') =>
    renderToStaticMarkup(
      createElement(MemoryRouter, null,
        createElement(TrackCard, { summary: summary(status), onToggleArchive: () => {} }),
      ),
    )

  it('labels Archive with the track name', () => {
    expect(render('active')).toContain('aria-label="Archive Marathon 2027"')
  })

  it('labels Restore with the track name', () => {
    expect(render('archived')).toContain('aria-label="Restore Marathon 2027"')
  })
})

describe('L7 CalendarHeatmap accessible alternative', () => {
  const now = new Date(2026, 9, 13, 12)
  const counts = { '2026-10-12': 3, '2026-10-13': 1 }

  it('formats full dates with the year and pluralised counts', () => {
    expect(formatHeatmapDate('2026-10-12', 'en-GB')).toMatch(/12 Oct 2026/)
    const cell = { date: '2026-10-12', dayOfWeek: 1, count: 3, level: 3 as const, isToday: false, isFuture: false }
    expect(formatHeatmapCount(cell)).toBe('3 completions')
    expect(formatHeatmapCount({ ...cell, count: 1 })).toBe('1 completion')
    expect(formatHeatmapCount({ ...cell, count: 0, isScheduled: false })).toBe('No completions (not scheduled)')
  })

  it('lists every past/present day chronologically, never future ones', () => {
    const matrix = generateHeatmapMatrix(counts, now, 4)
    const days = heatmapAccessibleDays(matrix)
    expect(days.length).toBeGreaterThan(0)
    expect(days.every((d) => !d.isFuture)).toBe(true)
    expect(days[days.length - 1].date).toBe('2026-10-13')
    const sorted = [...days].map((d) => d.date).sort()
    expect(days.map((d) => d.date)).toEqual(sorted)
  })

  it('renders an sr-only table and no pointer cursor on non-interactive cells', () => {
    const html = renderToStaticMarkup(createElement(CalendarHeatmap, { dailyCounts: counts, now, weeksCount: 4 }))
    expect(html).toContain('<table>')
    expect(html).toContain('3 completions')
    expect(html).not.toContain('cursor:pointer')
  })
})

describe('L5/L8/L2/M6 TrackDetailPage contracts', () => {
  const page = src('src/pages/tracks/TrackDetailPage.tsx')

  it('announces edit errors', () => {
    expect(page).toContain('<div className="alert alert--error" role="alert">{editError}</div>')
  })

  it('guards the edit submit against double submission and submits via the form', () => {
    expect(page).toMatch(/if \(!track \|\| editBusyRef\.current\) return/)
    expect(page).toContain('type="submit" form={editFormId}')
    expect(page).toContain('<form id={editFormId} onSubmit={handleSaveEditTrack}')
    expect(page).toContain('dismissible={!editBusy}')
  })

  it('drops stale load responses (request id) and invalidates on unmount/trackId change', () => {
    expect(page).toContain('const requestId = ++requestRef.current')
    expect(page).toContain('if (requestId !== requestRef.current) return')
    expect(page).toContain('requestRef.current += 1')
  })

  it('renders a not-found state for a null Track instead of a retryable error', () => {
    expect(page).toContain('if (!fetchedTrack) {')
    expect(page).toContain('title="Track not found"')
    expect(page).toContain('<ButtonLink to="/tracks" variant="primary">')
  })

  it('TracksPage also drops stale responses', () => {
    const tracksPage = src('src/pages/tracks/TracksPage.tsx')
    expect(tracksPage).toContain('if (requestId !== requestRef.current) return')
  })
})

describe('M6 NewPlanPage with a missing Track', () => {
  const page = src('src/pages/plans/NewPlanPage.tsx')

  it('shows not-found (no form) when the Track is null, retryable error on failure', () => {
    expect(page).toContain('setTrackMissing(!t)')
    expect(page).toMatch(/if \(trackMissing\) \{[\s\S]*title="Track not found"[\s\S]*?\n  \}/)
    expect(page).toMatch(/if \(loadError \|\| !track\) \{[\s\S]*onRetry=/)
    // The form is only reachable after both early returns.
    expect(page.indexOf('<form')).toBeGreaterThan(page.indexOf('if (loadError || !track)'))
  })
})

describe('L10/L5 NewTrackPage duplicate check at submit time', () => {
  const existing = [track({ name: 'Deep Work', template_type: 'custom' }), track({ id: 't2', name: 'Money', template_type: 'finance' })]

  it('fails closed when the Track list cannot be loaded', async () => {
    const result = await checkForDuplicateTrack(() => Promise.reject(new Error('network down')), 'Deep Work', 'custom')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/nothing was created/)
  })

  it('finds a case-insensitive name duplicate from the fresh list', async () => {
    const loader = vi.fn(() => Promise.resolve(existing))
    const result = await checkForDuplicateTrack(loader, '  deep work ', 'custom')
    expect(loader).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true, duplicate: existing[0] })
  })

  it('matches by non-custom template and allows unique names', () => {
    expect(findDuplicateTrack(existing, 'Wealth', 'finance')?.id).toBe('t2')
    expect(findDuplicateTrack(existing, 'Something new', 'custom')).toBeNull()
  })

  it('no longer swallows list failures into an empty list, and announces errors', () => {
    const page = src('src/pages/tracks/NewTrackPage.tsx')
    expect(page).not.toContain('setExistingTracks([])')
    expect(page).toContain('checkForDuplicateTrack(listTracks, name, selectedTemplate)')
    expect(page).toContain('className="alert alert--error" role="alert"')
  })
})

describe('Focus visibility, touch targets and overflow CSS', () => {
  const global = src('src/styles/global.css')
  const ui = src('src/styles/ui.css')
  const layout = src('src/styles/layout.css')

  it('keeps a visible :focus-visible ring and keeps it unclipped in scrolling containers', () => {
    expect(global).toMatch(/:focus-visible \{\s*outline: 2px solid var\(--focus-ring\)/)
    expect(ui).toContain('.tabs__tab:focus-visible { outline-offset: -2px; }')
    expect(layout).toContain('.nav__link:focus-visible { outline-offset: -2px; }')
  })

  it('raises primary controls to 44px on touch devices', () => {
    expect(ui).toMatch(/@media \(pointer: coarse\) \{[^}]*\.btn, \.btn--sm \{ min-height: 44px; \}/)
  })

  it('wraps long unbroken Track names in headers and cards', () => {
    expect(ui).toContain('.page-header__title-text { min-width: 0; overflow-wrap: anywhere; }')
    expect(layout).toMatch(/\.card__body \.t-h3, \.card__body a \{[^}]*overflow-wrap: anywhere/)
  })
})

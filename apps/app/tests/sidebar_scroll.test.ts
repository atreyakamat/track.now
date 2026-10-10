import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Sidebar & Page Layout Independent Scrolling Architecture', () => {
  const layoutCss = readFileSync(
    resolve(__dirname, '../src/styles/layout.css'),
    'utf-8',
  )
  const uiCss = readFileSync(
    resolve(__dirname, '../src/styles/ui.css'),
    'utf-8',
  )
  const sidebarFile = readFileSync(
    resolve(__dirname, '../src/components/layout/Sidebar.tsx'),
    'utf-8',
  )
  const mobileNavFile = readFileSync(
    resolve(__dirname, '../src/components/layout/MobileNav.tsx'),
    'utf-8',
  )
  const overlayFile = readFileSync(
    resolve(__dirname, '../src/components/ui/Overlay.tsx'),
    'utf-8',
  )

  it('guarantees desktop shell confines layout to viewport and main content scrolls independently', () => {
    // Desktop media query enforces height: 100vh / 100dvh and overflow: hidden on shell
    expect(layoutCss).toContain('.shell { height: 100vh; height: 100dvh; overflow: hidden; }')

    // Main content area has independent vertical scrolling with min-height: 0
    expect(layoutCss).toContain('overflow-y: auto')
    expect(layoutCss).toContain('min-height: 0')
    expect(layoutCss).toContain('overscroll-behavior: contain')
  })

  it('guarantees sidebar layout has scrollable nav-wrapper with pinned header and footer', () => {
    // Top logo area is pinned
    expect(layoutCss).toMatch(/\.brand\s*\{[^}]*flex-shrink:\s*0/)

    // Middle navigation wrapper shrinks and scrolls independently
    expect(layoutCss).toContain('.sidebar__nav-wrapper')
    expect(layoutCss).toMatch(/\.sidebar__nav-wrapper\s*\{[^}]*flex:\s*1/)
    expect(layoutCss).toMatch(/\.sidebar__nav-wrapper\s*\{[^}]*min-height:\s*0/)
    expect(layoutCss).toMatch(/\.sidebar__nav-wrapper\s*\{[^}]*overflow-y:\s*auto/)

    // Bottom profile area is pinned at bottom
    expect(layoutCss).toMatch(/\.profile\s*\{[^}]*flex-shrink:\s*0/)
    expect(layoutCss).toMatch(/\.profile\s*\{[^}]*margin-top:\s*auto/)
  })

  it('guarantees mobile drawer navigation respects safe-area insets and overscroll containment', () => {
    // Drawer styles contain safe-area insets for notches and home indicators
    expect(layoutCss).toContain('env(safe-area-inset-top')
    expect(layoutCss).toContain('env(safe-area-inset-bottom')
    expect(layoutCss).toContain('env(safe-area-inset-left')
    expect(layoutCss).toContain('env(safe-area-inset-right')

    // Drawer container enforces full height and containment
    expect(uiCss).toContain('.drawer {')
    expect(uiCss).toContain('overscroll-behavior: contain')
    expect(uiCss).toContain('max-height: 100dvh')

    // Overlay backdrop intercepts touch events
    expect(overlayFile).toContain('onTouchMove')
    expect(uiCss).toContain('.overlay {')
  })

  it('guarantees Sidebar component renders brand, scrollable nav-wrapper, and accessible drawer close', () => {
    expect(sidebarFile).toContain('className="sidebar__nav-wrapper"')
    expect(sidebarFile).toContain('className="brand"')
    expect(sidebarFile).toContain('className="profile"')
    expect(sidebarFile).toContain('drawer__close')
    expect(sidebarFile).toContain('Close menu drawer')
  })

  it('guarantees MobileNav drawer wrapper provides minHeight: 0 and overflow: hidden', () => {
    expect(mobileNavFile).toContain('minHeight: 0')
    expect(mobileNavFile).toContain("overflow: 'hidden'")
  })
})

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface TabItem {
  id: string
  label: string
}

export type RovingOrientation = 'horizontal' | 'vertical' | 'both'

/**
 * Roving-focus keyboard model shared by tablists and radiogroups.
 * Returns the index that should receive focus/selection for `key`, or `null`
 * when the key is not a navigation key (so the caller must not preventDefault).
 * Arrow keys wrap; Home/End jump to the ends.
 */
export function nextRovingIndex(
  key: string,
  current: number,
  count: number,
  orientation: RovingOrientation = 'horizontal',
): number | null {
  if (count <= 0) return null
  const from = current >= 0 && current < count ? current : 0
  const horizontal = orientation !== 'vertical'
  const vertical = orientation !== 'horizontal'
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if ((horizontal && key === 'ArrowRight') || (vertical && key === 'ArrowDown')) return (from + 1) % count
  if ((horizontal && key === 'ArrowLeft') || (vertical && key === 'ArrowUp')) return (from - 1 + count) % count
  return null
}

/** Element ids shared by `Tabs` and `TabPanel`, so `aria-controls` / `aria-labelledby` always match. */
export const tabId = (id: string) => `tab-${id}`
export const tabPanelId = (id: string) => `panel-${id}`

/**
 * Accessible tablist (automatic activation, roving tabindex, Arrow/Home/End).
 * `aria-controls` is only emitted for the selected tab, because `TabPanel` only
 * renders the active panel; pass `controlsPanels={false}` when the page renders
 * no `TabPanel` at all, so the attribute never points at a missing element.
 */
export function Tabs({
  tabs, active, onChange, label, controlsPanels = true,
}: {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
  label: string
  controlsPanels?: boolean
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const activeIndex = tabs.findIndex((tab) => tab.id === active)

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const target = nextRovingIndex(event.key, index, tabs.length, 'horizontal')
    if (target === null) return
    event.preventDefault()
    const next = tabs[target]
    onChange(next.id)
    refs.current[next.id]?.focus()
  }

  return (
    <div className="tabs" role="tablist" aria-label={label} aria-orientation="horizontal">
      {tabs.map((tab, index) => {
        const selected = active === tab.id
        // If nothing matches `active`, keep the first tab reachable with Tab.
        const tabbable = selected || (activeIndex === -1 && index === 0)
        return (
          <button
            key={tab.id}
            ref={(node) => { refs.current[tab.id] = node }}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            aria-selected={selected}
            aria-controls={controlsPanels && selected ? tabPanelId(tab.id) : undefined}
            tabIndex={tabbable ? 0 : -1}
            className="tabs__tab"
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ id, active, children }: { id: string; active: string; children: ReactNode }) {
  if (id !== active) return null
  return (
    <div role="tabpanel" id={tabPanelId(id)} aria-labelledby={tabId(id)}>
      {children}
    </div>
  )
}

export function PageHeader({
  title, description, actions, back, eyebrow,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  eyebrow?: string
}) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {back && (
          <Link to={back.to} className="breadcrumb">
            <ChevronLeft size={14} aria-hidden="true" /> {back.label}
          </Link>
        )}
        {eyebrow && <span className="t-meta">{eyebrow}</span>}
        <h1 className="t-h1">{title}</h1>
        {description && <p className="t-muted">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}

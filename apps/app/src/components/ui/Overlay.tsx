import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface OverlayProps {
  open: boolean
  onClose: () => void
  label: string
  variant: 'modal' | 'drawer'
  /**
   * When false, Escape and backdrop clicks are ignored (e.g. while a save or
   * delete is in flight) so the dialog cannot vanish mid-operation.
   */
  dismissible?: boolean
  children: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Sentinel returned by `nextFocusTarget` meaning "focus the dialog panel itself". */
export const FOCUS_PANEL = -1

/**
 * Pure focus-trap decision for a Tab keypress inside a modal panel.
 *
 * @param count        number of tabbable elements inside the panel
 * @param activeIndex  index of `document.activeElement` among them, or -1
 * @param activeInside whether the active element is a descendant of the panel
 *                     (other than the panel itself)
 * @param shiftKey     whether Shift is held (backwards)
 * @param tabbablesBefore when the active element is inside the panel but not
 *                     itself tabbable (e.g. a roving-tabindex option), how many
 *                     tabbable elements precede it in document order
 * @returns the index to focus, `FOCUS_PANEL`, or `null` to let the browser move
 *          focus normally (it will stay inside the panel).
 */
export function nextFocusTarget(
  count: number,
  activeIndex: number,
  activeInside: boolean,
  shiftKey: boolean,
  tabbablesBefore = 0,
): number | null {
  if (count <= 0) return FOCUS_PANEL
  const first = 0
  const last = count - 1
  if (activeIndex === -1) {
    // Focus is outside the panel (body after the focused button became disabled,
    // the panel container itself, or an element behind the overlay): pull it back in.
    if (!activeInside) return shiftKey ? last : first
    // Inside, on a non-tabbable element: wrap only at the edges.
    if (shiftKey && tabbablesBefore <= 0) return last
    if (!shiftKey && tabbablesBefore >= count) return first
    return null
  }
  if (shiftKey && activeIndex === first) return last
  if (!shiftKey && activeIndex === last) return first
  return null
}

/**
 * Stack of open overlays. Only the top-most one handles Escape/Tab, so a
 * confirm dialog opened over a drawer does not close both or fight over focus.
 */
const overlayStack: symbol[] = []
/** Body overflow captured when the first overlay opened; restored when the last one closes. */
let bodyOverflowBeforeOverlays = ''

export function isTopOverlay(stack: readonly symbol[], token: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === token
}

/** Shared accessible overlay: Escape to close, focus trap, focus restore, scroll lock. */
export function Overlay({ open, onClose, label, variant, dismissible = true, children }: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const dismissibleRef = useRef(dismissible)
  dismissibleRef.current = dismissible

  const requestClose = () => {
    if (dismissibleRef.current) onCloseRef.current()
  }

  useEffect(() => {
    if (!open) return
    const token = Symbol(label)
    if (overlayStack.length === 0) bodyOverflowBeforeOverlays = document.body.style.overflow
    overlayStack.push(token)
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    // Initial focus goes into the dialog: an explicit [data-autofocus], else the first tabbable, else the panel.
    const firstTabbable = panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).find((node) => node.tabIndex >= 0)
      : undefined
    ;(panel?.querySelector<HTMLElement>('[data-autofocus]:not([disabled])') ?? firstTabbable ?? panel)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopOverlay(overlayStack, token)) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        event.preventDefault()
        if (dismissibleRef.current) onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      // Tab order only: skip roving-tabindex items (tabIndex -1) even when they are buttons.
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => node.tabIndex >= 0)
      const active = document.activeElement
      const activeIndex = active instanceof HTMLElement ? nodes.indexOf(active) : -1
      const activeInside = Boolean(active && active !== panel && panel.contains(active))
      const tabbablesBefore =
        activeIndex === -1 && activeInside && active
          ? nodes.filter((node) => node.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING).length
          : 0
      const target = nextFocusTarget(nodes.length, activeIndex, activeInside, event.shiftKey, tabbablesBefore)
      if (target === null) return
      event.preventDefault()
      if (target === FOCUS_PANEL) panel.focus()
      else nodes[target]?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const index = overlayStack.indexOf(token)
      if (index !== -1) overlayStack.splice(index, 1)
      // Only release the scroll lock once the last overlay closes.
      if (overlayStack.length === 0) document.body.style.overflow = bodyOverflowBeforeOverlays
      // Restore focus to the opener if it is still in the document.
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div
      className={`overlay${variant === 'drawer' ? ' overlay--drawer' : ''}`}
      onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
      onTouchMove={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault()
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={variant === 'modal' ? 'modal' : 'drawer'}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

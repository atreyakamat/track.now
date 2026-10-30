/**
 * App-wide change notifications (reminders updated, preferences changed, ...).
 *
 * Listeners registered with `onAppEvent` work on every platform. On the web each event is
 * also dispatched as a `CustomEvent` on `window`, so existing `window.addEventListener`
 * listeners keep working.
 */
export type AppEventName =
  | 'tracknow:reminders-updated'
  | 'tracknow:reminder-fired'
  | 'tracknow:notification-prefs-changed'
  | 'tracknow:widget-data-updated'

type Listener = (detail: unknown) => void

const listeners = new Map<AppEventName, Set<Listener>>()

export function onAppEvent(name: AppEventName, listener: Listener): () => void {
  let set = listeners.get(name)
  if (!set) {
    set = new Set()
    listeners.set(name, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

export function emitAppEvent(name: AppEventName, detail: unknown): void {
  listeners.get(name)?.forEach((listener) => {
    try {
      listener(detail)
    } catch (err) {
      console.error(`Listener for ${name} failed:`, err)
    }
  })
  const g = globalThis as {
    window?: { dispatchEvent?: (event: unknown) => boolean }
    CustomEvent?: new (type: string, init: { detail: unknown }) => unknown
  }
  if (typeof g.window?.dispatchEvent === 'function' && typeof g.CustomEvent === 'function') {
    g.window.dispatchEvent(new g.CustomEvent(name, { detail }))
  }
}

import { useSyncExternalStore } from 'react'

/**
 * Whether the browser currently has a network connection. `navigator.onLine` is a hint, not a
 * guarantee (it only knows about the network interface, not whether requests actually succeed),
 * so the app never relies on it for correctness — it is used only to show a friendly banner and
 * to quiet the "could not refresh" toasts while the connection is clearly down.
 *
 * The store is framework-free and takes its event target and reader by injection so it can be
 * unit-tested without a browser.
 */
export interface OnlineStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => boolean
}

export function createOnlineStore(
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | undefined,
  readOnline: () => boolean,
): OnlineStore {
  return {
    getSnapshot: () => {
      try {
        return readOnline()
      } catch {
        return true // assume online when we cannot tell; never trap the user behind a false banner
      }
    },
    subscribe: (listener) => {
      if (!target) return () => undefined
      target.addEventListener('online', listener)
      target.addEventListener('offline', listener)
      return () => {
        target.removeEventListener('online', listener)
        target.removeEventListener('offline', listener)
      }
    },
  }
}

const browserStore = createOnlineStore(
  typeof window !== 'undefined' ? window : undefined,
  () => (typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true),
)

/** React hook: re-renders when the browser goes online or offline. Server-safe (returns true). */
export function useOnlineStatus(store: OnlineStore = browserStore): boolean {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => true,
  )
}

/** True when we can be reasonably sure the network is down (used to quiet refresh-failure toasts). */
export function isLikelyOffline(): boolean {
  try {
    return typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false
  } catch {
    return false
  }
}

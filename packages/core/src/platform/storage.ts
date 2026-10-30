/**
 * Synchronous key-value storage for device-local data (reminders, notification preferences,
 * review notes). The web app uses localStorage; the mobile app registers a synchronous
 * SQLite-backed store with `configureStorage`.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  /** Every stored key (used to clear prefixed data on sign-out). */
  keys(): string[]
}

/** The subset of the DOM `Storage` interface used here. */
interface BrowserStorage {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

let configured: KeyValueStorage | null = null

export function configureStorage(storage: KeyValueStorage | null): void {
  configured = storage
}

/**
 * The registered storage, or the global localStorage when none is registered.
 * localStorage is looked up on every call (not cached) so tests can stub it per case.
 * Returns null when no storage is available (SSR, disabled storage).
 */
export function getStorage(): KeyValueStorage | null {
  if (configured) return configured
  try {
    const ls = (globalThis as { localStorage?: BrowserStorage }).localStorage
    if (!ls) return null
    return {
      getItem: (key) => ls.getItem(key),
      setItem: (key, value) => ls.setItem(key, value),
      removeItem: (key) => ls.removeItem(key),
      keys: () => {
        const out: string[] = []
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i)
          if (k !== null) out.push(k)
        }
        return out
      },
    }
  } catch {
    return null
  }
}

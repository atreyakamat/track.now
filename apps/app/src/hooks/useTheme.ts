import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tracknow-theme'
const listeners = new Set<() => void>()

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

/** Explicit choice wins; otherwise follow the operating-system preference (not persisted). */
function currentTheme(): Theme {
  return readStoredTheme() ?? systemTheme()
}

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const media = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : null
  const onSystemChange = () => {
    if (!readStoredTheme()) {
      applyTheme(systemTheme())
      listener()
    }
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      applyTheme(currentTheme())
      listener()
    }
  }
  media?.addEventListener?.('change', onSystemChange)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    media?.removeEventListener?.('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * Theme state shared by every component (Sidebar, Settings, …) through one store, so
 * toggling in one place updates all toggles immediately and across tabs.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light' as Theme)

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage unavailable: still apply for this session */
    }
    applyTheme(next)
    listeners.forEach((l) => l())
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme() === 'light' ? 'dark' : 'light')
  }, [setTheme])

  return { theme, setTheme, toggleTheme }
}

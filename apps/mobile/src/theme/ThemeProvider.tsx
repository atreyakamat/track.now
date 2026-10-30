import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Appearance } from 'react-native'
import { palettes, type ColorScheme, type ThemeColors } from './tokens'

export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'tracknow-theme'

interface ThemeContextValue {
  /** The user's choice: an explicit scheme, or 'system' to follow the OS. */
  preference: ThemePreference
  /** The scheme actually in effect right now. */
  scheme: ColorScheme
  colors: ThemeColors
  setPreference: (next: ThemePreference) => void
  /** Flips between light and dark (leaving 'system'). */
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [systemScheme, setSystemScheme] = useState<ColorScheme>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  )

  // Hydrate the saved preference once at startup.
  useEffect(() => {
    let active = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setPreferenceState(stored)
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  // Track OS changes so 'system' stays in sync.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light')
    })
    return () => sub.remove()
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined)
  }, [])

  const scheme: ColorScheme = preference === 'system' ? systemScheme : preference

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      scheme,
      colors: palettes[scheme],
      setPreference,
      toggle: () => setPreference(scheme === 'dark' ? 'light' : 'dark'),
    }),
    [preference, scheme, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}

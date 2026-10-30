/**
 * Track.now design tokens for React Native, ported from the web app's `tokens.css`.
 * Components consume these through `useTheme()` — never hard-coded colors.
 */

export type ColorScheme = 'light' | 'dark'

export interface ThemeColors {
  background: string
  surface: string
  surfaceMuted: string
  surfaceRaised: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  border: string
  borderStrong: string
  controlBg: string
  controlText: string
  controlBgHover: string
  accentPrimary: string
  accentPrimaryText: string
  accentSecondary: string
  success: string
  warning: string
  danger: string
  dangerText: string
  focusRing: string
  /** Overlay scrim behind modals and drawers. */
  scrim: string
}

const light: ThemeColors = {
  background: '#f4efe6',
  surface: '#fbf8f2',
  surfaceMuted: '#ebe5d8',
  surfaceRaised: '#ffffff',
  textPrimary: '#141414',
  textSecondary: '#6b665c',
  textTertiary: '#716b5e',
  border: '#ddd5c5',
  borderStrong: '#c4bba8',
  controlBg: '#141414',
  controlText: '#f4efe6',
  controlBgHover: '#2a2a27',
  accentPrimary: '#c8f169',
  accentPrimaryText: '#141414',
  accentSecondary: '#b9a7ff',
  success: '#2f7d4f',
  warning: '#b7791f',
  danger: '#c0392b',
  dangerText: '#ffffff',
  focusRing: '#141414',
  scrim: 'rgba(10, 10, 8, 0.45)',
}

const dark: ThemeColors = {
  background: '#0e0e0c',
  surface: '#171714',
  surfaceMuted: '#22221e',
  surfaceRaised: '#1d1d19',
  textPrimary: '#f4efe6',
  textSecondary: '#a8a396',
  textTertiary: '#8f8a7f',
  border: '#2c2c27',
  borderStrong: '#46463f',
  controlBg: '#f4efe6',
  controlText: '#141414',
  controlBgHover: '#ffffff',
  accentPrimary: '#c8f169',
  accentPrimaryText: '#141414',
  accentSecondary: '#b9a7ff',
  success: '#6fcf97',
  warning: '#e0a94b',
  danger: '#ef7a6c',
  dangerText: '#141414',
  focusRing: '#f4efe6',
  scrim: 'rgba(0, 0, 0, 0.6)',
}

export const palettes: Record<ColorScheme, ThemeColors> = { light, dark }

/** Track accent palette, stored by key (e.g. "lime"). Mirrors `--accent-*` in tokens.css. */
export const trackAccents: Record<string, string> = {
  lime: '#c8f169',
  lilac: '#b9a7ff',
  peach: '#ffb98f',
  sky: '#9fd3ff',
  rose: '#ffa9c4',
  mint: '#9eeccd',
}

export function resolveTrackColor(color: string | null | undefined): string {
  if (!color) return trackAccents.lime
  if (color.startsWith('#')) return color
  return trackAccents[color] ?? trackAccents.lime
}

export const spacing = {
  half: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const

export const fontSize = {
  display: 30,
  h1: 24,
  h2: 20,
  h3: 16,
  body: 15,
  caption: 13,
  meta: 11,
} as const

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
} as const

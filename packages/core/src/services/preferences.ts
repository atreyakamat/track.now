import { getStorage } from '../platform/storage'

/**
 * Device-local app preferences, per user. Nothing here affects what is stored on the server;
 * it only changes how the same data is shown.
 */
export interface AppPreferences {
  /** Vocabulary: the precise terms (Track / Plan / Arc) or plain ones (Area / Goal / Challenge). */
  naming: 'standard' | 'simple'
  /** 'gentle' hides XP, levels, quests and achievements; Momentum stays. */
  gamification: 'full' | 'gentle'
  /** Hour clock for times shown by the app ('auto' follows the device). */
  timeFormat: 'auto' | '12h' | '24h'
}

export const DEFAULT_PREFERENCES: AppPreferences = { naming: 'standard', gamification: 'full', timeFormat: 'auto' }

const key = (userId: string) => `tracknow_prefs_${userId}`
const listeners = new Set<(p: AppPreferences) => void>()

export function loadPreferences(userId: string): AppPreferences {
  try {
    const raw = getStorage()?.getItem(key(userId))
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<AppPreferences>
    return {
      naming: parsed.naming === 'simple' ? 'simple' : 'standard',
      gamification: parsed.gamification === 'gentle' ? 'gentle' : 'full',
      timeFormat: parsed.timeFormat === '12h' || parsed.timeFormat === '24h' ? parsed.timeFormat : 'auto',
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(userId: string, patch: Partial<AppPreferences>): AppPreferences {
  const next = { ...loadPreferences(userId), ...patch }
  try {
    getStorage()?.setItem(key(userId), JSON.stringify(next))
  } catch {
    /* storage unavailable: the change lasts for this session only */
  }
  listeners.forEach((l) => l(next))
  return next
}

/** Subscribe to preference changes made anywhere in the app (same process). */
export function onPreferencesChange(listener: (p: AppPreferences) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function clearPreferencesForUser(userId: string): void {
  try {
    getStorage()?.removeItem(key(userId))
  } catch {
    /* ignore */
  }
}

/** Formats a local HH:MM clock string according to the preference. */
export function formatClock(hhmm: string, pref: AppPreferences['timeFormat']): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  const use12 = pref === '12h' || (pref === 'auto' && new Date(2000, 0, 1, 13).toLocaleTimeString().toLowerCase().includes('m'))
  if (!use12) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

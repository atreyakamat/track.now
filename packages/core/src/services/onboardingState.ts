import { getStorage } from '../platform/storage'

/**
 * Device-local, per-user onboarding facts that are not in the database: whether the tour was
 * completed, whether Focus has ever been used, whether the quests card was dismissed, the last
 * level announced. Losing them (another device, cleared storage) only means the tour is
 * offered again. Shared by the web and mobile apps through the platform storage seam.
 */
const key = (userId: string, what: string) => `tracknow_onboarding_${what}_${userId}`

function read(userId: string, what: string): boolean {
  try {
    return getStorage()?.getItem(key(userId, what)) === '1'
  } catch {
    return false
  }
}
function write(userId: string, what: string, value: boolean): void {
  try {
    const s = getStorage()
    if (!s) return
    if (value) s.setItem(key(userId, what), '1')
    else s.removeItem(key(userId, what))
  } catch {
    /* storage unavailable: the tour is simply offered again next time */
  }
}

export const onboardingState = {
  tourDone: (userId: string) => read(userId, 'tour'),
  setTourDone: (userId: string, done = true) => write(userId, 'tour', done),
  focusUsed: (userId: string) => read(userId, 'focus'),
  setFocusUsed: (userId: string) => write(userId, 'focus', true),
  questsDismissed: (userId: string) => read(userId, 'quests_dismissed'),
  setQuestsDismissed: (userId: string, dismissed = true) => write(userId, 'quests_dismissed', dismissed),
  /** A one-shot request (e.g. from Settings) for the home screen to open the tour. */
  tourRequested: (userId: string) => read(userId, 'tour_requested'),
  setTourRequested: (userId: string, requested = true) => write(userId, 'tour_requested', requested),
  /**
   * Achievements already announced on this device, or null when none was ever recorded (the first
   * run records what is already earned silently, so an old account is not greeted by a pile of toasts).
   */
  seenAchievements: (userId: string): string[] | null => {
    try {
      const raw = getStorage()?.getItem(key(userId, 'achievements'))
      if (raw === null || raw === undefined) return null
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : null
    } catch {
      return null
    }
  },
  setSeenAchievements: (userId: string, ids: readonly string[]) => {
    try {
      getStorage()?.setItem(key(userId, 'achievements'), JSON.stringify(ids))
    } catch {
      /* ignore */
    }
  },
  /** Monday of the last weekly recap the user dismissed. */
  recapDismissedFor: (userId: string): string | null => {
    try {
      return getStorage()?.getItem(key(userId, 'recap')) ?? null
    } catch {
      return null
    }
  },
  setRecapDismissedFor: (userId: string, weekStart: string) => {
    try {
      getStorage()?.setItem(key(userId, 'recap'), weekStart)
    } catch {
      /* ignore */
    }
  },
  /** The level last shown to the user, to announce level-ups once. */
  lastLevel: (userId: string): number => {
    try {
      return Number(getStorage()?.getItem(key(userId, 'level')) ?? 0) || 0
    } catch {
      return 0
    }
  },
  setLastLevel: (userId: string, level: number) => {
    try {
      getStorage()?.setItem(key(userId, 'level'), String(level))
    } catch {
      /* ignore */
    }
  },
}

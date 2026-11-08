/**
 * Local, per-user onboarding facts that are not in the database: whether the tour was
 * completed, whether Focus has ever been used, whether the quests card was dismissed.
 * Losing them (another device, cleared storage) only means the tour is offered again.
 */
const key = (userId: string, what: string) => `tracknow_onboarding_${what}_${userId}`

function read(userId: string, what: string): boolean {
  try {
    return localStorage.getItem(key(userId, what)) === '1'
  } catch {
    return false
  }
}
function write(userId: string, what: string, value: boolean): void {
  try {
    if (value) localStorage.setItem(key(userId, what), '1')
    else localStorage.removeItem(key(userId, what))
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
  /** The level last shown to the user, to announce level-ups once. */
  lastLevel: (userId: string): number => {
    try {
      return Number(localStorage.getItem(key(userId, 'level')) ?? 0) || 0
    } catch {
      return 0
    }
  },
  setLastLevel: (userId: string, level: number) => {
    try {
      localStorage.setItem(key(userId, 'level'), String(level))
    } catch {
      /* ignore */
    }
  },
}

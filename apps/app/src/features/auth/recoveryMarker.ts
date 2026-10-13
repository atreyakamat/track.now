/**
 * Remembers, for this browser tab only, that the current session was created by a
 * password-recovery link (Supabase PASSWORD_RECOVERY event). The reset page needs this
 * to survive a reload, but it must not outlive the tab or be usable much later: an
 * ordinary signed-in session must never be able to set a new password without proof.
 */
const KEY = 'tracknow_password_recovery'
/** Supabase recovery links are short-lived; the marker is honoured for one hour. */
export const RECOVERY_MARKER_TTL_MS = 60 * 60 * 1000

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

export function writeRecoveryMarker(userId: string, now = Date.now()): void {
  try {
    storage()?.setItem(KEY, JSON.stringify({ userId, at: now }))
  } catch {
    /* storage disabled: the in-memory state still covers this page view */
  }
}

/** Returns the user id the marker was issued for, or null when absent, invalid or expired. */
export function readRecoveryMarker(now = Date.now()): string | null {
  try {
    const raw = storage()?.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { userId?: unknown; at?: unknown }
    if (typeof parsed.userId !== 'string' || typeof parsed.at !== 'number') return null
    if (now - parsed.at > RECOVERY_MARKER_TTL_MS || parsed.at > now + 60_000) return null
    return parsed.userId
  } catch {
    return null
  }
}

export function clearRecoveryMarker(): void {
  try {
    storage()?.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

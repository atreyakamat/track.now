import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { getTodayDateString } from '../domain/dates'
import { clearFocusForUser, loadFocusState, sanitizeFocusState, saveFocusState, type FocusState } from './focusService'
import {
  applyRemoteReviewNotes,
  clearReviewNotesForUser,
  clearReviewTombstones,
  isValidPeriodKey,
  loadReviewNotes,
  loadReviewTombstones,
  sanitizeReviewNote,
  type ReviewNote,
} from './reviewNotesStorage'

/**
 * Keeps review notes and Today's focus the same on every device the user signs in on
 * (table track_now_synced_state, migration 20261111000000).
 *
 * The device's own copy stays the first thing written and the first thing read, so nothing
 * here can slow down or block the screen, and everything keeps working offline. Sync is:
 * read the account's copy, keep whichever side was edited last for each entry, send back
 * what the account is missing. A deleted note travels as an entry with a null value, so a
 * device that still has the old text cannot bring it back.
 *
 * "Edited last" compares the clocks of the devices that made the edits. Two devices with
 * clocks minutes apart, editing the same note within those minutes, can pick the wrong side;
 * for notes one person writes, that is an accepted trade for needing no server code.
 *
 * The apps ship before the migration is applied: the first "table not found" answer turns
 * sync off for the session and callers report `device-only`.
 */

export const SYNCED_STATE_TABLE = 'track_now_synced_state'
export const FOCUS_SYNC_KEY = 'today'

export type SyncScope = 'review_note' | 'focus'
/**
 * - `synced`: the account and this device agree.
 * - `device-only`: the account cannot store this yet (database update pending) or nobody is
 *   signed in; the device copy is the only copy.
 * - `failed`: the account could not be reached just now; the device copy is safe and the
 *   next sync sends it.
 */
export type SyncStatus = 'synced' | 'device-only' | 'failed'

interface PgError {
  code?: string
  message?: string
}

interface RemoteRow {
  key: string
  value: unknown
  updated_at: string
}

interface OutgoingRow {
  key: string
  value: unknown
  updatedAt: string
}

/** The table does not exist yet (migration not applied): stop asking for this session. */
let unavailable = false

/** PGRST205 = table not in the schema cache; 42P01 = undefined table. */
function isMissingTableError(error: PgError): boolean {
  if (error.code === 'PGRST205' || error.code === '42P01') return true
  return /could not find the table|relation .* does not exist/i.test(error.message ?? '')
}

const time = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? 0 : t
}

/** True once the database answered that it has no sync table. */
export function isSyncUnavailable(): boolean {
  return unavailable
}

/** Test hook. */
export function resetSyncedStateForTests(): void {
  unavailable = false
}

/** The account's rows for one scope; null when the account cannot store them yet. Throws on other errors. */
async function pull(scope: SyncScope, key?: string): Promise<RemoteRow[] | null> {
  if (unavailable || !isSupabaseConfigured) return null
  let query = supabase.from(SYNCED_STATE_TABLE).select('key, value, updated_at').eq('scope', scope)
  if (key) query = query.eq('key', key)
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) {
      unavailable = true
      return null
    }
    throw new Error(error.message || 'Could not read synced data.')
  }
  return (Array.isArray(data) ? data : []).filter(
    (r): r is RemoteRow => typeof r?.key === 'string' && typeof r?.updated_at === 'string',
  )
}

/** Writes rows to the account; false when the account cannot store them yet. Throws on other errors. */
async function push(userId: string, scope: SyncScope, rows: OutgoingRow[]): Promise<boolean> {
  if (unavailable || !isSupabaseConfigured) return false
  if (rows.length === 0) return true
  const { error } = await supabase.from(SYNCED_STATE_TABLE).upsert(
    rows.map((r) => ({ user_id: userId, scope, key: r.key, value: r.value, updated_at: r.updatedAt })),
    { onConflict: 'user_id,scope,key' },
  )
  if (error) {
    if (isMissingTableError(error)) {
      unavailable = true
      return false
    }
    throw new Error(error.message || 'Could not save synced data.')
  }
  return true
}

// ---------------------------------------------------------------------------- review notes

export interface ReviewSyncResult {
  status: SyncStatus
  /** True when this device's notes changed (a screen showing them should reload). */
  changed: boolean
}

/** Decides, entry by entry, what the device takes over and what the account is still missing. */
export function mergeReviewNotes(
  local: Record<string, ReviewNote>,
  tombstones: Record<string, string>,
  remote: RemoteRow[],
): { adopt: ReviewNote[]; remove: string[]; send: OutgoingRow[]; settled: string[] } {
  const adopt: ReviewNote[] = []
  const remove: string[] = []
  const send: OutgoingRow[] = []
  /** Local deletions the account already knows about (or never had). */
  const settled: string[] = []
  const seen = new Set<string>()

  for (const row of remote) {
    if (!isValidPeriodKey(row.key)) continue
    seen.add(row.key)
    const remoteNote = row.value === null ? null : sanitizeReviewNote(row.value, row.key)
    if (row.value !== null && !remoteNote) continue // unreadable entry: leave both sides alone
    const remoteAt = time(remoteNote?.updatedAt ?? row.updated_at)
    const localNote = local[row.key]
    const deletedAt = tombstones[row.key]

    if (localNote) {
      if (time(localNote.updatedAt) > remoteAt) send.push({ key: row.key, value: localNote, updatedAt: localNote.updatedAt })
      else if (time(localNote.updatedAt) < remoteAt) {
        if (remoteNote) adopt.push(remoteNote)
        else remove.push(row.key)
      }
    } else if (deletedAt) {
      if (time(deletedAt) > remoteAt) send.push({ key: row.key, value: null, updatedAt: deletedAt })
      else if (remoteNote) adopt.push(remoteNote) // written again elsewhere after this delete
      else settled.push(row.key)
    } else if (remoteNote) {
      adopt.push(remoteNote)
    }
  }

  for (const [key, note] of Object.entries(local)) {
    if (!seen.has(key)) send.push({ key, value: note, updatedAt: note.updatedAt })
  }
  for (const key of Object.keys(tombstones)) {
    if (!seen.has(key) && !(key in local)) settled.push(key) // the account never had it
  }
  return { adopt, remove, send, settled }
}

/** Brings this device and the account to the same set of review notes. Never throws. */
export async function syncReviewNotes(userId: string): Promise<ReviewSyncResult> {
  if (!userId) return { status: 'device-only', changed: false }
  try {
    const remote = await pull('review_note')
    if (remote === null) return { status: 'device-only', changed: false }
    const { adopt, remove, send, settled } = mergeReviewNotes(loadReviewNotes(userId), loadReviewTombstones(userId), remote)
    const changed = adopt.length + remove.length > 0
    if (changed && !applyRemoteReviewNotes(userId, adopt, remove)) return { status: 'failed', changed: false }
    if (!(await push(userId, 'review_note', send))) return { status: 'device-only', changed }
    clearReviewTombstones(userId, [...settled, ...send.filter((r) => r.value === null).map((r) => r.key)])
    return { status: 'synced', changed }
  } catch {
    return { status: 'failed', changed: false }
  }
}

/**
 * Sends one period to the account right after it was saved or deleted on this device.
 * Never throws; a failure leaves the device copy in place for the next `syncReviewNotes`.
 */
export async function pushReviewNote(userId: string, periodKey: string): Promise<SyncStatus> {
  if (!userId || !isValidPeriodKey(periodKey)) return 'device-only'
  try {
    const note = loadReviewNotes(userId)[periodKey]
    const deletedAt = loadReviewTombstones(userId)[periodKey]
    if (!note && !deletedAt) return unavailable ? 'device-only' : 'synced'
    const row: OutgoingRow = note ? { key: periodKey, value: note, updatedAt: note.updatedAt } : { key: periodKey, value: null, updatedAt: deletedAt }
    if (!(await push(userId, 'review_note', [row]))) return 'device-only'
    if (!note) clearReviewTombstones(userId, [periodKey])
    return 'synced'
  } catch {
    return 'failed'
  }
}

// ---------------------------------------------------------------------------- today's focus

export interface FocusSyncResult {
  status: SyncStatus
  /** Today's focus after the sync when it changed on this device, otherwise null. */
  ids: string[] | null
}

/**
 * Makes today's focus the same here and on the account: the side changed last wins. A focus
 * from an earlier day counts as empty. Never throws.
 */
export async function syncFocus(userId: string, now = new Date()): Promise<FocusSyncResult> {
  if (!userId) return { status: 'device-only', ids: null }
  try {
    const rows = await pull('focus', FOCUS_SYNC_KEY)
    if (rows === null) return { status: 'device-only', ids: null }
    const today = getTodayDateString(now)
    const remoteAny = rows[0] ? sanitizeFocusState(rows[0].value) : null
    const remote = remoteAny && remoteAny.date === today ? remoteAny : null
    const local = loadFocusState(userId, now)

    if (remote && (!local || time(remote.updatedAt) > time(local.updatedAt))) {
      const before = local?.ids ?? []
      saveFocusState(userId, remote)
      const same = before.length === remote.ids.length && before.every((id, i) => id === remote.ids[i])
      return { status: 'synced', ids: same ? null : remote.ids }
    }
    if (local && (!remote || time(local.updatedAt) > time(remote.updatedAt) || !local.updatedAt)) {
      // A copy from before focus was synced has no time yet: stamp it so later edits can win.
      const stamped: FocusState = local.updatedAt ? local : { ...local, updatedAt: now.toISOString() }
      if (!local.updatedAt) {
        if (remote || stamped.ids.length === 0) return { status: 'synced', ids: null }
        saveFocusState(userId, stamped)
      }
      const sent = await push(userId, 'focus', [{ key: FOCUS_SYNC_KEY, value: stamped, updatedAt: stamped.updatedAt as string }])
      return { status: sent ? 'synced' : 'device-only', ids: null }
    }
    return { status: 'synced', ids: null }
  } catch {
    return { status: 'failed', ids: null }
  }
}

/** Sends today's focus to the account right after it changed on this device. Never throws. */
export async function pushFocus(userId: string, now = new Date()): Promise<SyncStatus> {
  if (!userId) return 'device-only'
  try {
    const local = loadFocusState(userId, now)
    if (!local || !local.updatedAt) return unavailable ? 'device-only' : 'synced'
    return (await push(userId, 'focus', [{ key: FOCUS_SYNC_KEY, value: local, updatedAt: local.updatedAt }])) ? 'synced' : 'device-only'
  } catch {
    return 'failed'
  }
}

// ---------------------------------------------------------------------------- sign-out

/**
 * Call just BEFORE signing out (it needs the session). Sends anything not yet on the account
 * and, only when the account confirms it has everything, removes this device's copy of the
 * review notes and focus, so the next person to use this browser or phone cannot read them.
 * When the account cannot store them (or cannot be reached) the device copy is the only copy
 * and is kept. Never throws and never waits longer than `timeoutMs`.
 * Returns true when the device copy was removed.
 */
export async function releaseSyncedCopies(userId: string, timeoutMs = 4000): Promise<boolean> {
  if (!userId) return false
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    const result = await Promise.race([syncReviewNotes(userId), timeout])
    if (!result || result.status !== 'synced') return false
    clearReviewNotesForUser(userId)
    clearFocusForUser(userId)
    return true
  } catch {
    return false
  }
}

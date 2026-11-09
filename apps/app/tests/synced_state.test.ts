import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteReviewNote,
  loadReviewNote,
  loadReviewNotes,
  loadReviewTombstones,
  saveReviewNote,
  type ReviewNote,
} from '@tracknow/core/services/reviewNotesStorage'
import { loadFocusIds, loadFocusState, saveFocusState, toggleFocusId } from '@tracknow/core/services/focusService'
import {
  FOCUS_SYNC_KEY,
  isSyncUnavailable,
  mergeReviewNotes,
  pushFocus,
  pushReviewNote,
  resetSyncedStateForTests,
  syncFocus,
  syncReviewNotes,
} from '@tracknow/core/services/syncedState'
import { supabase } from '@tracknow/core/lib/supabase'

/**
 * Review notes and Today's focus follow the account (table track_now_synced_state).
 * The device copy is always the first copy; these tests pin the merge rules (newest edit wins,
 * deletes travel, typed text is never lost) and the fallbacks (table missing, offline).
 */

vi.mock('@tracknow/core/lib/supabase', () => ({
  supabase: { from: vi.fn() },
  isSupabaseConfigured: true,
}))

function createStorage() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

type Row = { user_id: string; scope: string; key: string; value: unknown; updated_at: string }
type Failure = { code?: string; message: string } | null

/** A stand-in for the account's table, shared by "devices" (each device = its own storage). */
function fakeAccount() {
  const state = { rows: [] as Row[], readError: null as Failure, writeError: null as Failure, reads: 0, writes: 0 }
  ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table !== 'track_now_synced_state') throw new Error(`unexpected table ${table}`)
    const filters: Record<string, unknown> = {}
    let upserted: Row[] | null = null
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters[column] = value
        return builder
      },
      upsert: (rows: Row[], options: { onConflict: string }) => {
        expect(options).toEqual({ onConflict: 'user_id,scope,key' })
        upserted = rows
        return builder
      },
      then: (ok: (v: { data: unknown; error: Failure }) => unknown, bad?: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => {
            if (upserted) {
              state.writes += 1
              if (state.writeError) return { data: null, error: state.writeError }
              for (const row of upserted) {
                state.rows = state.rows.filter((r) => !(r.user_id === row.user_id && r.scope === row.scope && r.key === row.key))
                state.rows.push(JSON.parse(JSON.stringify(row)) as Row)
              }
              return { data: null, error: null }
            }
            state.reads += 1
            if (state.readError) return { data: null, error: state.readError }
            // Row Level Security: only the signed-in user's rows (tests use one user per account).
            const data = state.rows
              .filter((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
              .map(({ key, value, updated_at }) => ({ key, value, updated_at }))
            return { data, error: null }
          })
          .then(ok, bad),
    }
    return builder
  })
  return state
}

const USER = 'user-a'
const WEEK = 'weekly:2026-11-09'
const MONTH = 'monthly:2026-10'
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 10, h, m))
const note = (periodKey: string, text: string, when: Date, priorities: string[] = []): ReviewNote => ({
  periodKey,
  kind: periodKey.startsWith('weekly') ? 'weekly' : 'monthly',
  answers: { friction: text },
  priorities,
  updatedAt: when.toISOString(),
})

/** Two devices of the same user: each has its own storage, both talk to the same account. */
const phone = createStorage()
const laptop = createStorage()
const on = (device: ReturnType<typeof createStorage>) => vi.stubGlobal('localStorage', device)

beforeEach(() => {
  vi.clearAllMocks()
  phone.clear()
  laptop.clear()
  resetSyncedStateForTests()
  on(laptop)
})

describe('mergeReviewNotes', () => {
  const remoteRow = (n: ReviewNote) => ({ key: n.periodKey, value: n as unknown, updated_at: n.updatedAt })

  it('takes notes the device does not have and sends notes the account does not have', () => {
    const mine = note(WEEK, 'mine', at(8))
    const theirs = note(MONTH, 'theirs', at(9))
    const plan = mergeReviewNotes({ [WEEK]: mine }, {}, [remoteRow(theirs)])
    expect(plan.adopt).toEqual([theirs])
    expect(plan.send).toEqual([{ key: WEEK, value: mine, updatedAt: mine.updatedAt }])
    expect(plan.remove).toEqual([])
  })

  it('the newer edit wins in both directions; equal copies do nothing', () => {
    const older = note(WEEK, 'older', at(8))
    const newer = note(WEEK, 'newer', at(9))
    expect(mergeReviewNotes({ [WEEK]: older }, {}, [remoteRow(newer)])).toMatchObject({ adopt: [newer], send: [] })
    expect(mergeReviewNotes({ [WEEK]: newer }, {}, [remoteRow(older)])).toMatchObject({ adopt: [], send: [{ key: WEEK, value: newer }] })
    expect(mergeReviewNotes({ [WEEK]: newer }, {}, [remoteRow(newer)])).toEqual({ adopt: [], remove: [], send: [], settled: [] })
  })

  it('a delete made here after the account copy is sent; a note rewritten elsewhere after the delete comes back', () => {
    const remote = note(WEEK, 'still on the account', at(8))
    const deletedLater = mergeReviewNotes({}, { [WEEK]: at(9).toISOString() }, [remoteRow(remote)])
    expect(deletedLater.send).toEqual([{ key: WEEK, value: null, updatedAt: at(9).toISOString() }])
    expect(deletedLater.adopt).toEqual([])

    const rewritten = note(WEEK, 'written again on the phone', at(10))
    const deletedEarlier = mergeReviewNotes({}, { [WEEK]: at(9).toISOString() }, [remoteRow(rewritten)])
    expect(deletedEarlier).toMatchObject({ adopt: [rewritten], send: [] })
  })

  it('a delete made elsewhere removes an older copy here, but not text written after it', () => {
    const tombstone = { key: WEEK, value: null, updated_at: at(9).toISOString() }
    expect(mergeReviewNotes({ [WEEK]: note(WEEK, 'old', at(8)) }, {}, [tombstone])).toMatchObject({ remove: [WEEK], send: [] })
    const fresh = note(WEEK, 'new', at(10))
    expect(mergeReviewNotes({ [WEEK]: fresh }, {}, [tombstone])).toMatchObject({ remove: [], send: [{ key: WEEK, value: fresh }] })
  })

  it('ignores account rows it cannot read instead of overwriting anything with them', () => {
    const mine = note(WEEK, 'mine', at(8))
    const plan = mergeReviewNotes({ [WEEK]: mine }, {}, [
      { key: WEEK, value: { kind: 'weekly', periodKey: 'weekly:1999-01-04', answers: {}, priorities: [], updatedAt: at(12).toISOString() }, updated_at: at(12).toISOString() },
      { key: '../../etc', value: note(MONTH, 'x', at(12)), updated_at: at(12).toISOString() },
    ])
    expect(plan).toEqual({ adopt: [], remove: [], send: [], settled: [] })
  })
})

describe('review notes across two devices', () => {
  it('a note saved on the laptop appears on the phone', async () => {
    const account = fakeAccount()
    on(laptop)
    saveReviewNote(USER, { periodKey: WEEK, kind: 'weekly', answers: { friction: 'Late nights' }, priorities: ['Ship v1'] }, at(8))
    expect(await pushReviewNote(USER, WEEK)).toBe('synced')
    expect(account.rows).toHaveLength(1)
    expect(account.rows[0]).toMatchObject({ user_id: USER, scope: 'review_note', key: WEEK, updated_at: at(8).toISOString() })

    on(phone)
    expect(loadReviewNote(USER, WEEK)).toBeNull()
    expect(await syncReviewNotes(USER)).toEqual({ status: 'synced', changed: true })
    expect(loadReviewNote(USER, WEEK)).toMatchObject({ answers: { friction: 'Late nights' }, priorities: ['Ship v1'], updatedAt: at(8).toISOString() })
    // A second sync has nothing to do and writes nothing.
    const writes = account.writes
    expect(await syncReviewNotes(USER)).toEqual({ status: 'synced', changed: false })
    expect(account.writes).toBe(writes)
  })

  it('notes written offline on both devices all end up on both', async () => {
    fakeAccount()
    on(laptop)
    saveReviewNote(USER, { periodKey: WEEK, kind: 'weekly', answers: { friction: 'laptop' }, priorities: [] }, at(8))
    on(phone)
    saveReviewNote(USER, { periodKey: MONTH, kind: 'monthly', answers: { stalled: 'phone' }, priorities: [] }, at(9))

    on(laptop)
    await syncReviewNotes(USER)
    on(phone)
    expect((await syncReviewNotes(USER)).changed).toBe(true)
    on(laptop)
    expect((await syncReviewNotes(USER)).changed).toBe(true)
    expect(Object.keys(loadReviewNotes(USER)).sort()).toEqual([MONTH, WEEK])
    on(phone)
    expect(Object.keys(loadReviewNotes(USER)).sort()).toEqual([MONTH, WEEK])
  })

  it('the same period edited on both devices keeps the later edit everywhere', async () => {
    fakeAccount()
    on(laptop)
    saveReviewNote(USER, { periodKey: WEEK, kind: 'weekly', answers: { friction: 'first, on the laptop' }, priorities: [] }, at(8))
    await syncReviewNotes(USER)
    on(phone)
    await syncReviewNotes(USER)
    saveReviewNote(USER, { periodKey: WEEK, kind: 'weekly', answers: { friction: 'later, on the phone' }, priorities: [] }, at(9))
    await pushReviewNote(USER, WEEK)

    on(laptop)
    expect(await syncReviewNotes(USER)).toEqual({ status: 'synced', changed: true })
    expect(loadReviewNote(USER, WEEK)?.answers.friction).toBe('later, on the phone')
  })

  it('a delete on one device removes the note on the other and is not undone by its old copy', async () => {
    const account = fakeAccount()
    on(laptop)
    saveReviewNote(USER, { periodKey: WEEK, kind: 'weekly', answers: { friction: 'to be deleted' }, priorities: [] }, at(8))
    await syncReviewNotes(USER)
    on(phone)
    await syncReviewNotes(USER)
    expect(loadReviewNote(USER, WEEK)).not.toBeNull()

    on(laptop)
    deleteReviewNote(USER, WEEK, at(9))
    expect(loadReviewTombstones(USER)).toEqual({ [WEEK]: at(9).toISOString() })
    expect(await pushReviewNote(USER, WEEK)).toBe('synced')
    expect(loadReviewTombstones(USER)).toEqual({})
    expect(account.rows[0]).toMatchObject({ key: WEEK, value: null, updated_at: at(9).toISOString() })

    on(phone)
    expect(await syncReviewNotes(USER)).toEqual({ status: 'synced', changed: true })
    expect(loadReviewNote(USER, WEEK)).toBeNull()
    expect(account.rows[0].value).toBeNull() // the phone's old copy was not pushed back
  })

  it('writing a period again after deleting it clears the pending delete', () => {
    saveReviewNote(USER, { periodKey: WEEK, kind: 'weekly', answers: { friction: 'a' }, priorities: [] }, at(8))
    deleteReviewNote(USER, WEEK, at(9))
    saveReviewNote(USER, { periodKey: WEEK, kind: 'weekly', answers: { friction: 'b' }, priorities: [] }, at(10))
    expect(loadReviewTombstones(USER)).toEqual({})
  })
})

describe('review notes when the account cannot store them', () => {
  it('before the database update: device-only, asked once, notes untouched', async () => {
    const account = fakeAccount()
    account.readError = { code: 'PGRST205', message: "Could not find the table 'public.track_now_synced_state' in the schema cache" }
    account.writeError = account.readError
    saveReviewNote(USER, { periodKey: WEEK, kind: 'weekly', answers: { friction: 'kept' }, priorities: [] }, at(8))

    expect(await syncReviewNotes(USER)).toEqual({ status: 'device-only', changed: false })
    expect(isSyncUnavailable()).toBe(true)
    expect(await pushReviewNote(USER, WEEK)).toBe('device-only')
    expect(await syncFocus(USER, at(8))).toEqual({ status: 'device-only', ids: null })
    expect(account.reads + account.writes).toBe(1) // no further requests this session
    expect(loadReviewNote(USER, WEEK)?.answers.friction).toBe('kept')
  })

  it('offline: reports failed, keeps the note, and the next sync delivers it', async () => {
    const account = fakeAccount()
    saveReviewNote(USER, { periodKey: WEEK, kind: 'weekly', answers: { friction: 'typed offline' }, priorities: [] }, at(8))
    account.writeError = { message: 'TypeError: Failed to fetch' }
    account.readError = { message: 'TypeError: Failed to fetch' }
    expect(await pushReviewNote(USER, WEEK)).toBe('failed')
    expect(await syncReviewNotes(USER)).toEqual({ status: 'failed', changed: false })
    expect(isSyncUnavailable()).toBe(false)
    expect(loadReviewNote(USER, WEEK)?.answers.friction).toBe('typed offline')

    account.writeError = null
    account.readError = null
    expect(await syncReviewNotes(USER)).toEqual({ status: 'synced', changed: false })
    expect(account.rows).toHaveLength(1)
  })

  it('a pending delete survives a failed push and is delivered later', async () => {
    const account = fakeAccount()
    saveReviewNote(USER, { periodKey: WEEK, kind: 'weekly', answers: { friction: 'x' }, priorities: [] }, at(8))
    await syncReviewNotes(USER)
    deleteReviewNote(USER, WEEK, at(9))
    account.writeError = { message: 'Failed to fetch' }
    expect(await pushReviewNote(USER, WEEK)).toBe('failed')
    expect(loadReviewTombstones(USER)).toEqual({ [WEEK]: at(9).toISOString() })
    account.writeError = null
    expect((await syncReviewNotes(USER)).status).toBe('synced')
    expect(account.rows[0].value).toBeNull()
    expect(loadReviewTombstones(USER)).toEqual({})
  })
})

describe("today's focus across two devices", () => {
  const morning = new Date(2026, 10, 10, 8, 0)
  const later = new Date(2026, 10, 10, 9, 0)
  const tomorrow = new Date(2026, 10, 11, 7, 0)

  it('focus picked on the phone shows on the laptop the same day', async () => {
    const account = fakeAccount()
    on(phone)
    expect(toggleFocusId(USER, 'item-1', morning)).toEqual(['item-1'])
    expect(await pushFocus(USER, morning)).toBe('synced')
    expect(account.rows[0]).toMatchObject({ scope: 'focus', key: FOCUS_SYNC_KEY })

    on(laptop)
    expect(await syncFocus(USER, later)).toEqual({ status: 'synced', ids: ['item-1'] })
    expect(loadFocusIds(USER, later)).toEqual(['item-1'])
    // Nothing changed since: no ids to apply.
    expect(await syncFocus(USER, later)).toEqual({ status: 'synced', ids: null })
  })

  it('the later change wins, including removing the last focus item', async () => {
    fakeAccount()
    on(phone)
    toggleFocusId(USER, 'item-1', morning)
    await pushFocus(USER, morning)
    on(laptop)
    await syncFocus(USER, morning)
    toggleFocusId(USER, 'item-1', later) // removed on the laptop
    await pushFocus(USER, later)

    on(phone)
    expect(await syncFocus(USER, later)).toEqual({ status: 'synced', ids: [] })
    expect(loadFocusIds(USER, later)).toEqual([])
  })

  it("yesterday's focus on the account does not come back today", async () => {
    fakeAccount()
    on(phone)
    toggleFocusId(USER, 'item-1', morning)
    await pushFocus(USER, morning)
    on(laptop)
    expect(await syncFocus(USER, tomorrow)).toEqual({ status: 'synced', ids: null })
    expect(loadFocusIds(USER, tomorrow)).toEqual([])
  })

  it('a focus saved before sync existed (no time stamp) is sent, and then keeps its time', async () => {
    const account = fakeAccount()
    saveFocusState(USER, { date: '2026-11-10', ids: ['item-9'], updatedAt: null })
    expect(await syncFocus(USER, morning)).toEqual({ status: 'synced', ids: null })
    expect(account.rows).toHaveLength(1)
    expect(loadFocusState(USER, morning)?.updatedAt).toBe(morning.toISOString())
  })

  it('unreadable focus on the account is ignored', async () => {
    const account = fakeAccount()
    account.rows.push({ user_id: USER, scope: 'focus', key: FOCUS_SYNC_KEY, value: { date: 'today', ids: 'all' }, updated_at: later.toISOString() })
    toggleFocusId(USER, 'item-1', morning)
    expect(await syncFocus(USER, later)).toMatchObject({ status: 'synced', ids: null })
    expect(loadFocusIds(USER, later)).toEqual(['item-1'])
  })
})

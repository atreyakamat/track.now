import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_ANSWER_LENGTH,
  deleteReviewNote,
  getReviewNotesKey,
  listSavedReviewPeriods,
  loadReviewNote,
  loadReviewNotes,
  saveReviewNote,
} from '@/services/reviewNotesStorage'

/** In-memory localStorage shim (tests run in a node environment). */
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

let storage: ReturnType<typeof createStorage>
const NOW = new Date(2026, 9, 14, 10)

beforeEach(() => {
  storage = createStorage()
  vi.stubGlobal('localStorage', storage)
})

describe('reviewNotesStorage', () => {
  it('round-trips a weekly note under a user-namespaced key', () => {
    const ok = saveReviewNote(
      'user-a',
      { periodKey: 'weekly:2026-10-12', kind: 'weekly', answers: { friction: 'Late nights' }, priorities: ['Ship v1'] },
      NOW,
    )
    expect(ok).toBe(true)
    expect(storage.getItem(getReviewNotesKey('user-a'))).not.toBeNull()
    expect(getReviewNotesKey('user-a')).toBe('tracknow_reviews_user-a')
    expect(loadReviewNote('user-a', 'weekly:2026-10-12')).toEqual({
      periodKey: 'weekly:2026-10-12',
      kind: 'weekly',
      answers: { friction: 'Late nights' },
      priorities: ['Ship v1'],
      updatedAt: NOW.toISOString(),
    })
  })

  it('isolates users: one user never sees another user’s notes', () => {
    saveReviewNote('user-a', { periodKey: 'monthly:2026-10', kind: 'monthly', answers: { progress: 'A' }, priorities: [] }, NOW)
    saveReviewNote('user-b', { periodKey: 'monthly:2026-10', kind: 'monthly', answers: { progress: 'B' }, priorities: [] }, NOW)
    expect(loadReviewNote('user-a', 'monthly:2026-10')?.answers.progress).toBe('A')
    expect(loadReviewNote('user-b', 'monthly:2026-10')?.answers.progress).toBe('B')
    deleteReviewNote('user-a', 'monthly:2026-10')
    expect(loadReviewNote('user-a', 'monthly:2026-10')).toBeNull()
    expect(loadReviewNote('user-b', 'monthly:2026-10')?.answers.progress).toBe('B')
    expect(loadReviewNotes('')).toEqual({})
  })

  it('treats corrupted JSON and non-object payloads as empty', () => {
    storage.setItem(getReviewNotesKey('u'), '{not json')
    expect(loadReviewNotes('u')).toEqual({})
    storage.setItem(getReviewNotesKey('u'), JSON.stringify([1, 2, 3]))
    expect(loadReviewNotes('u')).toEqual({})
    storage.setItem(getReviewNotesKey('u'), '42')
    expect(loadReviewNotes('u')).toEqual({})
    storage.setItem(getReviewNotesKey('u'), 'null')
    expect(loadReviewNotes('u')).toEqual({})
  })

  it('drops malformed entries and caps string lengths', () => {
    const valid = { periodKey: 'weekly:2026-10-05', kind: 'weekly', answers: { a: 'x'.repeat(5000), 'bad key!': 'no', n: 5 }, priorities: ['1', '2', '3', '4', 7], updatedAt: NOW.toISOString() }
    storage.setItem(
      getReviewNotesKey('u'),
      JSON.stringify({
        'weekly:2026-10-05': valid,
        'weekly:2026-10-12': { ...valid, periodKey: 'weekly:2026-10-12', kind: 'monthly' }, // kind mismatch
        'weekly:2026-09-28': { ...valid }, // key does not match periodKey
        'monthly:2026-09': { periodKey: 'monthly:2026-09', kind: 'monthly', answers: {}, priorities: [], updatedAt: 'not a date' },
        'monthly:2026-08': 'garbage',
      }),
    )
    const notes = loadReviewNotes('u')
    expect(Object.keys(notes)).toEqual(['weekly:2026-10-05'])
    const note = notes['weekly:2026-10-05']
    expect(note.answers.a).toHaveLength(MAX_ANSWER_LENGTH)
    expect(Object.keys(note.answers)).toEqual(['a'])
    expect(note.priorities).toEqual(['1', '2', '3'])
  })

  it('rejects invalid period keys and reports quota failures', () => {
    expect(saveReviewNote('u', { periodKey: 'weekly:2026-10', kind: 'weekly', answers: {}, priorities: [] }, NOW)).toBe(false)
    expect(saveReviewNote('u', { periodKey: 'monthly:2026-10', kind: 'weekly', answers: {}, priorities: [] }, NOW)).toBe(false)
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(saveReviewNote('u', { periodKey: 'weekly:2026-10-12', kind: 'weekly', answers: { a: 'b' }, priorities: [] }, NOW)).toBe(false)
  })

  it('lists saved periods, most recent first, optionally by kind', () => {
    saveReviewNote('u', { periodKey: 'weekly:2026-10-05', kind: 'weekly', answers: {}, priorities: [] }, NOW)
    saveReviewNote('u', { periodKey: 'weekly:2026-10-12', kind: 'weekly', answers: {}, priorities: [] }, NOW)
    saveReviewNote('u', { periodKey: 'monthly:2026-09', kind: 'monthly', answers: {}, priorities: [] }, NOW)
    expect(listSavedReviewPeriods('u', 'weekly')).toEqual(['weekly:2026-10-12', 'weekly:2026-10-05'])
    expect(listSavedReviewPeriods('u', 'monthly')).toEqual(['monthly:2026-09'])
    expect(listSavedReviewPeriods('u')).toHaveLength(3)
  })
})

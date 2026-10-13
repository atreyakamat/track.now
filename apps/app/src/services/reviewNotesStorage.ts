/**
 * Device-local, user-namespaced storage for review notes (weekly reviews and monthly
 * reflections). Notes live only in this browser's localStorage — they are NOT synced to
 * the user's account or other devices. Only the user's own notes are stored here.
 */

export type ReviewNoteKind = 'weekly' | 'monthly'

export interface ReviewNote {
  /** `weekly:YYYY-MM-DD` (week start, Monday) or `monthly:YYYY-MM`. */
  periodKey: string
  kind: ReviewNoteKind
  answers: Record<string, string>
  /** Up to three priorities. */
  priorities: string[]
  /** ISO timestamp of the last save. */
  updatedAt: string
}

export interface ReviewNoteInput {
  periodKey: string
  kind: ReviewNoteKind
  answers: Record<string, string>
  priorities: string[]
}

export const REVIEW_NOTES_PREFIX = 'tracknow_reviews_'
export const MAX_ANSWER_LENGTH = 4000
export const MAX_PRIORITY_LENGTH = 300
export const MAX_PRIORITIES = 3
const MAX_ANSWER_KEYS = 20
const MAX_ANSWER_KEY_LENGTH = 64
/** Oldest periods are dropped beyond this many saved reviews. */
export const MAX_SAVED_PERIODS = 260

const WEEKLY_KEY_RE = /^weekly:\d{4}-\d{2}-\d{2}$/
const MONTHLY_KEY_RE = /^monthly:\d{4}-\d{2}$/
const ANSWER_KEY_RE = /^[A-Za-z0-9_-]+$/

export function getReviewNotesKey(userId: string): string {
  return `${REVIEW_NOTES_PREFIX}${userId}`
}

export function isValidPeriodKey(periodKey: unknown, kind?: ReviewNoteKind): periodKey is string {
  if (typeof periodKey !== 'string') return false
  if (kind === 'weekly') return WEEKLY_KEY_RE.test(periodKey)
  if (kind === 'monthly') return MONTHLY_KEY_RE.test(periodKey)
  return WEEKLY_KEY_RE.test(periodKey) || MONTHLY_KEY_RE.test(periodKey)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function sanitizeAnswers(value: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!isPlainObject(value)) return out
  let count = 0
  for (const [key, answer] of Object.entries(value)) {
    if (count >= MAX_ANSWER_KEYS) break
    if (key.length > MAX_ANSWER_KEY_LENGTH || !ANSWER_KEY_RE.test(key) || typeof answer !== 'string') continue
    out[key] = answer.slice(0, MAX_ANSWER_LENGTH)
    count++
  }
  return out
}

function sanitizePriorities(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((p): p is string => typeof p === 'string')
    .slice(0, MAX_PRIORITIES)
    .map((p) => p.slice(0, MAX_PRIORITY_LENGTH))
}

/** Validates one stored entry; returns null when malformed. */
export function sanitizeReviewNote(value: unknown, expectedKey?: string): ReviewNote | null {
  if (!isPlainObject(value)) return null
  const { periodKey, kind, updatedAt } = value
  if (kind !== 'weekly' && kind !== 'monthly') return null
  if (!isValidPeriodKey(periodKey, kind)) return null
  if (expectedKey !== undefined && periodKey !== expectedKey) return null
  if (typeof updatedAt !== 'string' || Number.isNaN(new Date(updatedAt).getTime())) return null
  return {
    periodKey,
    kind,
    answers: sanitizeAnswers(value.answers),
    priorities: sanitizePriorities(value.priorities),
    updatedAt,
  }
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** All saved notes for the user. Corrupted or non-object data yields `{}`; malformed entries are dropped. */
export function loadReviewNotes(userId: string): Record<string, ReviewNote> {
  const storage = getStorage()
  if (!userId || !storage) return {}
  let parsed: unknown
  try {
    const raw = storage.getItem(getReviewNotesKey(userId))
    if (!raw) return {}
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!isPlainObject(parsed)) return {}
  const out: Record<string, ReviewNote> = {}
  for (const [key, entry] of Object.entries(parsed)) {
    const note = sanitizeReviewNote(entry, key)
    if (note) out[key] = note
  }
  return out
}

export function loadReviewNote(userId: string, periodKey: string): ReviewNote | null {
  return loadReviewNotes(userId)[periodKey] ?? null
}

function writeAll(userId: string, notes: Record<string, ReviewNote>): boolean {
  const storage = getStorage()
  if (!storage) return false
  try {
    storage.setItem(getReviewNotesKey(userId), JSON.stringify(notes))
    return true
  } catch {
    // Quota exceeded, storage disabled (private mode), etc.
    return false
  }
}

/** Saves (or replaces) one period's note. Returns false when it could not be persisted. */
export function saveReviewNote(userId: string, input: ReviewNoteInput, now: Date = new Date()): boolean {
  if (!userId || !isValidPeriodKey(input.periodKey, input.kind)) return false
  const note: ReviewNote = {
    periodKey: input.periodKey,
    kind: input.kind,
    answers: sanitizeAnswers(input.answers),
    priorities: sanitizePriorities(input.priorities),
    updatedAt: now.toISOString(),
  }
  const notes = { ...loadReviewNotes(userId), [note.periodKey]: note }
  const keys = Object.keys(notes)
  if (keys.length > MAX_SAVED_PERIODS) {
    keys
      .filter((k) => k !== note.periodKey)
      .sort((a, b) => notes[a].updatedAt.localeCompare(notes[b].updatedAt))
      .slice(0, keys.length - MAX_SAVED_PERIODS)
      .forEach((k) => delete notes[k])
  }
  return writeAll(userId, notes)
}

/** Removes one period's note. Returns false when storage could not be updated. */
export function deleteReviewNote(userId: string, periodKey: string): boolean {
  if (!userId) return false
  const notes = loadReviewNotes(userId)
  if (!(periodKey in notes)) return true
  delete notes[periodKey]
  return writeAll(userId, notes)
}

/** Saved period keys, most recent period first (optionally filtered by kind). */
export function listSavedReviewPeriods(userId: string, kind?: ReviewNoteKind): string[] {
  return Object.values(loadReviewNotes(userId))
    .filter((n) => !kind || n.kind === kind)
    .map((n) => n.periodKey)
    .sort((a, b) => b.localeCompare(a))
}

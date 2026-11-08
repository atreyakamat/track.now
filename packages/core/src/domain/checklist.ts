import type { ChecklistEntry } from '../types/domain'

export const MAX_CHECKLIST_ENTRIES = 50
export const MAX_CHECKLIST_LABEL = 200

let seq = 0
/** Short, collision-resistant id for a new checklist step (unique within one checklist). */
export function newChecklistEntryId(now = Date.now()): string {
  seq = (seq + 1) % 1_000_000
  return `${now.toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Cleans checklist steps before they are stored: trims labels, drops blanks, removes duplicate
 * ids, caps the count and label length. Returns null for "no steps".
 */
export function normalizeChecklistEntries(entries: readonly unknown[] | null | undefined): ChecklistEntry[] | null {
  if (!Array.isArray(entries)) return null
  const seen = new Set<string>()
  const out: ChecklistEntry[] = []
  for (const raw of entries) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Partial<ChecklistEntry>
    const label = typeof e.label === 'string' ? e.label.trim().slice(0, MAX_CHECKLIST_LABEL) : ''
    if (!label) continue
    let id = typeof e.id === 'string' && e.id.trim() ? e.id.trim().slice(0, 40) : newChecklistEntryId()
    while (seen.has(id)) id = newChecklistEntryId()
    seen.add(id)
    out.push({ id, label, done: e.done === true })
    if (out.length >= MAX_CHECKLIST_ENTRIES) break
  }
  return out.length ? out : null
}

export interface ChecklistProgress {
  done: number
  total: number
  percent: number
}

export function checklistProgress(entries: readonly ChecklistEntry[] | null | undefined): ChecklistProgress {
  const list = entries ?? []
  const done = list.filter((e) => e.done).length
  return { done, total: list.length, percent: list.length ? Math.round((done / list.length) * 100) : 0 }
}

/** Returns a copy with one step toggled. */
export function toggleChecklistEntry(entries: readonly ChecklistEntry[], id: string): ChecklistEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, done: !e.done } : e))
}

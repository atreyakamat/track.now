import type { ChecklistEntry, ExecutionItem, ItemStatus } from '../types/domain'
import { getTodayDateString } from '../domain/dates'
import { effectiveHabitSteps, toggleChecklistEntry } from '../domain/checklist'
import { isHabitCountStale, supportsCountDate } from '../domain/habitCounter'
import {
  setChecklistEntries,
  setItemDone,
  stepItemCount,
  toggleHabitStep,
  updateItemProgress,
} from './executionService'

/**
 * Optimistic item actions.
 *
 * A tap is turned into (1) a prediction of the item right after the action, which the UI shows
 * at once, and (2) a commit that persists the same change. The prediction mirrors the rules in
 * executionService / the counter RPC, so the server's answer normally equals what is already on
 * screen. Commits state the wanted END state where possible ("done", "count = 3") instead of
 * "toggle", so a write that arrives late or twice cannot invert the user's intent.
 */
export type ItemIntent =
  | { kind: 'toggle' }
  | { kind: 'step'; delta: number }
  | { kind: 'setCount'; count: number }
  | { kind: 'checklist'; entryId: string }

export interface ItemActionPlan {
  /** The item as it should look immediately. */
  item: ExecutionItem
  /** Whether the item counts as completed today after the action. */
  doneToday: boolean
  /** Persists the action; resolves with the stored row. */
  commit: () => Promise<ExecutionItem>
  /** "Completed today" according to the stored row (used to correct a wrong prediction). */
  doneTodayFromServer: (stored: ExecutionItem) => boolean
}

const targetOf = (item: Pick<ExecutionItem, 'target_count'>) => Math.max(1, item.target_count ?? 1)

/** Fields every count write also sets, so the prediction matches the stored row. */
function touched(item: ExecutionItem, today: string, now: Date): Partial<ExecutionItem> {
  return {
    updated_at: now.toISOString(),
    ...(supportsCountDate(item) && item.type === 'habit' ? { count_date: today } : {}),
  }
}

function withCount(item: ExecutionItem, count: number, today: string, now: Date): ExecutionItem {
  const status: ItemStatus = count >= targetOf(item) ? 'done' : 'todo'
  return { ...item, current_count: count, status, ...touched(item, today, now) }
}

const countReached = (stored: ExecutionItem) => (stored.current_count ?? 0) >= targetOf(stored)

/**
 * Plans one action on `item`. Returns null when the action changes nothing (for example a
 * step of 0, or a checklist entry that does not exist).
 */
export function planItemAction(
  item: ExecutionItem,
  intent: ItemIntent,
  wasDoneToday: boolean,
  userId: string,
  now = new Date(),
): ItemActionPlan | null {
  const today = getTodayDateString(now)
  const target = targetOf(item)
  const isHabit = item.type === 'habit'

  if (intent.kind === 'toggle') {
    if (isHabit) {
      const done = !wasDoneToday
      return {
        item: withCount(item, done ? target : 0, today, now),
        doneToday: done,
        commit: () => updateItemProgress(item.id, done ? target : 0, userId, today),
        doneTodayFromServer: () => done,
      }
    }
    const done = item.status !== 'done'
    const count = done ? Math.max(target, item.current_count ?? 0) : 0
    return {
      item: { ...item, status: done ? 'done' : 'todo', current_count: count, ...touched(item, today, now) },
      doneToday: done,
      commit: () => setItemDone(item.id, done, userId, today),
      doneTodayFromServer: (stored) => stored.status === 'done',
    }
  }

  if (intent.kind === 'step' || intent.kind === 'setCount') {
    let next: number
    let commit: () => Promise<ExecutionItem>
    if (intent.kind === 'step') {
      if (!Number.isInteger(intent.delta) || intent.delta === 0) return null
      const reset = isHabit ? isHabitCountStale(item, wasDoneToday, now) : false
      const base = reset ? 0 : Math.max(0, item.current_count ?? 0)
      next = Math.max(0, base + intent.delta)
      if (next === base && !reset) return null // already at zero
      const delta = intent.delta
      commit = () => stepItemCount(item.id, delta, userId, today, reset)
    } else {
      next = Math.max(0, Math.floor(intent.count))
      commit = () => updateItemProgress(item.id, next, userId, today)
    }
    const predicted = withCount(item, next, today, now)
    return {
      item: predicted,
      doneToday: isHabit ? next >= target : predicted.status === 'done',
      commit,
      doneTodayFromServer: (stored) => (isHabit ? countReached(stored) : stored.status === 'done'),
    }
  }

  // A checklist step.
  if (isHabit) {
    // A routine: steps are ticked per day; the last tick completes the habit for today.
    const steps = toggleChecklistEntry(effectiveHabitSteps(item, today, wasDoneToday), intent.entryId)
    if (!steps.length) return null
    const doneCount = steps.filter((e) => e.done).length
    const predicted = withCount({ ...item, checklist_entries: steps, target_count: steps.length }, doneCount, today, now)
    return {
      item: predicted,
      doneToday: doneCount >= steps.length,
      commit: () => toggleHabitStep(item.id, intent.entryId, userId, today),
      doneTodayFromServer: countReached,
    }
  }

  const before: ChecklistEntry[] = item.checklist_entries ?? []
  if (!before.some((e) => e.id === intent.entryId)) return null
  const entries = toggleChecklistEntry(before, intent.entryId)
  const wasDone = item.status === 'done'
  const willBeDone = entries.every((e) => e.done)
  const predicted: ExecutionItem = { ...item, checklist_entries: entries, updated_at: now.toISOString() }
  if (willBeDone !== wasDone) {
    predicted.status = willBeDone ? 'done' : 'todo'
    predicted.current_count = willBeDone ? target : 0
  }
  const doneTodayFor = (done: boolean) => (done ? wasDoneToday || !wasDone : false)
  return {
    item: predicted,
    doneToday: doneTodayFor(willBeDone),
    commit: () => setChecklistEntries(item.id, entries, userId, today),
    doneTodayFromServer: (stored) => doneTodayFor(stored.status === 'done'),
  }
}

import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { ExecutionItem, UpdateExecutionItemInput } from '@/types/domain'
import {
  deleteExecutionItem,
  editExecutionItem,
  shouldResetHabitCount,
  stepItemCount,
  toggleItemStatus,
  updateItemProgress,
} from '@/services/executionService'
import {
  settleRemindersAfterCompletion,
  cancelReminderForItem,
  getReminderForItem,
  snoozeReminder,
} from '@/services/reminderService'
import { loadNotificationPreferences } from '@/services/notificationPreferences'
import { calcHabitStreak, type HabitStreakSummary } from '@/domain/streaks'
import { getTodayDateString } from '@/domain/dates'
import { effectiveCurrentCount } from '@/domain/habitCounter'
import { useToast } from '@/features/notifications/ToastContext'

interface Options {
  userId: string | undefined
  items: ExecutionItem[]
  setItems: Dispatch<SetStateAction<ExecutionItem[]>>
  /** Reloads authoritative state from the server (called after a failed mutation). */
  reload: () => Promise<void>
  /** Optional hook after any successful change (e.g. refresh the widget snapshot). */
  onChanged?: (state: { items: ExecutionItem[]; completedTodayIds: string[] }) => void
}

/** Local calendar day of an ISO timestamp (null when missing/invalid). */
const localDay = (iso?: string) => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? getTodayDateString(d) : null
}

/**
 * Whether an item counts as "completed today" after an edit. An edit that does not touch
 * progress (rename, description, priority…) leaves it exactly as it was: a habit's stored
 * count may belong to an earlier day and must not mark it done today.
 */
export function doneTodayAfterEdit(
  input: UpdateExecutionItemInput,
  before: Pick<ExecutionItem, 'type'> | undefined,
  updated: ExecutionItem,
  wasDoneToday: boolean,
): boolean {
  const touchesProgress =
    input.current_count !== undefined ||
    input.target_count !== undefined ||
    (input.type !== undefined && input.type !== before?.type)
  if (!touchesProgress) return wasDoneToday
  if (updated.type === 'habit') {
    return effectiveCurrentCount(updated, wasDoneToday) >= Math.max(1, updated.target_count ?? 1)
  }
  return updated.status === 'done'
}

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

/**
 * Shared completion / count / edit / delete / reminder actions for item lists.
 *
 * - Per-item busy tracking (acting on one item never blocks or races another).
 * - Functional state updates (no stale closures between concurrent actions).
 * - Every failure is shown to the user and the list is re-synced from the server, so the
 *   UI never keeps an optimistic state that was not persisted.
 * - Habits are completed per day via the completion log; streaks are recomputed locally.
 */
export function useExecutionItemActions({ userId, items, setItems, reload, onChanged }: Options) {
  const { showToast } = useToast()
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set())
  const busyRef = useRef(new Set<string>())
  const [completedTodayIds, setCompletedTodayIds] = useState<ReadonlySet<string>>(new Set())
  const [completionDates, setCompletionDates] = useState<Record<string, string[]>>({})
  const itemsRef = useRef(items)
  itemsRef.current = items
  // Latest callbacks, so memoized handlers never call a stale reload/onChanged.
  const callbacksRef = useRef({ reload, onChanged })
  callbacksRef.current = { reload, onChanged }
  const completedRef = useRef(completedTodayIds)
  completedRef.current = completedTodayIds

  /** Replace completion context after a (re)load. */
  const setCompletionState = useCallback((todayIds: string[], datesByItem: Record<string, string[]>) => {
    setCompletedTodayIds(new Set(todayIds))
    setCompletionDates(datesByItem)
  }, [])

  const streakSummaries = useMemo(() => {
    const result: Record<string, HabitStreakSummary> = {}
    items
      .filter((i) => i.type === 'habit')
      .forEach((h) => {
        result[h.id] = calcHabitStreak(h.id, h.schedule, completionDates[h.id] || [], undefined, undefined, localDay(h.created_at))
      })
    return result
  }, [items, completionDates])

  const isCompletedToday = useCallback(
    (item: ExecutionItem) => completedTodayIds.has(item.id),
    [completedTodayIds],
  )

  const beginBusy = (id: string) => {
    if (busyRef.current.has(id)) return false
    busyRef.current.add(id)
    setBusyIds(new Set(busyRef.current))
    return true
  }
  const endBusy = (id: string) => {
    busyRef.current.delete(id)
    setBusyIds(new Set(busyRef.current))
  }

  /** Applies a persisted item + its "completed today" state to local state. */
  const applyResult = (updated: ExecutionItem, doneToday: boolean, wasDoneToday: boolean) => {
    const today = getTodayDateString()
    const nextItems = itemsRef.current.map((it) => (it.id === updated.id ? updated : it))
    const nextCompleted = new Set(completedRef.current)
    if (doneToday) nextCompleted.add(updated.id)
    else nextCompleted.delete(updated.id)

    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
    setCompletedTodayIds(nextCompleted)
    if (doneToday !== wasDoneToday) {
      setCompletionDates((prev) => {
        const dates = new Set(prev[updated.id] || [])
        if (doneToday) dates.add(today)
        else if (updated.type === 'habit') dates.delete(today)
        else dates.clear()
        return { ...prev, [updated.id]: Array.from(dates).sort() }
      })
    }
    callbacksRef.current.onChanged?.({ items: nextItems, completedTodayIds: Array.from(nextCompleted) })
    return { nextItems, nextCompleted }
  }

  const completionFeedback = (item: ExecutionItem, nextItems: ExecutionItem[], nextCompleted: ReadonlySet<string>) => {
    if (!userId) return
    // Habits repeat: move their reminder to the next scheduled day. One-off items: cancel.
    settleRemindersAfterCompletion(userId, item)

    const prefs = loadNotificationPreferences(userId)
    if (prefs.masterEnabled && prefs.completionAcknowledgement) {
      const nextItem = nextItems.find(
        (it) => it.id !== item.id && it.status !== 'archived' && !nextCompleted.has(it.id) && it.status !== 'done',
      )
      showToast({
        id: `completion-${item.id}`,
        title: `Completed: ${item.name}`,
        message: item.type === 'habit' ? 'Logged for today.' : 'Nice work.',
        nextUp: nextItem?.name,
        type: 'success',
      })
    }
  }

  const fail = async (title: string, err: unknown) => {
    showToast({ title, message: errorMessage(err, 'Please try again.'), type: 'warning', duration: 8000 })
    try {
      await callbacksRef.current.reload()
    } catch {
      /* the page shows its own load error */
    }
  }

  const toggle = useCallback(
    async (item: ExecutionItem) => {
      if (!userId || !beginBusy(item.id)) return
      const wasDoneToday = completedRef.current.has(item.id)
      try {
        let updated: ExecutionItem
        let doneToday: boolean
        if (item.type === 'habit') {
          const target = Math.max(1, item.target_count ?? 1)
          updated = await updateItemProgress(item.id, wasDoneToday ? 0 : target, userId)
          doneToday = !wasDoneToday
        } else {
          updated = await toggleItemStatus(item.id, item.status, userId)
          doneToday = updated.status === 'done'
        }
        const { nextItems, nextCompleted } = applyResult(updated, doneToday, wasDoneToday)
        if (doneToday && !wasDoneToday) completionFeedback(updated, nextItems, nextCompleted)
      } catch (err) {
        await fail(`Could not update “${item.name}”`, err)
      } finally {
        endBusy(item.id)
      }
    },
    [userId],
  )

  const step = useCallback(
    async (item: ExecutionItem, delta: number) => {
      if (!userId || !beginBusy(item.id)) return
      const wasDoneToday = completedRef.current.has(item.id)
      try {
        const reset = item.type === 'habit' ? shouldResetHabitCount(item, wasDoneToday) : false
        const updated = await stepItemCount(item.id, delta, userId, undefined, reset)
        const doneToday =
          item.type === 'habit'
            ? (updated.current_count ?? 0) >= Math.max(1, updated.target_count ?? 1)
            : updated.status === 'done'
        const { nextItems, nextCompleted } = applyResult(updated, doneToday, wasDoneToday)
        if (doneToday && !wasDoneToday) completionFeedback(updated, nextItems, nextCompleted)
      } catch (err) {
        await fail(`Could not update the count for “${item.name}”`, err)
      } finally {
        endBusy(item.id)
      }
    },
    [userId],
  )

  const setCount = useCallback(
    async (item: ExecutionItem, count: number) => {
      if (!userId || !beginBusy(item.id)) return
      const wasDoneToday = completedRef.current.has(item.id)
      try {
        const updated = await updateItemProgress(item.id, Math.max(0, count), userId)
        const doneToday =
          item.type === 'habit'
            ? (updated.current_count ?? 0) >= Math.max(1, updated.target_count ?? 1)
            : updated.status === 'done'
        const { nextItems, nextCompleted } = applyResult(updated, doneToday, wasDoneToday)
        if (doneToday && !wasDoneToday) completionFeedback(updated, nextItems, nextCompleted)
      } catch (err) {
        await fail(`Could not update the count for “${item.name}”`, err)
      } finally {
        endBusy(item.id)
      }
    },
    [userId],
  )

  /** Throws so the edit dialog can show the error inline (and stay open). */
  const saveEdit = useCallback(
    async (itemId: string, input: UpdateExecutionItemInput) => {
      if (!userId) throw new Error('You are signed out.')
      const wasDoneToday = completedRef.current.has(itemId)
      try {
        const before = itemsRef.current.find((it) => it.id === itemId)
        const updated = await editExecutionItem(itemId, input, userId)
        const doneToday = doneTodayAfterEdit(input, before, updated, wasDoneToday)
        applyResult(updated, doneToday, wasDoneToday)
      } catch (err) {
        // The service may have saved part of the change (e.g. fields saved, schedule not):
        // re-sync so the list reflects what is really stored.
        callbacksRef.current.reload().catch(() => undefined)
        throw err
      }
    },
    [userId],
  )

  const remove = useCallback(
    async (item: ExecutionItem): Promise<boolean> => {
      if (!userId || !beginBusy(item.id)) return false
      try {
        await deleteExecutionItem(item.id)
        cancelReminderForItem(userId, item.id)
        const nextItems = itemsRef.current.filter((it) => it.id !== item.id)
        setItems((prev) => prev.filter((it) => it.id !== item.id))
        const nextCompleted = new Set(completedRef.current)
        nextCompleted.delete(item.id)
        setCompletedTodayIds(nextCompleted)
        callbacksRef.current.onChanged?.({ items: nextItems, completedTodayIds: Array.from(nextCompleted) })
        showToast({ title: 'Item deleted', message: `“${item.name}” and its history were removed.`, type: 'info' })
        return true
      } catch (err) {
        await fail(`Could not delete “${item.name}”`, err)
        return false
      } finally {
        endBusy(item.id)
      }
    },
    [userId],
  )

  const snooze = useCallback(
    (itemId: string, minutes = 10) => {
      if (!userId) return
      const reminder = getReminderForItem(userId, itemId)
      if (!reminder) return
      const snoozed = snoozeReminder(userId, reminder.id, minutes)
      showToast({
        id: `snooze-${itemId}`,
        title: snoozed ? 'Reminder snoozed' : 'Could not snooze',
        message: snoozed
          ? `Next reminder at ${new Date(snoozed.remindAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
          : 'The reminder no longer exists.',
        type: snoozed ? 'info' : 'warning',
      })
    },
    [userId, showToast],
  )

  const removeReminder = useCallback(
    (itemId: string) => {
      if (!userId) return
      cancelReminderForItem(userId, itemId)
      showToast({ id: `remove-rem-${itemId}`, title: 'Reminder removed', type: 'info' })
    },
    [userId, showToast],
  )

  return {
    busyIds,
    completedTodayIds,
    completionDates,
    streakSummaries,
    isCompletedToday,
    setCompletionState,
    toggle,
    step,
    setCount,
    saveEdit,
    remove,
    snooze,
    removeReminder,
  }
}

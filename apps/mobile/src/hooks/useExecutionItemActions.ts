import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import * as Haptics from 'expo-haptics'
import type { ExecutionItem, UpdateExecutionItemInput } from '@tracknow/core/types/domain'
import { deleteExecutionItem, editExecutionItem } from '@tracknow/core/services/executionService'
import { planItemAction, sameShownState, type ItemIntent } from '@tracknow/core/services/itemIntents'
import { createKeyedQueue } from '@tracknow/core/utils/keyedQueue'
import {
  settleRemindersAfterCompletion,
  cancelReminderForItem,
  getReminderForItem,
  snoozeReminder,
} from '@tracknow/core/services/reminderService'
import { loadNotificationPreferences } from '@tracknow/core/services/notificationPreferences'
import { calcHabitStreak, type HabitStreakSummary } from '@tracknow/core/domain/streaks'
import { habitTrackedSince } from '@tracknow/core/domain/schedule'
import { XP_PER_TYPE } from '@tracknow/core/domain/momentum'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { doneTodayAfterEdit } from '@tracknow/core/domain/itemEdit'
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

/** How long a just-(un)completed item keeps its place before it moves to its new section. */
export const HOLD_MS = 700

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

/**
 * Shared completion / count / checklist / edit / delete / reminder actions for item lists.
 *
 * - Instant feedback: a tick, count change or checklist step shows on screen at once. The
 *   write is saved in the background, in tap order per item, so no tap is ever dropped.
 * - If a save fails, the user is told and the list is re-synced from the server, so the UI
 *   never keeps a state that was not persisted.
 * - A just-completed item stays where it is for a moment (`grouping*`), so the tick is seen
 *   before the item moves to another section.
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
  const callbacksRef = useRef({ reload, onChanged })
  callbacksRef.current = { reload, onChanged }
  const completedRef = useRef(completedTodayIds)
  completedRef.current = completedTodayIds

  // Background saves, one at a time per item.
  const queueRef = useRef(createKeyedQueue())
  /** Bumped on every optimistic change; lets a page detect a snapshot fetched before it. */
  const versionRef = useRef(0)
  const resyncWantedRef = useRef(false)
  const failedRef = useRef(new Set<string>())
  const aliveRef = useRef(true)

  // Items whose done-state just changed keep their previous place for HOLD_MS.
  const heldRef = useRef(new Map<string, { item: ExecutionItem; done: boolean; timer: ReturnType<typeof setTimeout> }>())
  const [held, setHeld] = useState<ReadonlyMap<string, { item: ExecutionItem; done: boolean }>>(new Map())
  const publishHeld = () => {
    const next = new Map<string, { item: ExecutionItem; done: boolean }>()
    heldRef.current.forEach((v, k) => next.set(k, { item: v.item, done: v.done }))
    setHeld(next)
  }
  const hold = (before: ExecutionItem, wasDone: boolean) => {
    const existing = heldRef.current.get(before.id)
    if (existing) clearTimeout(existing.timer)
    const timer = setTimeout(() => {
      heldRef.current.delete(before.id)
      if (aliveRef.current) publishHeld()
    }, HOLD_MS)
    // Keep the FIRST snapshot: tick then un-tick within the hold ends where it started.
    heldRef.current.set(before.id, { item: existing?.item ?? before, done: existing?.done ?? wasDone, timer })
    publishHeld()
  }

  useEffect(() => {
    aliveRef.current = true
    const heldNow = heldRef.current
    return () => {
      aliveRef.current = false
      heldNow.forEach((v) => clearTimeout(v.timer))
      heldNow.clear()
    }
  }, [])

  /** Items / completed ids to GROUP by (sections); render each card from the live item. */
  const groupingItems = useMemo(
    () => (held.size ? items.map((it) => held.get(it.id)?.item ?? it) : items),
    [items, held],
  )
  const groupingCompletedIds = useMemo(() => {
    if (!held.size) return completedTodayIds
    const next = new Set(completedTodayIds)
    held.forEach((v, id) => (v.done ? next.add(id) : next.delete(id)))
    return next as ReadonlySet<string>
  }, [completedTodayIds, held])

  /**
   * Call before fetching a fresh server snapshot; pass the result to `acceptSnapshot` before
   * applying it. A snapshot fetched while taps were being saved is stale: it is refused and a
   * re-sync is run as soon as the saves finish (otherwise a tick would flicker off and on).
   */
  const snapshotToken = useCallback(() => versionRef.current, [])
  const acceptSnapshot = useCallback((token: number) => {
    if (token === versionRef.current && queueRef.current.totalPending() === 0) return true
    resyncWantedRef.current = true
    return false
  }, [])

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
        result[h.id] = calcHabitStreak(h.id, h.schedule, completionDates[h.id] || [], undefined, undefined, habitTrackedSince(h))
      })
    return result
  }, [items, completionDates])

  const isCompletedToday = useCallback((item: ExecutionItem) => completedTodayIds.has(item.id), [completedTodayIds])

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

    // Refs first: a second tap before the next render must see this change.
    itemsRef.current = nextItems
    completedRef.current = nextCompleted
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

  /** Shown the moment the user completes something (before the save returns). */
  const completionFeedback = (item: ExecutionItem, nextItems: ExecutionItem[], nextCompleted: ReadonlySet<string>) => {
    if (!userId) return
    // A little tactile reward on every new completion (no-op where haptics are unavailable).
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
    const prefs = loadNotificationPreferences(userId)
    if (prefs.masterEnabled && prefs.completionAcknowledgement) {
      const nextItem = nextItems.find(
        (it) => it.id !== item.id && it.status !== 'archived' && !nextCompleted.has(it.id) && it.status !== 'done',
      )
      // Subtle XP feedback: the same points Insights derives from this completion.
      const xp = `+${XP_PER_TYPE[item.type]} XP`
      showToast({
        id: `completion-${item.id}`,
        title: item.type === 'milestone' ? `Milestone achieved: ${item.name}` : `Completed: ${item.name}`,
        message: item.type === 'habit' ? `Logged for today · ${xp}` : `Nice work · ${xp}`,
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
      /* the screen shows its own load error */
    }
  }

  /** Runs once nothing is being saved: re-syncs if a save failed or a snapshot was refused. */
  const afterIdle = () => {
    if (queueRef.current.totalPending() > 0 || !aliveRef.current) return
    if (!resyncWantedRef.current && failedRef.current.size === 0) return
    resyncWantedRef.current = false
    failedRef.current.clear()
    callbacksRef.current.reload().catch(() => undefined)
  }

  /**
   * Applies an action to the screen immediately, then saves it in the background.
   * `given` may come from a stale closure; the latest copy of the item is always used.
   */
  const act = useCallback(
    (given: ExecutionItem, intent: ItemIntent, failTitle: string) => {
      if (!userId) return
      const item = itemsRef.current.find((it) => it.id === given.id) ?? given
      const wasDoneToday = completedRef.current.has(item.id)
      const plan = planItemAction(item, intent, wasDoneToday, userId)
      if (!plan) return

      versionRef.current += 1
      if (plan.doneToday !== wasDoneToday || plan.item.status !== item.status) hold(item, wasDoneToday)
      const { nextItems, nextCompleted } = applyResult(plan.item, plan.doneToday, wasDoneToday)
      if (plan.doneToday && !wasDoneToday) completionFeedback(plan.item, nextItems, nextCompleted)
      else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)

      const queue = queueRef.current
      queue
        .enqueue(item.id, plan.commit)
        .then((stored) => {
          if (!aliveRef.current) return
          // Habits repeat: move their reminder to the next scheduled day. One-off items: cancel.
          const storedDone = plan.doneTodayFromServer(stored)
          if (storedDone && !wasDoneToday) settleRemindersAfterCompletion(userId, stored)
          // Newer taps on this item are still on their way: their prediction is on screen,
          // so this (older) answer must not overwrite it.
          if (queue.pending(item.id) > 0 || failedRef.current.has(item.id)) return
          // The usual case: the server stored exactly what is shown. Nothing to redraw.
          const shown = itemsRef.current.find((it) => it.id === item.id)
          const shownDone = completedRef.current.has(item.id)
          if (shown && shownDone === storedDone && sameShownState(shown, stored)) return
          applyResult(stored, storedDone, shownDone)
        })
        .catch((err: unknown) => {
          if (!aliveRef.current) return
          failedRef.current.add(item.id)
          showToast({
            id: `save-failed-${item.id}`,
            title: failTitle,
            message: errorMessage(err, 'Please try again.'),
            type: 'warning',
            duration: 8000,
          })
        })
        .finally(afterIdle)
    },
    [userId, showToast],
  )

  const toggle = useCallback(
    (item: ExecutionItem) => act(item, { kind: 'toggle' }, `Could not update “${item.name}”`),
    [act],
  )
  const step = useCallback(
    (item: ExecutionItem, delta: number) =>
      act(item, { kind: 'step', delta }, `Could not update the count for “${item.name}”`),
    [act],
  )
  const setCount = useCallback(
    (item: ExecutionItem, count: number) =>
      act(item, { kind: 'setCount', count }, `Could not update the count for “${item.name}”`),
    [act],
  )
  const toggleChecklistEntry = useCallback(
    (item: ExecutionItem, entryId: string) =>
      act(item, { kind: 'checklist', entryId }, `Could not update “${item.name}”`),
    [act],
  )

  /** Throws so the edit screen can show the error inline (and stay open). */
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
    groupingItems,
    groupingCompletedIds,
    snapshotToken,
    acceptSnapshot,
    setCompletionState,
    toggle,
    step,
    setCount,
    toggleChecklistEntry,
    saveEdit,
    remove,
    snooze,
    removeReminder,
  }
}

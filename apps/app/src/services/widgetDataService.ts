import type { ExecutionItem } from '@/types/domain'
import type { WidgetDataPayload, WidgetItemSummary, WidgetTodayProgress } from '@/types/widget'
import { getTodayDateString, isHabitScheduledForToday, isOverdue } from '@/domain/dates'
import type { HabitStreakSummary } from '@/domain/streaks'
import { syncNativeWidgetData, clearNativeWidgetData } from './nativeMobileBridge'

const WIDGET_STORAGE_PREFIX = 'tracknow_widget_data_'

export function getWidgetStorageKey(userId: string): string {
  return `${WIDGET_STORAGE_PREFIX}${userId}`
}

export type WidgetCompletionContext =
  | Record<string, HabitStreakSummary>
  | string[]
  | { completedTodayIds: string[]; streaks?: Record<string, HabitStreakSummary> }

/**
 * Builds a clean, minimal, versioned widget projection of TODAY's queue.
 * Strictly free of passwords, tokens, or sensitive account information.
 *
 * "Today" means: habits scheduled today (or completed today), plus one-off items that are
 * open and due today/overdue/undated, plus one-off items completed today. Items finished
 * on earlier days and future-dated items are not counted, so the percentage is honest.
 */
export async function buildWidgetDataPayload(
  userId: string,
  items: ExecutionItem[],
  context?: WidgetCompletionContext,
  dateStr = getTodayDateString(),
  now = new Date(),
): Promise<WidgetDataPayload> {
  const completed = new Set<string>()
  let streaks: Record<string, HabitStreakSummary> | undefined
  if (Array.isArray(context)) {
    context.forEach((id) => completed.add(id))
  } else if (context && Array.isArray((context as { completedTodayIds?: unknown }).completedTodayIds)) {
    const ctx = context as { completedTodayIds: string[]; streaks?: Record<string, HabitStreakSummary> }
    ctx.completedTodayIds.forEach((id) => completed.add(id))
    streaks = ctx.streaks
  } else if (context) {
    streaks = context as Record<string, HabitStreakSummary>
  }

  let activeStreakDays = 0
  if (streaks) {
    Object.values(streaks).forEach((s) => {
      if (s.isCompletedToday) completed.add(s.itemId)
      if (s.isActiveStreak && s.currentStreak > activeStreakDays) activeStreakDays = s.currentStreak
    })
  }

  // Completion "today" comes from the completion log (track_now_item_completions).
  const isDoneToday = (item: ExecutionItem) => completed.has(item.id)

  const todayItems = items.filter((item) => {
    if (item.status === 'archived') return false
    if (item.type === 'habit') return completed.has(item.id) || isHabitScheduledForToday(item.schedule, now)
    if (completed.has(item.id)) return true
    if (item.status === 'done') return false // finished on an earlier day
    return !item.due_date || item.due_date <= dateStr
  })

  const totalItems = todayItems.length
  const completedCount = todayItems.filter(isDoneToday).length
  const percent = totalItems > 0 ? Math.min(100, Math.round((completedCount / totalItems) * 100)) : 0
  const statusText = totalItems > 0 ? `${completedCount} of ${totalItems} done` : 'No items scheduled'

  const progressSummary: WidgetTodayProgress = {
    date: dateStr,
    total: totalItems,
    totalItems,
    done: completedCount,
    completedItems: completedCount,
    percent,
    activeStreakDays,
    statusText,
  }

  // Map items to lightweight widget summaries
  const summaries: WidgetItemSummary[] = todayItems.map((item) => {
    const isDone = isDoneToday(item)
    const itemOverdue = !isDone && isOverdue(item.due_date, now)

    let timeLabel: string | null = null
    if (item.schedule?.reminder_time) {
      timeLabel = item.schedule.reminder_time.slice(0, 5)
    } else if (item.schedule?.time_of_day && item.schedule.time_of_day !== 'anytime') {
      timeLabel =
        item.schedule.time_of_day.charAt(0).toUpperCase() + item.schedule.time_of_day.slice(1)
    } else if (item.due_date) {
      timeLabel = item.due_date
    }

    return {
      id: item.id,
      name: item.name,
      title: item.name,
      type: item.type,
      priority: item.priority,
      time: timeLabel,
      isDone,
      isOverdue: itemOverdue,
      overdue: itemOverdue,
      planId: item.plan_id,
      trackColor: (item as any).track_color,
    }
  })

  // Incomplete items
  const incompleteItems = summaries.filter((s) => !s.isDone)
  const nextActivity = incompleteItems.length > 0 ? incompleteItems[0] : null
  const upcomingItems = incompleteItems.slice(0, 5)

  const timestampIso = now.toISOString()

  return {
    version: 1,
    userId,
    updatedAt: timestampIso,
    lastUpdated: timestampIso,
    today: progressSummary,
    progress: progressSummary,
    nextActivity,
    upcomingItems,
    items: upcomingItems,
  }
}

/**
 * Persists widget data payload to local storage and syncs with native widget storage if available.
 */
export async function saveWidgetData(payload: WidgetDataPayload): Promise<void> {
  if (!payload?.userId) return

  try {
    const raw = JSON.stringify(payload)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getWidgetStorageKey(payload.userId), raw)
    }
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tracknow:widget-data-updated', { detail: payload }),
      )
    }

    // Sync to native Android/iOS widget storage via bridge
    await syncNativeWidgetData(payload)
  } catch (err) {
    console.error('Failed to save widget data payload:', err)
  }
}

/**
 * Loads the given user's widget data payload from local storage.
 * There is deliberately no "any user" fallback: on a shared device that would expose the
 * previous account's items.
 */
export function loadWidgetData(userId: string): WidgetDataPayload | null {
  if (typeof localStorage === 'undefined' || !userId) return null
  try {
    const raw = localStorage.getItem(getWidgetStorageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as WidgetDataPayload
    return parsed && parsed.userId === userId ? parsed : null
  } catch {
    return null
  }
}

/**
 * Clears cached widget data on logout or account switch.
 */
export async function clearWidgetData(userId?: string): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    if (userId) {
      localStorage.removeItem(getWidgetStorageKey(userId))
    } else {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(WIDGET_STORAGE_PREFIX)) {
          keysToRemove.push(k)
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))
    }
  }
  await clearNativeWidgetData()
}

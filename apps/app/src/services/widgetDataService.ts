import type { ExecutionItem } from '@/types/domain'
import type { WidgetDataPayload, WidgetItemSummary, WidgetTodayProgress } from '@/types/widget'
import { getTodayDateString, isOverdue } from '@/domain/dates'
import type { HabitStreakSummary } from '@/domain/streaks'
import { syncNativeWidgetData, clearNativeWidgetData } from './nativeMobileBridge'

const WIDGET_STORAGE_PREFIX = 'tracknow_widget_data_'

export function getWidgetStorageKey(userId: string): string {
  return `${WIDGET_STORAGE_PREFIX}${userId}`
}

/**
 * Builds a clean, minimal, versioned widget projection from execution items.
 * Strictly free of passwords, tokens, or sensitive account information.
 */
export async function buildWidgetDataPayload(
  userId: string,
  items: ExecutionItem[],
  streaksOrCompleted?: Record<string, HabitStreakSummary> | string[],
  dateStr = getTodayDateString(),
  now = new Date(),
): Promise<WidgetDataPayload> {
  let todayCompletedIds: string[] = []
  let activeStreakDays = 0

  if (Array.isArray(streaksOrCompleted)) {
    todayCompletedIds = streaksOrCompleted
  } else if (streaksOrCompleted && typeof streaksOrCompleted === 'object') {
    Object.values(streaksOrCompleted).forEach((s) => {
      if (s.isCompletedToday) {
        todayCompletedIds.push(s.itemId)
      }
      if (s.isActiveStreak && s.currentStreak > activeStreakDays) {
        activeStreakDays = s.currentStreak
      }
    })
  }

  const totalItems = items.length
  const completedCount = items.filter(
    (item) => todayCompletedIds.includes(item.id) || item.status === 'done',
  ).length

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
  const summaries: WidgetItemSummary[] = items.map((item) => {
    const isDone = todayCompletedIds.includes(item.id) || item.status === 'done'
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
 * Loads the current user's widget data payload from local storage.
 */
export function loadWidgetData(userId?: string): WidgetDataPayload | null {
  if (typeof localStorage === 'undefined') return null

  try {
    if (userId) {
      const raw = localStorage.getItem(getWidgetStorageKey(userId))
      if (!raw) return null
      return JSON.parse(raw) as WidgetDataPayload
    }

    // Fall back to first matching widget key
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(WIDGET_STORAGE_PREFIX)) {
        const raw = localStorage.getItem(k)
        if (raw) return JSON.parse(raw) as WidgetDataPayload
      }
    }
    return null
  } catch (err) {
    console.warn('Failed to load widget data from localStorage:', err)
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

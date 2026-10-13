import type { ExecutionItem } from '@/types/domain'
import { isDueToday, isHabitScheduledForToday, isOverdue, isUpcoming } from './dates'

const PRIORITY_RANK: Record<ExecutionItem['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 }

/** Sort by due date (earliest first, undated last), then priority, then name. */
function byDueThenPriority(a: ExecutionItem, b: ExecutionItem): number {
  // Habits recur on their schedule, so any stored due date is ignored for ordering.
  const da = a.type === 'habit' ? null : a.due_date
  const db = b.type === 'habit' ? null : b.due_date
  if (da !== db) {
    if (!da) return 1
    if (!db) return -1
    return da < db ? -1 : 1
  }
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  return p !== 0 ? p : a.name.localeCompare(b.name)
}

export interface TodayGroups {
  overdue: ExecutionItem[]
  dueToday: ExecutionItem[]
  anytime: ExecutionItem[]
  upcoming: ExecutionItem[]
  completedToday: ExecutionItem[]
}

/**
 * Pure grouping for the Today view.
 * - Habits: "Due Today" when scheduled today, "Upcoming" otherwise; never overdue.
 * - One-off items: overdue / due today / anytime (no due date) / upcoming by due date.
 * - "Completed Today" only contains items completed on the current local day; one-off
 *   items finished on earlier days are not part of today's queue at all.
 */
export function groupTodayItems(
  items: ExecutionItem[],
  completedTodayIds: ReadonlySet<string>,
  now = new Date(),
): TodayGroups {
  const groups: TodayGroups = { overdue: [], dueToday: [], anytime: [], upcoming: [], completedToday: [] }
  for (const item of items) {
    if (item.status === 'archived') continue
    if (completedTodayIds.has(item.id)) {
      groups.completedToday.push(item)
      continue
    }
    if (item.type === 'habit') {
      if (isHabitScheduledForToday(item.schedule, now)) groups.dueToday.push(item)
      else groups.upcoming.push(item)
      continue
    }
    if (item.status === 'done') continue // finished on an earlier day
    if (isOverdue(item.due_date, now)) groups.overdue.push(item)
    else if (isDueToday(item.due_date, now)) groups.dueToday.push(item)
    else if (isUpcoming(item.due_date, now)) groups.upcoming.push(item)
    else groups.anytime.push(item)
  }
  groups.overdue.sort(byDueThenPriority)
  groups.dueToday.sort(byDueThenPriority)
  groups.anytime.sort(byDueThenPriority)
  groups.upcoming.sort(byDueThenPriority)
  return groups
}

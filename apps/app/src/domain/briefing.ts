import type { ExecutionItem } from '@/types/domain'
import { getTodayDateString, isHabitScheduledForToday } from './dates'

/**
 * Pure helpers for the once-a-day "Daily Execution Briefing" and "Overdue Item Alerts".
 * Both only run while the app is open (no server-side scheduler exists).
 */
export interface DailySnapshot {
  items: ExecutionItem[]
  completedTodayIds: string[]
}

export interface DailyAlert {
  title: string
  body: string
}

/** True once per local day, at or after the configured HH:mm, if not already run today. */
export function shouldRunDaily(lastRunDate: string | null | undefined, timeHHmm: string, now = new Date()): boolean {
  const today = getTodayDateString(now)
  if (lastRunDate === today) return false
  const [h, m] = (timeHHmm || '09:00').split(':').map((v) => parseInt(v, 10))
  const hours = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9
  const minutes = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0
  const threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0)
  return now.getTime() >= threshold.getTime()
}

const isOpen = (item: ExecutionItem, completed: ReadonlySet<string>) =>
  item.status !== 'archived' && (item.type === 'habit' ? !completed.has(item.id) : item.status !== 'done')

export function summarizeDay(snapshot: DailySnapshot, now = new Date()) {
  const today = getTodayDateString(now)
  const completed = new Set(snapshot.completedTodayIds)
  const open = snapshot.items.filter((i) => isOpen(i, completed))
  const habitsRemaining = open.filter((i) => i.type === 'habit' && isHabitScheduledForToday(i.schedule, now)).length
  const dueToday = open.filter((i) => i.type !== 'habit' && i.due_date === today).length
  const overdue = open.filter((i) => i.type !== 'habit' && Boolean(i.due_date) && (i.due_date as string) < today)
  return { habitsRemaining, dueToday, overdue }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function buildDailyBriefing(snapshot: DailySnapshot, now = new Date()): DailyAlert {
  const { habitsRemaining, dueToday, overdue } = summarizeDay(snapshot, now)
  const parts: string[] = []
  if (dueToday) parts.push(`${plural(dueToday, 'item')} due today`)
  if (habitsRemaining) parts.push(`${plural(habitsRemaining, 'habit')} scheduled`)
  if (overdue.length) parts.push(`${overdue.length} overdue`)
  return {
    title: 'Your Track.now briefing',
    body: parts.length ? `${parts.join(' · ')}.` : 'Nothing is scheduled for today.',
  }
}

/** Null when nothing is overdue (no alert is shown). */
export function buildOverdueAlert(snapshot: DailySnapshot, now = new Date()): DailyAlert | null {
  const { overdue } = summarizeDay(snapshot, now)
  if (overdue.length === 0) return null
  const names = overdue
    .slice()
    .sort((a, b) => ((a.due_date as string) < (b.due_date as string) ? -1 : 1))
    .slice(0, 3)
    .map((i) => i.name)
  const more = overdue.length > names.length ? ` and ${overdue.length - names.length} more` : ''
  return {
    title: `${plural(overdue.length, 'item')} overdue`,
    body: `${names.join(', ')}${more}.`,
  }
}

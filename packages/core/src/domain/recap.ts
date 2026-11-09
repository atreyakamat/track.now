import type { Achievement, CompletionLike } from './momentum'
import { addDaysTo, weekStartOf } from './schedule'

/**
 * Motivation that only ever says true things: a recap of last week and a line about where
 * today stands. Everything is derived from completion records. Nothing here subtracts
 * points, shames a miss, or invents a number.
 */

export interface WeeklyRecap {
  /** Monday of the week being recapped (a finished Mon to Sun week). */
  weekStart: string
  /** Completions that week, counted once per item per day. */
  done: number
  /** Days with at least one completion. */
  activeDays: number
  /** The day with the most completions, when there was any. */
  bestDay: { date: string; count: number } | null
  /** The week before, for comparison. */
  previousDone: number
  /** How this week compares: more, the same, fewer, or no earlier week to compare with. */
  trend: 'up' | 'same' | 'down' | 'new'
}

const unique = (rows: readonly CompletionLike[]) => {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const k = `${r.item_id}|${r.completed_date}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Recap of the last finished week. Null when that week had no completions (a recap of nothing
 * would only be a reminder of a miss) or when there is no history before it.
 */
export function buildWeeklyRecap(completions: readonly CompletionLike[], today: string): WeeklyRecap | null {
  const rows = unique(completions)
  const thisWeek = weekStartOf(today)
  const weekStart = addDaysTo(thisWeek, -7)
  const weekEnd = addDaysTo(weekStart, 6)
  const inWeek = rows.filter((r) => r.completed_date >= weekStart && r.completed_date <= weekEnd)
  if (!inWeek.length) return null

  const perDay = new Map<string, number>()
  inWeek.forEach((r) => perDay.set(r.completed_date, (perDay.get(r.completed_date) ?? 0) + 1))
  let bestDay: WeeklyRecap['bestDay'] = null
  for (const [date, count] of [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!bestDay || count > bestDay.count) bestDay = { date, count }
  }

  const prevStart = addDaysTo(weekStart, -7)
  const previousDone = rows.filter((r) => r.completed_date >= prevStart && r.completed_date < weekStart).length
  const hadEarlier = rows.some((r) => r.completed_date < weekStart)
  const trend: WeeklyRecap['trend'] = !hadEarlier || previousDone === 0 ? 'new' : inWeek.length > previousDone ? 'up' : inWeek.length === previousDone ? 'same' : 'down'

  return { weekStart, done: inWeek.length, activeDays: perDay.size, bestDay, previousDone, trend }
}

/**
 * Achievements earned since the last time they were announced. `seen` null means nothing was
 * ever recorded: nothing is announced then (the caller records what is already earned).
 */
export function newlyEarned(achievements: readonly Achievement[], seen: readonly string[] | null): Achievement[] {
  if (seen === null) return []
  const known = new Set(seen)
  return achievements.filter((a) => a.earned && !known.has(a.id))
}

/** Human line for a recap: counts and a comparison, never a judgment. */
export function recapHeadline(r: WeeklyRecap): string {
  const things = r.done === 1 ? '1 thing' : `${r.done} things`
  const days = r.activeDays === 1 ? '1 day' : `${r.activeDays} days`
  const base = `Last week you finished ${things} across ${days}.`
  if (r.trend === 'up') return `${base} That is more than the week before (${r.previousDone}).`
  if (r.trend === 'same') return `${base} The same as the week before.`
  return base
}

export interface DayStanding {
  done: number
  total: number
  /** Days since the last completion before today (null when none). */
  daysAway: number | null
  /** The current run of active days up to today (or yesterday). */
  streak: number
}

/**
 * One honest sentence about today. Null when there is nothing worth saying (no items today).
 * A long absence is met with a welcome, never a reproach.
 */
export function encouragement(s: DayStanding): string | null {
  if (s.total <= 0) return null
  const left = s.total - s.done
  if (s.done === 0 && s.daysAway !== null && s.daysAway >= 7) return `Welcome back. One small thing today is a fine restart.`
  if (left === 0) return s.total === 1 ? 'Done for today.' : `All ${s.total} done. Enjoy the rest of your day.`
  if (s.done === 0) return left === 1 ? 'One thing today. Start with it.' : `${left} things today. Pick the easiest and begin.`
  if (left === 1) return 'One to go.'
  if (s.done * 2 >= s.total) return `Past halfway: ${s.done} of ${s.total} done.`
  if (s.streak >= 3) return `${s.streak} active days in a row. ${left} left today.`
  return `${s.done} done, ${left} to go.`
}

/** Days since the last completion strictly before `today`, or null when there is none. */
export function daysSinceLastCompletion(completions: readonly CompletionLike[], today: string): number | null {
  let last: string | null = null
  for (const c of completions) if (c.completed_date < today && (!last || c.completed_date > last)) last = c.completed_date
  if (!last) return null
  let n = 0
  for (let d = last; d < today && n < 3650; d = addDaysTo(d, 1)) n++
  return n
}

import { getTodayDateString } from './dates'
import { addDaysTo, weekStartOf } from './schedule'

/**
 * The activity heatmap: one cell per local day, columns are Mon–Sun weeks (the same weeks the
 * rest of the app uses), intensity from how much was completed that day. Built only from
 * completion rows; a day with nothing is simply empty, never estimated.
 */
export interface HeatCell {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  isToday: boolean
  isFuture: boolean
  /** Inside the highlighted range (e.g. the week or month being reviewed). */
  inRange: boolean
}

export interface HeatWeek {
  start: string
  /** Monday … Sunday. */
  days: HeatCell[]
}

export interface ActivityHeatmap {
  weeks: HeatWeek[]
  /** Month labels placed on the week column that contains the 1st of that month. */
  months: { weekIndex: number; label: string }[]
  start: string
  end: string
  total: number
  activeDays: number
  /** Consecutive active days ending today (or yesterday, while today is still open). */
  currentStreak: number
  /** Longest run of active days inside this window. */
  longestStreak: number
  bestDay: { date: string; count: number } | null
  max: number
}

export const HEATMAP_RANGES = [
  { weeks: 13, label: '3 months' },
  { weeks: 26, label: '6 months' },
  { weeks: 53, label: '1 year' },
] as const

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Completions per local day, optionally only for the rows a filter accepts. */
export function countByDate<T extends { completed_date: string }>(completions: readonly T[], accept?: (row: T) => boolean): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of completions) {
    if (accept && !accept(c)) continue
    counts[c.completed_date] = (counts[c.completed_date] ?? 0) + 1
  }
  return counts
}

export function buildActivityHeatmap(input: {
  counts: Readonly<Record<string, number>>
  now: Date
  weeks: number
  highlight?: { start: string; end: string } | null
}): ActivityHeatmap {
  const weeksCount = Math.max(1, Math.min(54, Math.floor(input.weeks)))
  const today = getTodayDateString(input.now)
  const lastWeekStart = weekStartOf(today)
  const start = addDaysTo(lastWeekStart, -7 * (weeksCount - 1))
  const end = addDaysTo(lastWeekStart, 6)

  let max = 0
  let total = 0
  let activeDays = 0
  let bestDay: ActivityHeatmap['bestDay'] = null
  for (let d = start; d <= today; d = addDaysTo(d, 1)) {
    const c = input.counts[d] ?? 0
    if (c <= 0) continue
    total += c
    activeDays++
    if (c > max) {
      max = c
      bestDay = { date: d, count: c }
    }
  }
  const levelOf = (count: number): HeatCell['level'] => {
    if (count <= 0) return 0
    if (max <= 1) return 3
    return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as HeatCell['level']
  }

  const weeks: HeatWeek[] = []
  const months: ActivityHeatmap['months'] = []
  for (let w = 0; w < weeksCount; w++) {
    const weekStart = addDaysTo(start, 7 * w)
    const days: HeatCell[] = []
    for (let i = 0; i < 7; i++) {
      const date = addDaysTo(weekStart, i)
      const isFuture = date > today
      const count = isFuture ? 0 : (input.counts[date] ?? 0)
      days.push({
        date,
        count,
        level: levelOf(count),
        isToday: date === today,
        isFuture,
        inRange: Boolean(input.highlight && date >= input.highlight.start && date <= input.highlight.end),
      })
      if (date.endsWith('-01') || (w === 0 && i === 0)) {
        const label = MONTHS[Number(date.slice(5, 7)) - 1]
        // Skip a label that would collide with the previous one (first column, then the 1st a week later).
        if (!months.length || w - months[months.length - 1].weekIndex >= 3) months.push({ weekIndex: w, label })
        else if (date.endsWith('-01')) months[months.length - 1] = { weekIndex: w, label }
      }
    }
    weeks.push({ start: weekStart, days })
  }

  // Streaks of active days inside the window.
  let longestStreak = 0
  let run = 0
  for (let d = start; d <= today; d = addDaysTo(d, 1)) {
    run = (input.counts[d] ?? 0) > 0 ? run + 1 : 0
    if (run > longestStreak) longestStreak = run
  }
  let currentStreak = 0
  let cursor = (input.counts[today] ?? 0) > 0 ? today : addDaysTo(today, -1)
  while (cursor >= start && (input.counts[cursor] ?? 0) > 0) {
    currentStreak++
    cursor = addDaysTo(cursor, -1)
  }

  return { weeks, months, start, end, total, activeDays, currentStreak, longestStreak: Math.max(longestStreak, currentStreak), bestDay, max }
}

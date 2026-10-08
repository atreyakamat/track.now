import { getTodayDateString } from './dates'

/**
 * Pure date parser for 'YYYY-MM-DD' string to local midnight Date.
 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

/**
 * Pure date addition in days.
 */
export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + days)
  return getTodayDateString(d)
}

/**
 * Determines if a habit is expected/scheduled to be completed on a specific date string.
 * - If no schedule: defaults to daily (true)
 * - If frequency is 'daily': always true
 * - If frequency is 'weekly' or 'custom': matches day of week (0=Sun..6=Sat)
 * - If frequency is 'monthly': true
 */
export function isHabitScheduledForDate(
  schedule: { frequency?: string; days_of_week?: number[] | null } | null | undefined,
  dateStr: string,
): boolean {
  if (!schedule) return true
  if (schedule.frequency === 'daily') return true
  if (schedule.frequency === 'weekly' || schedule.frequency === 'custom') {
    if (!schedule.days_of_week || schedule.days_of_week.length === 0) return true
    const d = parseDate(dateStr)
    const dayOfWeek = d.getDay()
    return schedule.days_of_week.includes(dayOfWeek)
  }
  return true
}

export interface HabitStreakSummary {
  itemId: string
  currentStreak: number
  longestStreak: number
  totalCompletions: number
  consistencyRate: number // 0 to 100 percentage in the evaluation window
  lastCompletedDate: string | null
  isCompletedToday: boolean
  isActiveStreak: boolean
}

/**
 * Pure calculation of habit streak and consistency metrics.
 *
 * Rules:
 * 1. Current streak increments for consecutive completed expected days.
 * 2. Rest days (days not in schedule) DO NOT break the streak.
 * 3. If today is an expected day but not completed yet, the streak from previous
 *    completed days remains active (today is still pending, not missed).
 * 4. If yesterday (or the most recent scheduled day before today) was missed,
 *    current streak drops to 0 (or 1 if today was completed).
 * 5. Longest streak is the historical maximum consecutive expected periods completed.
 */
export function calcHabitStreak(
  itemId: string,
  schedule: { frequency?: string; days_of_week?: number[] | null } | null | undefined,
  completedDates: string[],
  now = new Date(),
  evaluationDays = 90,
): HabitStreakSummary {
  const todayStr = getTodayDateString(now)
  const uniqueDates = Array.from(new Set(completedDates.filter(Boolean))).sort()
  const completionSet = new Set(uniqueDates)

  const isCompletedToday = completionSet.has(todayStr)
  const totalCompletions = uniqueDates.length
  const lastCompletedDate = uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : null

  // --- Calculate Current Streak ---
  let currentStreak = 0

  if (isCompletedToday) {
    currentStreak = 1
    let cursor = addDays(todayStr, -1)
    let safetyCounter = 0
    while (safetyCounter < 730) {
      safetyCounter++
      if (isHabitScheduledForDate(schedule, cursor)) {
        if (completionSet.has(cursor)) {
          currentStreak++
          cursor = addDays(cursor, -1)
        } else {
          break
        }
      } else {
        // Rest day: does not break streak
        cursor = addDays(cursor, -1)
      }
    }
  } else {
    // Today is not completed yet. Find the most recent scheduled day before today.
    let prevScheduled = addDays(todayStr, -1)
    let foundPrevScheduled = false
    let prevScheduledCompleted = false
    let safetyCounter = 0

    while (safetyCounter < 30) {
      safetyCounter++
      if (isHabitScheduledForDate(schedule, prevScheduled)) {
        foundPrevScheduled = true
        prevScheduledCompleted = completionSet.has(prevScheduled)
        break
      }
      prevScheduled = addDays(prevScheduled, -1)
    }

    if (foundPrevScheduled && prevScheduledCompleted) {
      // Previous scheduled day was completed: streak is preserved pending today!
      currentStreak = 1
      let cursor = addDays(prevScheduled, -1)
      safetyCounter = 0
      while (safetyCounter < 730) {
        safetyCounter++
        if (isHabitScheduledForDate(schedule, cursor)) {
          if (completionSet.has(cursor)) {
            currentStreak++
            cursor = addDays(cursor, -1)
          } else {
            break
          }
        } else {
          cursor = addDays(cursor, -1)
        }
      }
    } else {
      currentStreak = 0
    }
  }

  // --- Calculate Longest Streak ---
  // Start from the earliest date between (today - 365 days) and the earliest completed date
  let earliest = addDays(todayStr, -Math.max(evaluationDays, 365))
  if (uniqueDates.length > 0 && uniqueDates[0] < earliest) {
    earliest = uniqueDates[0]
  }

  let runningStreak = 0
  let longestStreak = 0
  let current = earliest
  let safetyCounter = 0

  while (current <= todayStr && safetyCounter < 1000) {
    safetyCounter++
    if (isHabitScheduledForDate(schedule, current)) {
      if (completionSet.has(current)) {
        runningStreak++
        if (runningStreak > longestStreak) {
          longestStreak = runningStreak
        }
      } else {
        if (current === todayStr && !isCompletedToday) {
          // Do not break running streak on today if today is not over yet
        } else {
          runningStreak = 0
        }
      }
    }
    current = addDays(current, 1)
  }

  longestStreak = Math.max(longestStreak, currentStreak)

  // --- Calculate Consistency Rate in Evaluation Window ---
  const windowStart = addDays(todayStr, -evaluationDays)
  let expectedInWindow = 0
  let completedInWindow = 0
  let checkDate = windowStart
  safetyCounter = 0

  while (checkDate <= todayStr && safetyCounter < 500) {
    safetyCounter++
    if (isHabitScheduledForDate(schedule, checkDate)) {
      expectedInWindow++
      if (completionSet.has(checkDate)) {
        completedInWindow++
      }
    }
    checkDate = addDays(checkDate, 1)
  }

  const consistencyRate =
    expectedInWindow > 0 ? Math.round((completedInWindow / expectedInWindow) * 100) : 0

  return {
    itemId,
    currentStreak,
    longestStreak,
    totalCompletions,
    consistencyRate,
    lastCompletedDate,
    isCompletedToday,
    isActiveStreak: currentStreak > 0,
  }
}

export interface HeatmapCell {
  date: string // 'YYYY-MM-DD'
  dayOfWeek: number // 0=Sun..6=Sat
  count: number
  level: 0 | 1 | 2 | 3 | 4
  isToday: boolean
  isFuture: boolean
  isScheduled?: boolean
}

export interface HeatmapWeek {
  weekIndex: number
  days: (HeatmapCell | null)[] // 7 days (index 0 = Sun .. 6 = Sat)
  startDate: string
  endDate: string
}

export interface HeatmapMatrix {
  weeks: HeatmapWeek[]
  totalCompletions: number
  activeDays: number
  maxDailyCount: number
  startDate: string
  endDate: string
}

/**
 * Generates an accessible, matrix-style calendar heatmap for the past N weeks.
 * Supports aggregate completion counts (e.g. all habits across plan or dashboard)
 * or single-habit completion histories.
 */
export function generateHeatmapMatrix(
  dailyCounts: Record<string, number>,
  now = new Date(),
  weeksCount = 12,
  schedule?: { frequency?: string; days_of_week?: number[] | null } | null,
): HeatmapMatrix {
  const todayStr = getTodayDateString(now)
  const todayDate = parseDate(todayStr)
  const todayDayOfWeek = todayDate.getDay() // 0=Sun..6=Sat

  // End of the current week (Saturday)
  const endOfWeekStr = addDays(todayStr, 6 - todayDayOfWeek)
  // Start of the window: weeksCount weeks before the end of the current week
  const totalDays = weeksCount * 7
  const startOfWindowStr = addDays(endOfWeekStr, -(totalDays - 1))

  let maxDailyCount = 0
  let totalCompletions = 0
  let activeDays = 0

  // Calculate maximum count in window to calibrate levels
  let cur = startOfWindowStr
  for (let i = 0; i < totalDays; i++) {
    const c = dailyCounts[cur] || 0
    if (c > maxDailyCount) maxDailyCount = c
    if (c > 0 && cur <= todayStr) {
      totalCompletions += c
      activeDays++
    }
    cur = addDays(cur, 1)
  }

  // Level thresholds:
  // For maxDailyCount = 1 (single habit): count 1 -> level 2 (distinct active)
  // For higher counts: scaled 1 to 4
  const getLevel = (count: number): 0 | 1 | 2 | 3 | 4 => {
    if (count <= 0) return 0
    if (maxDailyCount <= 1) return 2
    if (count === 1) return 1
    if (count === 2) return 2
    if (count <= 4) return 3
    return 4
  }

  const weeks: HeatmapWeek[] = []
  let dayCursor = startOfWindowStr

  for (let w = 0; w < weeksCount; w++) {
    const days: (HeatmapCell | null)[] = []
    const weekStart = dayCursor

    for (let d = 0; d < 7; d++) {
      const isToday = dayCursor === todayStr
      const isFuture = dayCursor > todayStr
      const count = isFuture ? 0 : dailyCounts[dayCursor] || 0
      const isScheduled = schedule ? isHabitScheduledForDate(schedule, dayCursor) : true

      days.push({
        date: dayCursor,
        dayOfWeek: d,
        count,
        level: getLevel(count),
        isToday,
        isFuture,
        isScheduled,
      })

      dayCursor = addDays(dayCursor, 1)
    }

    const weekEnd = addDays(dayCursor, -1)
    weeks.push({
      weekIndex: w,
      days,
      startDate: weekStart,
      endDate: weekEnd,
    })
  }

  return {
    weeks,
    totalCompletions,
    activeDays,
    maxDailyCount,
    startDate: startOfWindowStr,
    endDate: endOfWeekStr,
  }
}

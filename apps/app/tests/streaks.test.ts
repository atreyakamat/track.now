import { describe, expect, it } from 'vitest'
import {
  addDays,
  calcHabitStreak,
  generateHeatmapMatrix,
  isHabitScheduledForDate,
  parseDate,
} from '../src/domain/streaks'

describe('Domain Streaks Engine - Dates & Schedules', () => {
  it('correctly parses YYYY-MM-DD into local Date and adds days', () => {
    const d = parseDate('2026-10-08')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(9) // 0-indexed: 9 = October
    expect(d.getDate()).toBe(8)

    expect(addDays('2026-10-08', 1)).toBe('2026-10-09')
    expect(addDays('2026-10-08', -1)).toBe('2026-10-07')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('determines habit scheduled days accurately', () => {
    // Null schedule -> default daily
    expect(isHabitScheduledForDate(null, '2026-10-08')).toBe(true)

    // Daily schedule -> always true
    expect(isHabitScheduledForDate({ frequency: 'daily' }, '2026-10-08')).toBe(true)

    // 2026-10-08 is a Thursday (day 4: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
    const mwfSchedule = { frequency: 'weekly', days_of_week: [1, 3, 5] } // Mon, Wed, Fri
    expect(isHabitScheduledForDate(mwfSchedule, '2026-10-08')).toBe(false) // Thu -> false
    expect(isHabitScheduledForDate(mwfSchedule, '2026-10-09')).toBe(true)  // Fri -> true
    expect(isHabitScheduledForDate(mwfSchedule, '2026-10-10')).toBe(false) // Sat -> false
    expect(isHabitScheduledForDate(mwfSchedule, '2026-10-12')).toBe(true)  // Mon -> true
  })
})

describe('Domain Streaks Engine - calcHabitStreak', () => {
  const refDate = new Date(2026, 9, 8) // Thursday, Oct 8, 2026

  it('returns 0 streak when there are no completions', () => {
    const res = calcHabitStreak('item-1', { frequency: 'daily' }, [], refDate)
    expect(res.currentStreak).toBe(0)
    expect(res.longestStreak).toBe(0)
    expect(res.totalCompletions).toBe(0)
    expect(res.consistencyRate).toBe(0)
    expect(res.isActiveStreak).toBe(false)
    expect(res.isCompletedToday).toBe(false)
  })

  it('calculates current streak when completed today', () => {
    const dates = ['2026-10-06', '2026-10-07', '2026-10-08']
    const res = calcHabitStreak('item-1', { frequency: 'daily' }, dates, refDate)
    expect(res.currentStreak).toBe(3)
    expect(res.longestStreak).toBe(3)
    expect(res.totalCompletions).toBe(3)
    expect(res.isCompletedToday).toBe(true)
    expect(res.isActiveStreak).toBe(true)
  })

  it('preserves active streak when today is not completed yet but yesterday was completed', () => {
    // Oct 7 completed, Oct 8 (today) pending
    const dates = ['2026-10-06', '2026-10-07']
    const res = calcHabitStreak('item-1', { frequency: 'daily' }, dates, refDate)
    expect(res.currentStreak).toBe(2)
    expect(res.longestStreak).toBe(2)
    expect(res.isCompletedToday).toBe(false)
    expect(res.isActiveStreak).toBe(true)
  })

  it('breaks current streak when yesterday was missed and today is not completed', () => {
    // Oct 5 & 6 completed, Oct 7 missed, Oct 8 not completed
    const dates = ['2026-10-05', '2026-10-06']
    const res = calcHabitStreak('item-1', { frequency: 'daily' }, dates, refDate)
    expect(res.currentStreak).toBe(0)
    expect(res.longestStreak).toBe(2)
    expect(res.isActiveStreak).toBe(false)
  })

  it('starts a new streak of 1 when yesterday was missed but today is completed', () => {
    // Oct 5 completed, Oct 6 & 7 missed, Oct 8 completed
    const dates = ['2026-10-05', '2026-10-08']
    const res = calcHabitStreak('item-1', { frequency: 'daily' }, dates, refDate)
    expect(res.currentStreak).toBe(1)
    expect(res.longestStreak).toBe(1)
    expect(res.isActiveStreak).toBe(true)
    expect(res.isCompletedToday).toBe(true)
  })

  it('calculates longest streak independently from current streak', () => {
    // Historical block: 5 days (Sept 1 to 5)
    // Then gap
    // Recent block: 2 days (Oct 7, Oct 8)
    const dates = [
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-10-07',
      '2026-10-08',
    ]
    const res = calcHabitStreak('item-1', { frequency: 'daily' }, dates, refDate)
    expect(res.currentStreak).toBe(2)
    expect(res.longestStreak).toBe(5)
    expect(res.totalCompletions).toBe(7)
  })

  it('handles custom days of week schedules and skips non-scheduled days without breaking streak', () => {
    // Mon, Wed, Fri habit
    // 2026-10-02 (Fri) - completed
    // 2026-10-05 (Mon) - completed
    // 2026-10-07 (Wed) - completed
    // 2026-10-08 (Thu) - refDate (Thursday is not a scheduled day!)
    const mwfSchedule = { frequency: 'weekly', days_of_week: [1, 3, 5] }
    const dates = ['2026-10-02', '2026-10-05', '2026-10-07']
    const res = calcHabitStreak('item-1', mwfSchedule, dates, refDate)
    // Streak should be 3 because Fri -> Mon -> Wed were consecutive scheduled days
    expect(res.currentStreak).toBe(3)
    expect(res.longestStreak).toBe(3)
    expect(res.isActiveStreak).toBe(true)
  })

  it('calculates consistency rate as percentage of expected days in window', () => {
    // Window: 10 days
    // 5 completions in 10 daily expected days -> 50%
    const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']
    const res = calcHabitStreak('item-1', { frequency: 'daily' }, dates, refDate, 10)
    expect(res.consistencyRate).toBe(45) // 5 out of 11 days (Oct 8 minus 10 days to Oct 8 = 11 days)
  })
})

describe('Domain Heatmap Engine - generateHeatmapMatrix', () => {
  const refDate = new Date(2026, 9, 8) // Oct 8, 2026

  it('generates a 12-week matrix ending at the current week', () => {
    const dailyCounts = {
      '2026-10-08': 3,
      '2026-10-07': 1,
      '2026-10-06': 5,
    }
    const matrix = generateHeatmapMatrix(dailyCounts, refDate, 12)

    expect(matrix.weeks.length).toBe(12)
    matrix.weeks.forEach((week) => {
      expect(week.days.length).toBe(7)
    })

    // Active days count
    expect(matrix.activeDays).toBe(3)
    expect(matrix.totalCompletions).toBe(9)
    expect(matrix.maxDailyCount).toBe(5)

    // Find today's cell
    const allCells = matrix.weeks.flatMap((w) => w.days).filter(Boolean)
    const todayCell = allCells.find((c) => c?.date === '2026-10-08')
    expect(todayCell).toBeDefined()
    expect(todayCell?.count).toBe(3)
    expect(todayCell?.isToday).toBe(true)
    expect(todayCell?.isFuture).toBe(false)
    expect(todayCell?.level).toBe(3)

    // Find future cell in the current week (e.g. Saturday Oct 10)
    const futureCell = allCells.find((c) => c?.date === '2026-10-10')
    expect(futureCell).toBeDefined()
    expect(futureCell?.isFuture).toBe(true)
    expect(futureCell?.count).toBe(0)
    expect(futureCell?.level).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import {
  formatDateRange,
  getTodayDateString,
  greeting,
  isDueToday,
  isOverdue,
  isUpcoming,
} from '@/domain/dates'

describe('dates domain logic', () => {
  const fixedNow = new Date('2026-03-15T12:00:00Z')

  it('formats today date string properly', () => {
    expect(getTodayDateString(fixedNow)).toBe('2026-03-15')
  })

  it('determines if due date is overdue', () => {
    expect(isOverdue('2026-03-14', fixedNow)).toBe(true)
    expect(isOverdue('2026-03-15', fixedNow)).toBe(false)
    expect(isOverdue('2026-03-16', fixedNow)).toBe(false)
    expect(isOverdue(null, fixedNow)).toBe(false)
  })

  it('determines if due date is today', () => {
    expect(isDueToday('2026-03-15', fixedNow)).toBe(true)
    expect(isDueToday('2026-03-14', fixedNow)).toBe(false)
    expect(isDueToday('2026-03-16', fixedNow)).toBe(false)
    expect(isDueToday(null, fixedNow)).toBe(false)
  })

  it('determines if due date is upcoming', () => {
    expect(isUpcoming('2026-03-16', fixedNow)).toBe(true)
    expect(isUpcoming('2026-03-15', fixedNow)).toBe(false)
    expect(isUpcoming('2026-03-14', fixedNow)).toBe(false)
    expect(isUpcoming(null, fixedNow)).toBe(false)
  })

  it('respects same-day boundaries regardless of time (midnight vs 23:59:59)', () => {
    const midnight = new Date(2026, 2, 15, 0, 0, 0)
    const endOfDay = new Date(2026, 2, 15, 23, 59, 59)

    expect(getTodayDateString(midnight)).toBe('2026-03-15')
    expect(getTodayDateString(endOfDay)).toBe('2026-03-15')

    expect(isDueToday('2026-03-15', midnight)).toBe(true)
    expect(isDueToday('2026-03-15', endOfDay)).toBe(true)

    expect(isOverdue('2026-03-14', midnight)).toBe(true)
    expect(isOverdue('2026-03-14', endOfDay)).toBe(true)

    expect(isUpcoming('2026-03-16', midnight)).toBe(true)
    expect(isUpcoming('2026-03-16', endOfDay)).toBe(true)
  })

  it('generates appropriate greetings by time of day', () => {
    const morning = new Date('2026-03-15T09:00:00')
    const afternoon = new Date('2026-03-15T14:00:00')
    const evening = new Date('2026-03-15T20:00:00')
    const lateNight = new Date('2026-03-15T03:00:00')

    expect(greeting(morning)).toBe('Good morning')
    expect(greeting(afternoon)).toBe('Good afternoon')
    expect(greeting(evening)).toBe('Good evening')
    expect(greeting(lateNight)).toBe('Good evening')
  })

  it('formats date ranges cleanly', () => {
    const range = formatDateRange('2026-03-01', '2026-03-31')
    expect(range).toContain('Mar')
    expect(range).toContain('1')
    expect(range).toContain('31')
    expect(range).toContain('–')

    const startOnly = formatDateRange('2026-03-01', null)
    expect(startOnly).toMatch(/^From /)
    expect(startOnly).toContain('Mar')
    expect(startOnly).toContain('1')

    const endOnly = formatDateRange(null, '2026-03-31')
    expect(endOnly).toMatch(/^Until /)
    expect(endOnly).toContain('Mar')
    expect(endOnly).toContain('31')

    expect(formatDateRange(null, null)).toBeNull()
  })
})

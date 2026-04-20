import { describe, it, expect } from 'vitest'
import { 
  normalizeHabit, 
  getHabitSessionProgressForDate,
  calculateMomentum
} from '../../src/utils/habitModel'

describe('habitModel: Logic Verification', () => {
  const mockHabit = {
    id: 'test-1',
    name: 'Workout',
    days: ['mon', 'wed', 'fri'],
    reminderTimes: ['08:00', '18:00'],
    durationDays: 21,
    category: 'health'
  }

  it('should normalize habit data correctly', () => {
    const normalized = normalizeHabit(mockHabit)
    expect(normalized.reminderTimes).toHaveLength(2)
    expect(normalized.graceLimit).toBe(1) // Default for 21 days
    expect(normalized.category).toBe('health')
  })

  it('should track multi-session progress', () => {
    const completions = [
      { habitId: 'test-1', date: '2026-04-20', sessionId: '08:00' }
    ]
    const progress = getHabitSessionProgressForDate(mockHabit, completions, '2026-04-20')
    
    expect(progress.completedSessions).toBe(1)
    expect(progress.totalSessions).toBe(2)
    expect(progress.completed).toBe(false)
    expect(progress.nextSessionId).toBe('18:00')
  })

  it('should mark day complete only when all sessions are done', () => {
    const completions = [
      { habitId: 'test-1', date: '2026-04-20', sessionId: '08:00' },
      { habitId: 'test-1', date: '2026-04-20', sessionId: '18:00' }
    ]
    const progress = getHabitSessionProgressForDate(mockHabit, completions, '2026-04-20')
    
    expect(progress.completedSessions).toBe(2)
    expect(progress.completed).toBe(true)
  })

  it('should calculate momentum correctly', () => {
    // Note: calculateMomentum depends on current date, but we can test the math
    const habits = [mockHabit]
    const completions = [] // 0% momentum
    const momentum = calculateMomentum(habits, completions)
    expect(momentum.percentage).toBe(0)
  })
})

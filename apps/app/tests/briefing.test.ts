import { describe, expect, it } from 'vitest'
import { buildDailyBriefing, buildOverdueAlert, shouldRunDaily, summarizeDay } from '@/domain/briefing'
import type { ExecutionItem } from '@/types/domain'

const now = new Date(2026, 9, 12, 9, 30) // Monday 09:30 local
const base: ExecutionItem = {
  id: 'x',
  user_id: 'u',
  plan_id: 'p',
  type: 'task',
  name: 'x',
  description: null,
  status: 'todo',
  priority: 'medium',
  due_date: null,
  created_at: '',
  updated_at: '',
}

const items: ExecutionItem[] = [
  { ...base, id: 't-today', name: 'Send invoice', due_date: '2026-10-12' },
  { ...base, id: 't-over', name: 'File taxes', due_date: '2026-10-01' },
  { ...base, id: 't-over-done', name: 'Old done', due_date: '2026-10-01', status: 'done' },
  { ...base, id: 'h-1', type: 'habit', name: 'Stretch', due_date: '2026-10-01' },
  { ...base, id: 'h-2', type: 'habit', name: 'Read' },
]

describe('daily briefing and overdue alerts', () => {
  it('runs once per day at or after the configured time', () => {
    expect(shouldRunDaily(null, '09:00', now)).toBe(true)
    expect(shouldRunDaily(null, '10:00', now)).toBe(false)
    expect(shouldRunDaily('2026-10-12', '09:00', now)).toBe(false)
    expect(shouldRunDaily('2026-10-11', '09:00', now)).toBe(true)
  })

  it('summarizes real items: habits are never overdue, completed items are excluded', () => {
    const s = summarizeDay({ items, completedTodayIds: ['h-2'] }, now)
    expect(s.dueToday).toBe(1)
    expect(s.habitsRemaining).toBe(1)
    expect(s.overdue.map((i) => i.id)).toEqual(['t-over'])
  })

  it('builds honest messages and no overdue alert when nothing is overdue', () => {
    expect(buildDailyBriefing({ items, completedTodayIds: [] }, now).body).toBe(
      '1 item due today · 2 habits scheduled · 1 overdue.',
    )
    expect(buildDailyBriefing({ items: [], completedTodayIds: [] }, now).body).toBe('Nothing is scheduled for today.')
    expect(buildOverdueAlert({ items, completedTodayIds: [] }, now)?.title).toBe('1 item overdue')
    expect(buildOverdueAlert({ items: [items[0]], completedTodayIds: [] }, now)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { groupTodayItems } from '@/domain/today'
import type { ExecutionItem } from '@/types/domain'

const now = new Date(2026, 9, 12, 10, 0) // Monday 2026-10-12, 10:00 local

const base: ExecutionItem = {
  id: 'x',
  plan_id: 'p',
  user_id: 'u',
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
  { ...base, id: 'overdue-b', name: 'B overdue', due_date: '2026-10-05', priority: 'low' },
  { ...base, id: 'overdue-a', name: 'A overdue', due_date: '2026-10-05', priority: 'urgent' },
  { ...base, id: 'overdue-old', name: 'Old overdue', due_date: '2026-09-01' },
  { ...base, id: 'today', name: 'Due today', due_date: '2026-10-12' },
  { ...base, id: 'anytime', name: 'No date' },
  { ...base, id: 'upcoming', name: 'Later', due_date: '2026-10-20' },
  { ...base, id: 'done-earlier', name: 'Done last week', status: 'done', due_date: '2026-10-01' },
  { ...base, id: 'done-today', name: 'Done today', status: 'done', due_date: '2026-10-12' },
  { ...base, id: 'archived', name: 'Archived', status: 'archived', due_date: '2026-10-12' },
  {
    ...base,
    id: 'habit-mon',
    type: 'habit',
    name: 'Monday habit',
    due_date: '2026-09-01', // stale due date must not make a habit overdue
    schedule: { id: 's', item_id: 'habit-mon', frequency: 'custom', days_of_week: [1], time_of_day: 'anytime', created_at: '' },
  },
  {
    ...base,
    id: 'habit-sat',
    type: 'habit',
    name: 'Saturday habit',
    schedule: { id: 's2', item_id: 'habit-sat', frequency: 'weekly', days_of_week: [6], time_of_day: 'anytime', created_at: '' },
  },
  { ...base, id: 'habit-done', type: 'habit', name: 'Daily habit', status: 'done' },
]

describe('Today grouping', () => {
  const groups = groupTodayItems(items, new Set(['done-today', 'habit-done']), now)
  const ids = (list: ExecutionItem[]) => list.map((i) => i.id)

  it('puts overdue one-off items first, ordered by due date then priority', () => {
    expect(ids(groups.overdue)).toEqual(['overdue-old', 'overdue-a', 'overdue-b'])
  })

  it('shows habits scheduled today as due today and never as overdue', () => {
    expect(ids(groups.dueToday)).toEqual(['today', 'habit-mon'])
  })

  it('separates anytime and upcoming items, including habits not scheduled today', () => {
    expect(ids(groups.anytime)).toEqual(['anytime'])
    expect(ids(groups.upcoming)).toEqual(['upcoming', 'habit-sat'])
  })

  it('lists only items completed today under Completed Today; earlier completions and archived items are hidden', () => {
    expect(ids(groups.completedToday).sort()).toEqual(['done-today', 'habit-done'])
    const all = [...groups.overdue, ...groups.dueToday, ...groups.anytime, ...groups.upcoming, ...groups.completedToday]
    expect(ids(all)).not.toContain('done-earlier')
    expect(ids(all)).not.toContain('archived')
  })

  it('a daily habit whose stale status is done but not completed today is due again', () => {
    const g = groupTodayItems([{ ...base, id: 'h', type: 'habit', status: 'done' }], new Set(), now)
    expect(ids(g.dueToday)).toEqual(['h'])
  })

  it('uses the local calendar day at the midnight boundary', () => {
    const lateNight = new Date(2026, 9, 12, 23, 59, 59)
    const justAfter = new Date(2026, 9, 13, 0, 0, 1)
    const task = [{ ...base, id: 't', due_date: '2026-10-12' }]
    expect(ids(groupTodayItems(task, new Set(), lateNight).dueToday)).toEqual(['t'])
    expect(ids(groupTodayItems(task, new Set(), justAfter).overdue)).toEqual(['t'])
  })
})

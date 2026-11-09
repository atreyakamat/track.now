import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from '@tracknow/core/domain/quickAdd'
import { importItemsFromCsv, parseCsv } from '@tracknow/core/domain/csvImport'
import { buildExportBundle, completionsCsv, itemsCsv } from '@tracknow/core/domain/exportData'
import { calcHabitStreak } from '@tracknow/core/domain/streaks'
import { groupTodayItems, todaySummary } from '@tracknow/core/domain/today'
import { buildRetention } from '@tracknow/core/domain/retention'
import { termsFor } from '@tracknow/core/domain/terms'
import { PLAN_LIBRARY, materializeLibraryEntry } from '@tracknow/core/constants/planLibrary'
import { parsePlanFile } from '@tracknow/core/domain/planImport'
import { GOAL_TEMPLATES, SIGNUP_TEMPLATE_KEYS } from '@tracknow/core/constants/goalTemplates'
import { buildWeekCard } from '@tracknow/core/domain/shareCard'
import type { ExecutionItem, Plan } from '@tracknow/core/types/domain'

const NOW = new Date(2026, 10, 8, 12) // Sunday 8 Nov 2026
const item = (over: Partial<ExecutionItem>): ExecutionItem => ({
  id: 'x', plan_id: 'p', user_id: 'u', type: 'task', name: 'x', description: null, status: 'todo',
  priority: 'medium', due_date: null, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z', ...over,
})
const plan = (over: Partial<Plan>): Plan => ({
  id: 'p', track_id: 't', user_id: 'u', name: 'P', description: null, start_date: null, end_date: null,
  status: 'active', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z', ...over,
})

describe('natural-language quick add', () => {
  it('reads days, a time and a habit from "Gym Mon Wed Fri 6am"', () => {
    const q = parseQuickAdd('Gym Mon Wed Fri 6am', NOW)
    expect(q).toMatchObject({ name: 'Gym', type: 'habit', daysOfWeek: [1, 3, 5], time: '06:00', timeOfDay: 'morning' })
  })
  it('reads a due date from "Call dentist tomorrow"', () => {
    expect(parseQuickAdd('Call dentist tomorrow', NOW)).toMatchObject({ name: 'Call dentist', type: 'task', dueDate: '2026-11-09' })
  })
  it('reads weekly targets, quantities, priorities and explicit dates', () => {
    expect(parseQuickAdd('Run 3x a week !high', NOW)).toMatchObject({ name: 'Run', type: 'habit', timesPerWeek: 3, priority: 'high' })
    expect(parseQuickAdd('Read 20 pages every evening', NOW)).toMatchObject({ name: 'Read', type: 'habit', targetCount: 20, unit: 'pages', timeOfDay: 'evening' })
    expect(parseQuickAdd('Pay rent on 1 Dec', NOW)).toMatchObject({ name: 'Pay rent', dueDate: '2026-12-01' })
    expect(parseQuickAdd('Submit report next monday', NOW)).toMatchObject({ dueDate: '2026-11-09' })
    expect(parseQuickAdd('Ship v2 milestone: launch', NOW).type).toBe('milestone')
  })
  it('leaves plain text alone', () => {
    const q = parseQuickAdd('Buy a new lamp', NOW)
    expect(q).toMatchObject({ name: 'Buy a new lamp', type: 'task', dueDate: null, daysOfWeek: null })
    expect(q.recognised).toEqual([])
  })
})

describe('skips are rest days, not misses', () => {
  it('a skipped scheduled day keeps a daily streak alive', () => {
    const dates = ['2026-11-04', '2026-11-05', '2026-11-07', '2026-11-08']
    const without = calcHabitStreak('h', { frequency: 'daily' }, dates, NOW, 90, '2026-11-01')
    const withSkip = calcHabitStreak('h', { frequency: 'daily' }, dates, NOW, 90, '2026-11-01', ['2026-11-06'])
    expect(without.currentStreak).toBe(2)
    expect(withSkip.currentStreak).toBe(4)
    expect(withSkip.consistencyRate).toBeGreaterThan(without.consistencyRate)
  })
  it('a skipped item leaves Today’s queue and totals', () => {
    const a = item({ id: 'a', due_date: '2026-11-08' })
    const b = item({ id: 'b', due_date: '2026-11-08' })
    const g = groupTodayItems([a, b], new Set(), NOW, { skippedIds: ['a'] })
    expect(g.skipped.map((i) => i.id)).toEqual(['a'])
    expect(g.dueToday.map((i) => i.id)).toEqual(['b'])
    expect(todaySummary(g).total).toBe(1)
  })
  it('retention does not plan skipped days', () => {
    const h = item({ id: 'h', type: 'habit', schedule: { frequency: 'daily' } as never })
    const base = { items: [h], plans: [plan({})], completions: [], now: NOW, weeks: 1 }
    const planned = buildRetention(base).weeks[0].planned
    const withSkips = buildRetention({ ...base, skippedByItem: { h: ['2026-11-02', '2026-11-03'] } }).weeks[0].planned
    expect(withSkips).toBe(planned - 2)
  })
})

describe('CSV import and data export', () => {
  it('parses quoted CSV and recognises common columns', () => {
    expect(parseCsv('a,"b, c",d\n1,"x ""y""",3')).toEqual([['a', 'b, c', 'd'], ['1', 'x "y"', '3']])
    const r = importItemsFromCsv('name,type,due,priority,days\nCall mum,task,2026-12-01,high,\nGym,habit,,,Mon Wed Fri\nRun,,,,3x a week')
    expect(r.errors).toEqual([])
    expect(r.items).toHaveLength(3)
    expect(r.items[0]).toMatchObject({ type: 'task', due_date: '2026-12-01', priority: 'high' })
    expect(r.items[1]).toMatchObject({ type: 'habit', days_of_week: [1, 3, 5] })
    expect(r.items[2]).toMatchObject({ type: 'habit', times_per_week: 3 })
  })
  it('a single column is a list of names; a missing name column is an error', () => {
    expect(importItemsFromCsv('Buy milk\nWalk the dog').items.map((i) => i.name)).toEqual(['Buy milk', 'Walk the dog'])
    expect(importItemsFromCsv('foo,bar\n1,2').errors.length).toBe(1)
  })
  it('exports items and completions as CSV with escaping', () => {
    const bundle = buildExportBundle({
      tracks: [{ id: 't', name: 'Health', user_id: 'u', status: 'active', created_at: '', updated_at: '' } as never],
      plans: [plan({ id: 'p', track_id: 't', arc_name: 'Winter Arc' })],
      items: [item({ id: 'i', name: 'Gym, hard "day"', type: 'habit' })],
      completions: [{ item_id: 'i', completed_date: '2026-11-08' }],
    }, NOW)
    const csv = itemsCsv(bundle)
    expect(csv.split('\n')[1]).toContain('"Gym, hard ""day"""')
    expect(csv.split('\n')[1]).toContain('Winter Arc')
    expect(completionsCsv(bundle).split('\n')[1]).toBe('i,"Gym, hard ""day""",2026-11-08,')
    expect(bundle.format).toBe('tracknow.export.v1')
  })
})

describe('vocabulary, templates and the plan library', () => {
  it('simple names swap only the labels', () => {
    expect(termsFor('simple')).toMatchObject({ track: 'Area', plan: 'Goal', arc: 'Challenge' })
    expect(termsFor('standard').tracks).toBe('Tracks')
  })
  it('the six sign-up templates exist and have 4–6 items', () => {
    for (const key of SIGNUP_TEMPLATE_KEYS) {
      const t = GOAL_TEMPLATES.find((g) => g.key === key)
      expect(t, key).toBeDefined()
      expect(t!.items.length).toBeGreaterThanOrEqual(4)
      expect(t!.items.length).toBeLessThanOrEqual(6)
    }
  })
  it('every library entry parses as a valid plan file for any start date', () => {
    for (const e of PLAN_LIBRARY) {
      const r = parsePlanFile(materializeLibraryEntry(e, '2026-11-09'))
      expect(r.errors, e.key).toEqual([])
      expect(r.counts.items).toBeGreaterThan(0)
      if (e.lengthDays) {
        const arcs = r.file!.tracks.flatMap((t) => t.plans).filter((p) => p.kind === 'time_bound')
        expect(arcs.length, e.key).toBeGreaterThan(0)
        expect(arcs.every((p) => p.start_date === '2026-11-09' && Boolean(p.end_date)), e.key).toBe(true)
      }
    }
    const winter = materializeLibraryEntry(PLAN_LIBRARY[0], '2026-11-09') as { tracks: { plans: { end_date?: string }[] }[] }
    expect(winter.tracks[0].plans[1].end_date).toBe('2027-02-06')
  })
  it('the weekly share card names the Arc week', () => {
    const p = plan({ id: 'a', arc_name: 'Winter Arc', start_date: '2026-10-26', end_date: '2027-01-23' })
    const h = item({ id: 'h', plan_id: 'a', type: 'habit', schedule: { frequency: 'daily' } as never })
    const card = buildWeekCard({ items: [h], plans: [p], completions: [{ item_id: 'h', completed_date: '2026-11-02' }, { item_id: 'h', completed_date: '2026-11-03' }], now: NOW, arcName: 'Winter Arc', planIds: new Set(['a']) })
    expect(card.title).toBe('Week 2 of my Winter Arc')
    expect(card.done).toBe(2)
    expect(card.planned).toBe(7)
    expect(card.activeDays).toBe(2)
  })
})

describe('routines: a habit with steps is ticked off again every day', () => {
  const steps = [
    { id: 'a', label: 'Water', done: true },
    { id: 'b', label: 'Stretch', done: false },
  ]
  it('shows stored ticks only for the day they were made', async () => {
    const { effectiveHabitSteps, isRoutine } = await import('@tracknow/core/domain/checklist')
    const routine = { type: 'habit', checklist_entries: steps, count_date: '2026-11-08' }
    expect(isRoutine(routine)).toBe(true)
    expect(effectiveHabitSteps(routine, '2026-11-08', false).map((s) => s.done)).toEqual([true, false])
    // A new day starts with every step open.
    expect(effectiveHabitSteps(routine, '2026-11-09', false).map((s) => s.done)).toEqual([false, false])
    // Completed for the day: every step shows done.
    expect(effectiveHabitSteps(routine, '2026-11-08', true).every((s) => s.done)).toBe(true)
    // Un-completed after a full day of ticks: open again rather than "all ticked but not done".
    const stale = { checklist_entries: steps.map((s) => ({ ...s, done: true })), count_date: '2026-11-08' }
    expect(effectiveHabitSteps(stale, '2026-11-08', false).some((s) => s.done)).toBe(false)
    expect(effectiveHabitSteps({ checklist_entries: null }, '2026-11-08', false)).toEqual([])
  })
  it('plan files can give habits steps; the library routines use them', () => {
    const r = parsePlanFile({
      format: 'tracknow.plan.v1',
      tracks: [{ name: 'T', plans: [{ name: 'P', kind: 'ongoing', items: [{ type: 'habit', name: 'Night routine', steps: ['Tidy', 'Phone away'] }, { type: 'task', name: 'X', steps: ['ignored'] }] }] }],
    })
    expect(r.errors).toEqual([])
    expect(r.file!.tracks[0].plans[0].items[0].steps).toEqual(['Tidy', 'Phone away'])
    expect(r.file!.tracks[0].plans[0].items[1].steps).toEqual([])
    const routines = parsePlanFile(materializeLibraryEntry(PLAN_LIBRARY.find((e) => e.key === 'morning-night')!, '2026-11-09'))
    expect(routines.file!.tracks[0].plans[0].items[0].steps.length).toBeGreaterThan(2)
  })
})

describe('activity heatmap', () => {
  it('lays days out in Mon–Sun weeks ending with the current week', async () => {
    const { buildActivityHeatmap, countByDate } = await import('@tracknow/core/domain/heatmap')
    const rows = [
      { item_id: 'a', completed_date: '2026-11-06' },
      { item_id: 'b', completed_date: '2026-11-07' },
      { item_id: 'a', completed_date: '2026-11-07' },
      { item_id: 'a', completed_date: '2026-11-08' },
      { item_id: 'a', completed_date: '2026-10-20' },
    ]
    const map = buildActivityHeatmap({ counts: countByDate(rows), now: NOW, weeks: 4, highlight: { start: '2026-11-02', end: '2026-11-08' } })
    expect(map.weeks).toHaveLength(4)
    expect(map.weeks.at(-1)!.start).toBe('2026-11-02') // Monday of the week containing Sun 8 Nov
    expect(map.weeks[0].start).toBe('2026-10-12')
    expect(map.weeks.every((w) => w.days.length === 7)).toBe(true)
    expect(map.total).toBe(5)
    expect(map.activeDays).toBe(4)
    expect(map.currentStreak).toBe(3)
    expect(map.longestStreak).toBe(3)
    expect(map.bestDay).toEqual({ date: '2026-11-07', count: 2 })
    const cell = (d: string) => map.weeks.flatMap((w) => w.days).find((c) => c.date === d)!
    expect(cell('2026-11-07').level).toBe(4)
    expect(cell('2026-11-06').level).toBe(2)
    expect(cell('2026-11-05').level).toBe(0)
    expect(cell('2026-11-08').isToday).toBe(true)
    expect(cell('2026-11-03').inRange).toBe(true)
    expect(cell('2026-10-20').inRange).toBe(false)
    expect(map.months.some((m) => m.label === 'Nov')).toBe(true)
  })

  it('keeps a run alive while today is still open, hides the future, and filters rows', async () => {
    const { buildActivityHeatmap, countByDate } = await import('@tracknow/core/domain/heatmap')
    const rows = [
      { item_id: 'a', completed_date: '2026-11-06' },
      { item_id: 'b', completed_date: '2026-11-07' },
    ]
    const map = buildActivityHeatmap({ counts: countByDate(rows), now: NOW, weeks: 2 })
    expect(map.currentStreak).toBe(2)
    const monday = new Date(2026, 10, 9, 9)
    const next = buildActivityHeatmap({ counts: countByDate(rows), now: monday, weeks: 1 })
    expect(next.weeks[0].days.filter((c) => c.isFuture)).toHaveLength(6)
    expect(next.currentStreak).toBe(0)
    expect(countByDate(rows, (r) => r.item_id === 'a')).toEqual({ '2026-11-06': 1 })
    expect(buildActivityHeatmap({ counts: {}, now: NOW, weeks: 3 })).toMatchObject({ total: 0, activeDays: 0, bestDay: null, currentStreak: 0 })
  })
})

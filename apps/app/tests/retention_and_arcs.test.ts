import { describe, expect, it } from 'vitest'
import type { ExecutionItem, Plan } from '@tracknow/core/types/domain'
import { buildRetention } from '@tracknow/core/domain/retention'
import { arcKey, arcNames, groupArcs } from '@tracknow/core/domain/arcs'
import { parsePlanFile, PLAN_FILE_FORMAT } from '@tracknow/core/domain/planImport'
import { addDaysTo } from '@tracknow/core/domain/schedule'

const item = (over: Partial<ExecutionItem>): ExecutionItem => ({
  id: 'x', plan_id: 'p', user_id: 'u', type: 'habit', name: 'x', description: null, status: 'todo',
  priority: 'medium', due_date: null, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z', ...over,
})
const plan = (over: Partial<Plan>): Plan => ({
  id: 'p', track_id: 't', user_id: 'u', name: 'P', description: null, start_date: null, end_date: null,
  status: 'active', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z', ...over,
})
// Sunday 8 Nov 2026 (local noon).
const NOW = new Date(2026, 10, 8, 12)
const days = (from: string, to: string) => {
  const out: string[] = []
  for (let d = from; d <= to; d = addDaysTo(d, 1)) out.push(d)
  return out
}

describe('retention', () => {
  it('daily habit done every day → 100% each week, kept, on track every week', () => {
    const h = item({ id: 'h', schedule: { frequency: 'daily' } as never })
    const completions = days('2026-09-01', '2026-11-08').map((d) => ({ item_id: 'h', completed_date: d }))
    const r = buildRetention({ items: [h], plans: [plan({})], completions, now: NOW, weeks: 4 })
    expect(r.weeks.map((w) => w.percent)).toEqual([100, 100, 100, 100])
    expect(r.weeks.at(-1)!.partial).toBe(true)
    expect(r.habits[0].status).toBe('kept')
    expect(r.habits[0].weeksOnTrack).toBe(4)
    expect(r.kept).toBe(1)
    expect(r.established).toBe(1)
  })

  it('habit stopped two weeks ago → dropped, and the trend is slipping', () => {
    const h = item({ id: 'h' })
    const completions = days('2026-09-01', '2026-10-24').map((d) => ({ item_id: 'h', completed_date: d }))
    const r = buildRetention({ items: [h], plans: [plan({})], completions, now: NOW, weeks: 6 })
    expect(r.habits[0].status).toBe('dropped')
    expect(r.habits[0].weeksOnTrack).toBe(0)
    expect(r.habits[0].bestWeeksOnTrack).toBeGreaterThanOrEqual(3)
    expect(r.habits[0].lastDone).toBe('2026-10-24')
    expect(r.trend).toBe('slipping')
  })

  it('weekly-target habit (3×/week) met each week is 100%; extra sessions do not inflate it', () => {
    const h = item({ id: 'h', schedule: { frequency: 'weekly', times_per_week: 3 } as never })
    const completions = ['2026-10-19', '2026-10-26', '2026-11-02'].flatMap((mon) =>
      [0, 1, 2, 3].map((i) => ({ item_id: 'h', completed_date: addDaysTo(mon, i) })),
    )
    const r = buildRetention({ items: [h], plans: [plan({})], completions, now: NOW, weeks: 3 })
    expect(r.weeks.map((w) => [w.planned, w.done, w.percent])).toEqual([[3, 3, 100], [3, 3, 100], [3, 3, 100]])
    expect(r.habits[0].status).toBe('kept')
  })

  it('fixed-day habit counts only scheduled days; a future start date means not started', () => {
    const gym = item({ id: 'g', start_date: '2026-11-02', schedule: { frequency: 'weekly', days_of_week: [1, 4] } as never })
    const later = item({ id: 'l', start_date: '2026-11-16' })
    const r = buildRetention({
      items: [gym, later], plans: [plan({})], now: NOW, weeks: 2,
      completions: [{ item_id: 'g', completed_date: '2026-11-02' }],
    })
    expect(r.weeks[1]).toMatchObject({ planned: 2, done: 1, percent: 50 })
    expect(r.weeks[0].planned).toBe(0)
    expect(r.habits.find((x) => x.item.id === 'l')!.status).toBe('not_started')
    expect(r.habits.find((x) => x.item.id === 'g')!.status).toBe('new')
  })

  it('dated tasks count in the week they were due; paused Plans are left out', () => {
    const t1 = item({ id: 't1', type: 'task', due_date: '2026-11-03', status: 'done' })
    const t2 = item({ id: 't2', type: 'task', due_date: '2026-11-04' })
    const paused = item({ id: 'hp', plan_id: 'pp' })
    const r = buildRetention({
      items: [t1, t2, paused], plans: [plan({}), plan({ id: 'pp', status: 'paused' })], now: NOW, weeks: 1, completions: [],
    })
    expect(r.weeks[0]).toMatchObject({ planned: 2, done: 1, percent: 50 })
    expect(r.byPlan.map((p) => p.plan.id)).toEqual(['p'])
    expect(r.habits).toEqual([])
  })

  it('an Arc that ended stops counting after its end date', () => {
    const h = item({ id: 'h' })
    const r = buildRetention({
      items: [h], plans: [plan({ start_date: '2026-10-01', end_date: '2026-11-01' })], now: NOW, weeks: 2,
      completions: days('2026-10-26', '2026-11-01').map((d) => ({ item_id: 'h', completed_date: d })),
    })
    expect(r.weeks[1].planned).toBe(0)
    expect(r.weeks[0].percent).toBe(100)
  })
})

describe('arcs', () => {
  it('groups Plans across Tracks by arc name (case/space-insensitive)', () => {
    const plans = [
      plan({ id: 'a', track_id: 't1', name: 'Fitness', arc_name: 'Winter Arc 2026', start_date: '2026-11-09', end_date: '2027-02-06' }),
      plan({ id: 'b', track_id: 't2', name: 'Income', arc_name: ' winter  arc 2026 ', start_date: '2026-11-09', end_date: '2027-02-06' }),
      plan({ id: 'c', track_id: 't3', name: 'Laundry', arc_name: null }),
    ]
    const items = [
      { id: 'i1', plan_id: 'a', type: 'task', status: 'done' },
      { id: 'i2', plan_id: 'b', type: 'task', status: 'todo' },
      { id: 'i3', plan_id: 'c', type: 'task', status: 'todo' },
    ] as never
    const arcs = groupArcs(plans, items, new Date(2026, 10, 10, 12))
    expect(arcs).toHaveLength(1)
    expect(arcs[0]).toMatchObject({ name: 'Winter Arc 2026', key: 'winter arc 2026', trackIds: ['t1', 't2'], status: 'active' })
    expect(arcs[0].progress).toMatchObject({ done: 1, total: 2, percent: 50 })
    expect(arcs[0].timeline).toMatchObject({ day: 2, totalDays: 90 })
    expect(arcNames(plans)).toEqual(['Winter Arc 2026'])
    expect(arcKey('  A  B ')).toBe('a b')
  })

  it('an Arc whose Plans are all completed is completed', () => {
    const arcs = groupArcs([plan({ arc_name: 'X', status: 'completed' })], [])
    expect(arcs[0].status).toBe('completed')
  })

  it('plan files: top-level arc applies to every Plan unless the Plan sets its own or null', () => {
    const r = parsePlanFile({
      format: PLAN_FILE_FORMAT,
      arc: 'Spring Arc',
      tracks: [
        {
          name: 'T',
          plans: [
            { name: 'A', start_date: '2026-12-01', end_date: '2027-01-01' },
            { name: 'B', kind: 'ongoing', arc: null },
            { name: 'C', kind: 'ongoing', arc: 'Other' },
          ],
        },
      ],
    })
    expect(r.errors).toEqual([])
    expect(r.file!.tracks[0].plans.map((p) => p.arc_name)).toEqual(['Spring Arc', null, 'Other'])
  })
})

import { describe, expect, it } from 'vitest'
import { parsePlanFile } from '@tracknow/core/domain/planImport'

/**
 * A full data export (tracknow.export.v1, Settings → Your data) can be fed straight back
 * into "Import a plan": the bundle is reshaped and then validated like any plan file.
 * What a set-up file cannot carry is left out: completion history, archived rows, and
 * Plans that are already completed.
 */

const bundle = {
  format: 'tracknow.export.v1',
  exportedAt: '2026-11-10T08:00:00.000Z',
  tracks: [
    { id: 't1', user_id: 'u1', name: 'Health', description: 'Body', icon: 'Dumbbell', color: '#22c55e', status: 'active' },
    { id: 't2', user_id: 'u1', name: 'Old track', description: null, icon: 'Box', color: '#999999', status: 'archived' },
  ],
  plans: [
    { id: 'p1', track_id: 't1', name: 'Winter base', plan_kind: 'time_bound', status: 'active', start_date: '2026-11-01', end_date: '2027-01-30', outcome: 'Run 10k', success_criteria: 'Three runs a week', arc_name: 'Winter Arc', description: null },
    { id: 'p2', track_id: 't1', name: 'Done plan', plan_kind: 'ongoing', status: 'completed', start_date: null, end_date: null },
    { id: 'p3', track_id: 't2', name: 'Plan in archived track', plan_kind: 'ongoing', status: 'active' },
  ],
  items: [
    {
      id: 'i1', plan_id: 'p1', type: 'habit', name: 'Morning run', description: null, priority: 'high', status: 'todo',
      due_date: null, start_date: '2026-11-02', target_count: 1, unit: null,
      schedule: { frequency: 'weekly', days_of_week: null, time_of_day: 'morning', reminder_time: '07:30', times_per_week: 3 },
      checklist_entries: [{ id: 'a', label: 'Stretch', done: true }, { id: 'b', label: 'Run', done: false }],
    },
    { id: 'i2', plan_id: 'p1', type: 'task', name: 'Buy shoes', description: 'Trail', priority: 'medium', status: 'done', due_date: '2026-11-20', start_date: null, target_count: 1, unit: null, schedule: null },
    { id: 'i3', plan_id: 'p1', type: 'task', name: 'Old task', status: 'archived', priority: 'low', due_date: null, start_date: null },
  ],
  completions: [{ item_id: 'i1', completed_date: '2026-11-09' }],
}

describe('importing a data export', () => {
  const parsed = parsePlanFile(JSON.stringify(bundle))

  it('parses cleanly and keeps only what a set-up file carries', () => {
    expect(parsed.errors).toEqual([])
    expect(parsed.counts).toEqual({ tracks: 1, plans: 1, items: 2 })
    const track = parsed.file!.tracks[0]
    expect(track).toMatchObject({ name: 'Health', icon: 'Dumbbell', color: '#22c55e' })
    expect(track.plans.map((p) => p.name)).toEqual(['Winter base'])
  })

  it('keeps the Plan shape: kind, dates, outcome and Arc', () => {
    expect(parsed.file!.tracks[0].plans[0]).toMatchObject({
      kind: 'time_bound',
      start_date: '2026-11-01',
      end_date: '2027-01-30',
      outcome: 'Run 10k',
      success_criteria: 'Three runs a week',
      arc_name: 'Winter Arc',
    })
  })

  it('keeps habit schedules and routine steps; archived items are left out', () => {
    const items = parsed.file!.tracks[0].plans[0].items
    expect(items.map((i) => i.name)).toEqual(['Morning run', 'Buy shoes'])
    expect(items[0].schedule).toMatchObject({ frequency: 'weekly', times_per_week: 3, time_of_day: 'morning', reminder_time: '07:30' })
    expect(items[0].steps).toEqual(['Stretch', 'Run'])
    expect(items[1]).toMatchObject({ due_date: '2026-11-20', description: 'Trail' })
  })

  it('an unknown format names both accepted formats', () => {
    const r = parsePlanFile(JSON.stringify({ format: 'something.else', tracks: [] }))
    expect(r.file).toBeNull()
    expect(r.errors[0]).toContain('tracknow.plan.v1')
    expect(r.errors[0]).toContain('tracknow.export.v1')
  })

  it('an export with nothing importable says so instead of guessing', () => {
    const r = parsePlanFile(JSON.stringify({ format: 'tracknow.export.v1', tracks: [{ id: 't', name: 'X', status: 'archived' }], plans: [], items: [], completions: [] }))
    expect(r.file).toBeNull()
    expect(r.errors[0]).toContain('"tracks" must be a non-empty list')
  })
})

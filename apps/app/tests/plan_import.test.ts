import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAN_FILE_FORMAT, parsePlanFile } from '@tracknow/core/domain/planImport'

const root = resolve(__dirname, '../../..')

describe('plan file import (tracknow.plan.v1)', () => {
  it('parses the committed example: Arcs, an ongoing Plan, weekly targets and checklist steps', () => {
    const r = parsePlanFile(readFileSync(resolve(root, 'docs/examples/90-day-arc.plan.json'), 'utf8'))
    expect(r.errors).toEqual([])
    expect(r.counts).toEqual({ tracks: 2, plans: 3, items: 10 })
    const [fitness, ongoing] = r.file!.tracks[0].plans
    expect(fitness).toMatchObject({ kind: 'time_bound', end_date: '2027-04-03' })
    expect(ongoing).toMatchObject({ kind: 'ongoing', end_date: null })
    const run = fitness.items.find((i) => i.name === 'Run')!
    expect(run.schedule).toMatchObject({ frequency: 'weekly', days_of_week: null, times_per_week: 3 })
    const strength = fitness.items.find((i) => i.name === 'Strength training')!
    expect(strength.schedule).toMatchObject({ days_of_week: [2, 5], reminder_time: '18:00', times_per_week: null })
    expect(r.file!.tracks[1].plans[0].items[1].steps).toHaveLength(3)
  })

  it('reports every problem instead of guessing', () => {
    const r = parsePlanFile({
      format: PLAN_FILE_FORMAT,
      tracks: [
        {
          name: 'X',
          plans: [
            { name: 'Arc', kind: 'time_bound', start_date: '2027-02-30' },
            { name: 'P', items: [{ type: 'chore', name: 'a' }, { type: 'habit', name: 'b', schedule: { times_per_week: 9, reminder_time: '25:00' } }] },
          ],
        },
      ],
    })
    expect(r.file).toBeNull()
    expect(r.errors.join('\n')).toMatch(/start_date must be YYYY-MM-DD/)
    expect(r.errors.join('\n')).toMatch(/an Arc needs an end_date/)
    expect(r.errors.join('\n')).toMatch(/"type" must be one of/)
    expect(r.errors.join('\n')).toMatch(/times_per_week must be 1–7/)
    expect(r.errors.join('\n')).toMatch(/reminder_time must be HH:MM/)
  })

  it('rejects other formats and invalid JSON', () => {
    expect(parsePlanFile('{nope').errors[0]).toMatch(/not valid JSON/)
    expect(parsePlanFile({ format: 'other', tracks: [] }).errors[0]).toMatch(/Unsupported format/)
  })

  // The owner's personal plan lives in my-plans/ (git-ignored); validate it when present.
  const personal = resolve(root, 'my-plans/winter-arc-2026.plan.json')
  it.runIf(existsSync(personal))('the personal Winter Arc file is valid', () => {
    const r = parsePlanFile(readFileSync(personal, 'utf8'))
    expect(r.errors).toEqual([])
    expect(r.counts.tracks).toBe(7)
    const arcs = r.file!.tracks.flatMap((t) => t.plans).filter((p) => p.kind === 'time_bound')
    expect(new Set(arcs.map((p) => `${p.start_date}→${p.end_date}`))).toEqual(new Set(['2026-11-09→2027-02-06']))
    // Every Arc Plan is grouped under one Arc; ongoing routines stay outside it.
    expect(new Set(arcs.map((p) => p.arc_name))).toEqual(new Set(['Winter Arc 2026']))
    const ongoing = r.file!.tracks.flatMap((t) => t.plans).filter((p) => p.kind === 'ongoing')
    expect(ongoing.every((p) => p.arc_name === null)).toBe(true)
  })
})

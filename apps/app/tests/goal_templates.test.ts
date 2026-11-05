import { describe, expect, it } from 'vitest'
import {
  GOAL_TEMPLATES,
  buildGoalItemInput,
  getGoalTemplate,
} from '@tracknow/core/constants/goalTemplates'
import { TRACK_COLORS, TRACK_ICONS } from '@tracknow/core/constants/trackTemplates'

const VALID_CATEGORIES = new Set(['fitness', 'finance', 'career', 'learning', 'business', 'custom'])
const VALID_COLORS = new Set(TRACK_COLORS.map((c) => c.value))
const VALID_ICONS = new Set<string>(TRACK_ICONS)

describe('goal templates (guided planner)', () => {
  it('has a non-empty catalog with unique keys', () => {
    expect(GOAL_TEMPLATES.length).toBeGreaterThan(0)
    const keys = GOAL_TEMPLATES.map((g) => g.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every template is well-formed and uses valid category/icon/color', () => {
    for (const g of GOAL_TEMPLATES) {
      expect(g.goal.trim().length, `${g.key} goal`).toBeGreaterThan(0)
      expect(g.summary.trim().length, `${g.key} summary`).toBeGreaterThan(0)
      expect(VALID_CATEGORIES.has(g.category), `${g.key} category ${g.category}`).toBe(true)
      expect(VALID_COLORS.has(g.color), `${g.key} color ${g.color}`).toBe(true)
      expect(VALID_ICONS.has(g.icon), `${g.key} icon ${g.icon}`).toBe(true)
      expect(g.track.name.trim().length, `${g.key} track name`).toBeGreaterThan(0)
      expect(g.plan.name.trim().length, `${g.key} plan name`).toBeGreaterThan(0)
      expect(g.items.length, `${g.key} items`).toBeGreaterThan(0)

      const itemKeys = g.items.map((i) => i.key)
      expect(new Set(itemKeys).size, `${g.key} item keys unique`).toBe(itemKeys.length)

      for (const item of g.items) {
        expect(item.name.trim().length, `${g.key}/${item.key} name`).toBeGreaterThan(0)
        if (item.type === 'habit') {
          expect(item.cadence, `${g.key}/${item.key} habit needs cadence`).toBeDefined()
          if (item.cadence?.days_of_week) {
            for (const d of item.cadence.days_of_week) {
              expect(d, `${g.key}/${item.key} day`).toBeGreaterThanOrEqual(0)
              expect(d, `${g.key}/${item.key} day`).toBeLessThanOrEqual(6)
            }
          }
        }
      }
    }
  })

  it('getGoalTemplate resolves known keys and rejects unknown', () => {
    expect(getGoalTemplate(GOAL_TEMPLATES[0].key)?.key).toBe(GOAL_TEMPLATES[0].key)
    expect(getGoalTemplate('does-not-exist')).toBeUndefined()
  })
})

describe('buildGoalItemInput', () => {
  const ctx = { planId: 'plan-1', trackId: 'track-1' }

  it('wires plan/track ids and never leaves target_count below 1', () => {
    for (const g of GOAL_TEMPLATES) {
      for (const item of g.items) {
        const input = buildGoalItemInput(item, ctx)
        expect(input.plan_id).toBe('plan-1')
        expect(input.track_id).toBe('track-1')
        expect(input.name).toBe(item.name)
        expect(input.type).toBe(item.type)
        expect(input.target_count ?? 1).toBeGreaterThanOrEqual(1)
        expect(['low', 'medium', 'high']).toContain(input.priority)
      }
    }
  })

  it('attaches a schedule only to habits', () => {
    for (const g of GOAL_TEMPLATES) {
      for (const item of g.items) {
        const input = buildGoalItemInput(item, ctx)
        if (item.type === 'habit') {
          expect(input.schedule, `${g.key}/${item.key}`).not.toBeNull()
          expect(['daily', 'weekly']).toContain(input.schedule?.frequency)
          expect(['morning', 'afternoon', 'evening', 'anytime']).toContain(input.schedule?.time_of_day)
        } else {
          expect(input.schedule, `${g.key}/${item.key}`).toBeNull()
        }
      }
    }
  })

  it('carries counter targets with their unit (e.g. water glasses)', () => {
    const fitness = getGoalTemplate('get-fit')!
    const water = fitness.items.find((i) => i.key === 'water')!
    const input = buildGoalItemInput(water, ctx)
    expect(input.target_count).toBe(8)
    expect(input.unit).toBe('glasses')
  })
})

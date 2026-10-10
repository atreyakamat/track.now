import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildWidgetDataPayload,
  clearWidgetData,
  loadWidgetData,
  saveWidgetData,
} from '../src/services/widgetDataService'
import type { ExecutionItem } from '../src/types/domain'
import type { HabitStreakSummary } from '../src/domain/streaks'

if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

describe('Home Screen Widget Data Engine', () => {
  const userId = 'user-widget-test-id'

  const mockItems: ExecutionItem[] = [
    {
      id: 'item-1',
      user_id: userId,
      plan_id: 'plan-1',
      type: 'habit',
      name: 'Drink 2L Water',
      status: 'done',
      priority: 'medium',
      start_date: null,
      due_date: null,
      target_count: 1,
      current_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'item-2',
      user_id: userId,
      plan_id: 'plan-1',
      type: 'habit',
      name: 'Morning Jog',
      status: 'todo',
      priority: 'high',
      start_date: null,
      due_date: null,
      target_count: 1,
      current_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'item-3',
      user_id: userId,
      plan_id: 'plan-1',
      type: 'task',
      name: 'Submit Q3 Tax Filing',
      status: 'todo',
      priority: 'urgent',
      start_date: null,
      due_date: '2026-10-01', // Overdue
      target_count: 1,
      current_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  const mockStreaks: Record<string, HabitStreakSummary> = {
    'item-1': {
      itemId: 'item-1',
      currentStreak: 12,
      longestStreak: 15,
      consistencyRate: 85,
      completedToday: true,
      isActiveStreak: true,
    },
    'item-2': {
      itemId: 'item-2',
      currentStreak: 4,
      longestStreak: 6,
      consistencyRate: 60,
      completedToday: false,
      isActiveStreak: true,
    },
  }

  beforeEach(() => {
    localStorage.clear()
  })

  it('builds minimal, sanitized widget payload', async () => {
    const payload = await buildWidgetDataPayload(userId, mockItems, mockStreaks)

    expect(payload.version).toBe(1)
    expect(payload.lastUpdated).toBeDefined()
    expect(payload.progress.total).toBe(3)
    expect(payload.progress.done).toBe(1)
    expect(payload.progress.percent).toBe(33)
    expect(payload.progress.activeStreakDays).toBe(12) // Max active streak

    // Top items formatted
    expect(payload.items.length).toBeLessThanOrEqual(5)
    expect(payload.items[0].title).toBeDefined()

    // Strict privacy guarantee: no sensitive credentials or tokens
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('password')
    expect(serialized).not.toContain('access_token')
    expect(serialized).not.toContain('refresh_token')
    expect(serialized).not.toContain('supabase')
  })

  it('saves and loads widget data from cache', async () => {
    const payload = await buildWidgetDataPayload(userId, mockItems, mockStreaks)
    saveWidgetData(payload)

    const loaded = loadWidgetData()
    expect(loaded).not.toBeNull()
    expect(loaded?.version).toBe(1)
    expect(loaded?.progress.total).toBe(3)
    expect(loaded?.progress.done).toBe(1)
  })

  it('clears widget data on sign-out to guarantee privacy', async () => {
    const payload = await buildWidgetDataPayload(userId, mockItems, mockStreaks)
    saveWidgetData(payload)
    expect(loadWidgetData()).not.toBeNull()

    clearWidgetData()
    expect(loadWidgetData()).toBeNull()
  })
})

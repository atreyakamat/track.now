import { describe, expect, it } from 'vitest'
import { activeDayStreak, calcQuests, QUEST_XP, questXp } from '@tracknow/core/domain/quests'
import { calcAchievements, firstPerfectWeek } from '@tracknow/core/domain/momentum'

const c = (item_id: string, completed_date: string) => ({ item_id, completed_date })

describe('getting-started quests', () => {
  it('every quest is derived from records or an explicit local flag', () => {
    const none = calcQuests({ tracks: 0, plans: 0, items: 0, arcPlans: 0, completions: [], tourDone: false, focusUsed: false })
    expect(none.every((q) => !q.done)).toBe(true)
    expect(questXp(none)).toBe(0)

    const some = calcQuests({
      tracks: 1,
      plans: 1,
      items: 3,
      arcPlans: 0,
      completions: [c('a', '2026-11-01'), c('a', '2026-11-02'), c('b', '2026-11-03')],
      tourDone: true,
      focusUsed: false,
    })
    const done = Object.fromEntries(some.map((q) => [q.id, q.done]))
    expect(done).toEqual({
      tour: true,
      first_track: true,
      first_plan: true,
      three_items: true,
      first_completion: true,
      focus: false,
      arc: false,
      three_day_run: true,
    })
    expect(questXp(some)).toBe(6 * QUEST_XP)
  })

  it('active-day streak counts consecutive days ending today or yesterday', () => {
    const rows = [c('a', '2026-11-05'), c('b', '2026-11-06'), c('a', '2026-11-07')]
    expect(activeDayStreak(rows, '2026-11-07', '2026-11-06')).toBe(3)
    expect(activeDayStreak(rows, '2026-11-08', '2026-11-07')).toBe(3) // nothing yet today, streak alive
    expect(activeDayStreak(rows, '2026-11-09', '2026-11-08')).toBe(0) // broke
    expect(activeDayStreak([], '2026-11-09', '2026-11-08')).toBe(0)
  })
})

describe('new achievements', () => {
  const habit = { id: 'h', status: 'todo' as const, schedule: { frequency: 'weekly', days_of_week: [1, 3, 5] } as never, start_date: '2026-10-01' }

  it('perfect week: every scheduled fixed-day habit done in a finished Mon–Sun week', () => {
    // Week of Mon 2 Nov 2026: Mon 2, Wed 4, Fri 6.
    const full = [c('h', '2026-11-02'), c('h', '2026-11-04'), c('h', '2026-11-06')]
    expect(firstPerfectWeek([habit], full, '2026-11-10')).toBe('2026-11-02')
    expect(firstPerfectWeek([habit], full.slice(0, 2), '2026-11-10')).toBeNull()
    // The current week never counts, even when complete so far.
    expect(firstPerfectWeek([habit], full, '2026-11-06')).toBeNull()
  })

  it('comeback, arc builder, explorer and century', () => {
    const items = [{ id: 'h', type: 'habit' as const }]
    const dates = Array.from({ length: 100 }, (_, i) => c('h', `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`))
    const a = calcAchievements({
      completions: [...dates, c('h', '2026-06-01'), c('h', '2026-06-15')],
      items,
      plans: [{ id: 'p', status: 'active', start_date: null, end_date: null, arc_name: 'Winter Arc' } as never],
      longestDailyStreak: 0,
      extras: { tourCompleted: true },
      now: new Date(2026, 10, 8),
    })
    const earned = Object.fromEntries(a.map((x) => [x.id, x.earned]))
    expect(earned).toMatchObject({ explorer: true, arc_builder: true, comeback: true, century: true, perfect_week: false })
    expect(a.find((x) => x.id === 'comeback')?.earnedOn).toBe('2026-06-01')
    expect(a).toHaveLength(14)
  })
})

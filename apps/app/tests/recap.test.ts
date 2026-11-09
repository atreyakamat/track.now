import { describe, expect, it } from 'vitest'
import { buildWeeklyRecap, daysSinceLastCompletion, encouragement, newlyEarned, recapHeadline } from '@tracknow/core/domain/recap'
import { calcAchievements } from '@tracknow/core/domain/momentum'

// 2026-11-11 is a Wednesday. The last finished week is Mon 2026-11-02 to Sun 2026-11-08.
const TODAY = '2026-11-11'
const c = (item: string, date: string) => ({ item_id: item, completed_date: date })

describe('buildWeeklyRecap', () => {
  it('counts last week once per item per day and finds the best day', () => {
    const r = buildWeeklyRecap([c('a', '2026-11-02'), c('a', '2026-11-02'), c('b', '2026-11-02'), c('a', '2026-11-04'), c('a', '2026-11-09')], TODAY)
    expect(r).toMatchObject({ weekStart: '2026-11-02', done: 3, activeDays: 2, bestDay: { date: '2026-11-02', count: 2 } })
  })

  it('says nothing for an empty week (a recap of nothing is just a reminder of a miss)', () => {
    expect(buildWeeklyRecap([c('a', '2026-11-09')], TODAY)).toBeNull()
    expect(buildWeeklyRecap([], TODAY)).toBeNull()
  })

  it('compares with the week before, and calls the first week new', () => {
    const prev = [c('a', '2026-10-26'), c('b', '2026-10-27')]
    expect(buildWeeklyRecap([...prev, c('a', '2026-11-02'), c('a', '2026-11-03'), c('a', '2026-11-04')], TODAY)?.trend).toBe('up')
    expect(buildWeeklyRecap([...prev, c('a', '2026-11-02'), c('a', '2026-11-03')], TODAY)?.trend).toBe('same')
    expect(buildWeeklyRecap([...prev, c('a', '2026-11-02')], TODAY)?.trend).toBe('down')
    expect(buildWeeklyRecap([c('a', '2026-11-02')], TODAY)?.trend).toBe('new')
  })

  it('never words a drop as a failure', () => {
    const down = buildWeeklyRecap([c('a', '2026-10-26'), c('b', '2026-10-27'), c('a', '2026-11-02')], TODAY)!
    expect(recapHeadline(down)).toBe('Last week you finished 1 thing across 1 day.')
  })
})

describe('encouragement', () => {
  const base = { done: 0, total: 4, daysAway: 1, streak: 0 }
  it('welcomes someone back after a week away instead of scolding', () => {
    expect(encouragement({ ...base, daysAway: 9 })).toMatch(/^Welcome back/)
  })
  it('follows the real state of the day', () => {
    expect(encouragement({ ...base, done: 4 })).toBe('All 4 done. Enjoy the rest of your day.')
    expect(encouragement({ ...base, done: 3 })).toBe('One to go.')
    expect(encouragement({ ...base, done: 2 })).toBe('Past halfway: 2 of 4 done.')
    expect(encouragement({ ...base, done: 1, streak: 5 })).toBe('5 active days in a row. 3 left today.')
    expect(encouragement({ ...base, done: 1 })).toBe('1 done, 3 to go.')
    expect(encouragement({ ...base, done: 0, total: 1 })).toBe('One thing today. Start with it.')
  })
  it('stays silent when there is nothing today', () => {
    expect(encouragement({ ...base, total: 0 })).toBeNull()
  })
})

describe('daysSinceLastCompletion', () => {
  it('counts whole days before today and ignores today', () => {
    expect(daysSinceLastCompletion([c('a', '2026-11-01'), c('a', TODAY)], TODAY)).toBe(10)
    expect(daysSinceLastCompletion([c('a', TODAY)], TODAY)).toBeNull()
  })
})

describe('achievement announcements', () => {
  const input = (completions: ReturnType<typeof c>[], longestDailyStreak = 0) => ({
    completions,
    items: [{ id: 'a', type: 'habit' as const }],
    plans: [],
    longestDailyStreak,
    now: new Date(2026, 10, 11, 12),
  })

  it('announces only what is new since the last record', () => {
    const before = calcAchievements(input([c('a', '2026-11-10')]))
    const after = calcAchievements(input([c('a', '2026-11-10')], 30))
    const seen = before.filter((a) => a.earned).map((a) => a.id)
    expect(newlyEarned(after, seen).map((a) => a.id)).toEqual(['first_week_streak', 'streak_30'])
    expect(newlyEarned(after, after.filter((a) => a.earned).map((a) => a.id))).toEqual([])
  })

  it('announces nothing on the very first run (the caller records what is already earned)', () => {
    expect(newlyEarned(calcAchievements(input([c('a', '2026-11-10')], 30)), null)).toEqual([])
  })

  it('the two new achievements need what they say', () => {
    const find = (id: string, longest: number) => calcAchievements(input([], longest)).find((a) => a.id === id)!
    expect(find('streak_30', 29).earned).toBe(false)
    expect(find('streak_30', 30).earned).toBe(true)
    const items = ['m1', 'm2', 'm3', 'm4', 'm5'].map((id) => ({ id, type: 'milestone' as const }))
    const five = calcAchievements({ ...input([]), items, completions: items.map((i) => c(i.id, '2026-11-01')) })
    expect(five.find((a) => a.id === 'five_milestones')?.earned).toBe(true)
    const four = calcAchievements({ ...input([]), items: items.slice(0, 4), completions: items.slice(0, 4).map((i) => c(i.id, '2026-11-01')) })
    expect(four.find((a) => a.id === 'five_milestones')?.earned).toBe(false)
  })
})

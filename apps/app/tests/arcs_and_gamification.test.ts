import { beforeEach, describe, expect, it } from 'vitest'
import type { ExecutionItem, Plan } from '@tracknow/core/types/domain'
import { groupTodayItems, todaySummary, daysLeftInWeek } from '@tracknow/core/domain/today'
import { calcProgress, summarizeTrack } from '@tracknow/core/domain/progress'
import { calcHabitStreak } from '@tracknow/core/domain/streaks'
import { calcHabitAdherence } from '@tracknow/core/domain/analytics'
import { hasStarted, isHabitDueOn, isHabitRequiredToday, weekStartOf, weeklyTargetStatus } from '@tracknow/core/domain/schedule'
import { summarizeDay } from '@tracknow/core/domain/briefing'
import {
  arcEndDate,
  buildPlanOutcomeReport,
  isDueForReview,
  nextPlanStatuses,
  planKindOf,
  planTimeline,
} from '@tracknow/core/domain/plans'
import {
  DAILY_ONE_OFF_CAP,
  LEVELS,
  calcAchievements,
  calcMomentum,
  computeXp,
  levelFor,
} from '@tracknow/core/domain/momentum'
import { checklistProgress, normalizeChecklistEntries, toggleChecklistEntry } from '@tracknow/core/domain/checklist'
import {
  isLegacySchema,
  isMissingColumnError,
  resetSchemaCompat,
  writeWithOptionalColumns,
} from '@tracknow/core/services/schemaCompat'

const item = (over: Partial<ExecutionItem>): ExecutionItem => ({
  id: 'x',
  plan_id: 'p',
  user_id: 'u',
  type: 'task',
  name: 'x',
  description: null,
  status: 'todo',
  priority: 'medium',
  due_date: null,
  created_at: '2026-11-01T08:00:00Z',
  updated_at: '2026-11-01T08:00:00Z',
  ...over,
})

const plan = (over: Partial<Plan>): Plan => ({
  id: 'p',
  track_id: 't',
  user_id: 'u',
  name: 'Winter Arc',
  description: null,
  start_date: null,
  end_date: null,
  status: 'active',
  created_at: '2026-11-01T08:00:00Z',
  updated_at: '2026-11-01T08:00:00Z',
  ...over,
})

const weekly = (times: number) => ({
  id: 's',
  item_id: 'x',
  frequency: 'weekly' as const,
  days_of_week: null,
  time_of_day: 'anytime',
  times_per_week: times,
  created_at: '',
})

// Wednesday 2026-11-11, 10:00 local (Winter Arc week 1 runs Mon 9 – Sun 15 Nov).
const WED = new Date(2026, 10, 11, 10, 0)

describe('90-day Arc timeline', () => {
  it('9 Nov 2026 + 90 days ends on 6 Feb 2027 (inclusive)', () => {
    expect(arcEndDate('2026-11-09', 90)).toBe('2027-02-06')
  })

  it('reports day X of N, not started and ended phases', () => {
    const arc = plan({ start_date: '2026-11-09', end_date: '2027-02-06' })
    expect(planTimeline(arc, WED)).toMatchObject({ day: 3, totalDays: 90, daysLeft: 87, phase: 'running' })
    expect(planTimeline(arc, new Date(2026, 10, 1))).toMatchObject({ phase: 'not_started', startsInDays: 8 })
    expect(planTimeline(arc, new Date(2027, 1, 10))).toMatchObject({ phase: 'ended', daysLeft: 0 })
    expect(planTimeline(plan({}), WED)).toBeNull()
  })

  it('derives kind from end date for legacy rows and respects an explicit kind', () => {
    expect(planKindOf(plan({ end_date: '2027-02-06' }))).toBe('time_bound')
    expect(planKindOf(plan({}))).toBe('ongoing')
    expect(planKindOf(plan({ plan_kind: 'recurring' }))).toBe('recurring')
  })

  it('never auto-closes a Plan past its end date — it is flagged for review instead', () => {
    const ended = plan({ end_date: '2026-11-01' })
    expect(isDueForReview(ended, WED)).toBe(true)
    expect(isDueForReview({ ...ended, status: 'completed' }, WED)).toBe(false)
    expect(isDueForReview(plan({}), WED)).toBe(false)
  })

  it('lifecycle offers pause/complete/archive from active and restore from archived', () => {
    expect(nextPlanStatuses('active')).toEqual(['paused', 'completed', 'archived'])
    expect(nextPlanStatuses('archived')).toEqual(['active'])
    expect(nextPlanStatuses('draft')).toContain('active')
  })
})

describe('start dates (gym begins 16 Nov inside an Arc that starts 9 Nov)', () => {
  const gym = item({ id: 'gym', type: 'habit', start_date: '2026-11-16', schedule: { ...weekly(0), times_per_week: null, days_of_week: [1, 2, 4, 5] } })

  it('is upcoming before its start date and never counts against today', () => {
    expect(hasStarted(gym, '2026-11-11')).toBe(false)
    const groups = groupTodayItems([gym], new Set(), WED)
    expect(groups.upcoming.map((i) => i.id)).toEqual(['gym'])
    expect(calcProgress([gym], { completedTodayIds: new Set(), now: WED })).toEqual({ total: 0, done: 0, percent: 0 })
  })

  it('becomes due on its first scheduled day', () => {
    const monday = new Date(2026, 10, 16, 7, 0)
    expect(groupTodayItems([gym], new Set(), monday).dueToday.map((i) => i.id)).toEqual(['gym'])
    expect(isHabitDueOn(gym, '2026-11-16')).toBe(true)
  })

  it('streak consistency is measured from the start date, not creation', () => {
    const s = calcHabitStreak('gym', gym.schedule, ['2026-11-16'], new Date(2026, 10, 16, 20), 90, '2026-11-16')
    expect(s.consistencyRate).toBe(100)
    expect(s.currentStreak).toBe(1)
  })
})

describe('weekly-target habits ("2 videos a week, any day")', () => {
  const videos = item({ id: 'v', type: 'habit', schedule: weekly(2) })

  it('counts sessions in the Mon–Sun week', () => {
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09')
    expect(weeklyTargetStatus(videos.schedule, ['2026-11-09', '2026-11-08'], '2026-11-11')).toMatchObject({ done: 1, remaining: 1, met: false })
  })

  it('sits in Anytime while open, Due Today when every remaining day is needed, Upcoming once met', () => {
    expect(groupTodayItems([videos], new Set(), WED, { historyByItem: {} }).anytime).toHaveLength(1)
    const saturday = new Date(2026, 10, 14, 9)
    expect(daysLeftInWeek('2026-11-14')).toBe(2)
    expect(groupTodayItems([videos], new Set(), saturday, { historyByItem: {} }).dueToday).toHaveLength(1)
    const met = { v: ['2026-11-09', '2026-11-10'] }
    expect(groupTodayItems([videos], new Set(), WED, { historyByItem: met }).upcoming).toHaveLength(1)
  })

  it('a day without a session is never a miss on its own (progress and adherence)', () => {
    expect(calcProgress([videos], { completedTodayIds: new Set(), now: WED }).total).toBe(0)
    expect(calcProgress([videos], { completedTodayIds: new Set(['v']), now: WED })).toMatchObject({ total: 1, done: 1 })
    const a = calcHabitAdherence(
      { ...videos, created_at: '2026-11-02T08:00:00Z' },
      new Set(['2026-11-03', '2026-11-05', '2026-11-10']),
      { start: '2026-11-02', end: '2026-11-11' },
      WED,
    )
    // Week of 2 Nov: 2/2. Open week of 9 Nov: only what is done so far counts (1/1).
    expect(a).toMatchObject({ expected: 3, completed: 3, rate: 100, unit: 'sessions' })
  })

  it('streak is counted in weeks and the open week never breaks it', () => {
    const s = calcHabitStreak('v', videos.schedule, ['2026-10-27', '2026-10-29', '2026-11-03', '2026-11-06'], WED, 90, '2026-10-26')
    expect(s.streakUnit).toBe('weeks')
    expect(s.currentStreak).toBe(2)
    expect(s.weekDone).toBe(0)
    const broken = calcHabitStreak('v', videos.schedule, ['2026-10-27', '2026-10-29', '2026-11-03'], WED, 90, '2026-10-26')
    expect(broken.currentStreak).toBe(0)
    expect(broken.longestStreak).toBe(1)
  })
})

describe('daily briefing counts only required habits', () => {
  it('ignores weekly-target and not-yet-started habits in "habits remaining"', () => {
    const daily = item({ id: 'd', type: 'habit', schedule: null })
    const flex = item({ id: 'f', type: 'habit', schedule: weekly(3) })
    const later = item({ id: 'l', type: 'habit', start_date: '2026-11-16', schedule: null })
    expect(isHabitRequiredToday(flex, WED)).toBe(false)
    expect(isHabitRequiredToday(later, WED)).toBe(false)
    expect(summarizeDay({ items: [daily, flex, later], completedTodayIds: [] }, WED).habitsRemaining).toBe(1)
  })
})

describe('Today focus and summary', () => {
  it('pins up to 3 focus items and excludes unscheduled habits from the day total', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => item({ id, name: id, due_date: '2026-11-11' }))
    const restDay = item({ id: 'rest', type: 'habit', schedule: { ...weekly(0), times_per_week: null, days_of_week: [1] } })
    const g = groupTodayItems([...items, restDay], new Set(), WED, { focusIds: ['a', 'b', 'c', 'd'] })
    expect(g.focus.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(g.dueToday.map((i) => i.id)).toEqual(['d'])
    expect(todaySummary(g)).toEqual({ done: 0, total: 4, percent: 0 })
  })
})

describe('Track shows every Plan (history is never hidden)', () => {
  it('lists completed and paused Plans under inactivePlans; progress uses active Plans only', () => {
    const track = { id: 't', user_id: 'u', name: 'Health', description: null, icon: 'heart', color: '#000', status: 'active' as const, created_at: '', updated_at: '' }
    const plans = [plan({ id: 'a' }), plan({ id: 'c', status: 'completed' }), plan({ id: 'z', status: 'paused' })]
    const s = summarizeTrack(track, plans, [{ id: 'i', plan_id: 'c', type: 'task', status: 'done', updated_at: '' }])
    expect(s.activePlans).toHaveLength(1)
    expect(s.inactivePlans.map((p) => p.plan.id)).toEqual(['c', 'z'])
    expect(s.progress.percent).toBe(0)
  })
})

describe('XP is derived from completion records only', () => {
  const items = [
    item({ id: 'h', type: 'habit' }),
    item({ id: 'm', type: 'milestone' }),
    ...Array.from({ length: 12 }, (_, i) => item({ id: `t${i}`, type: 'task' })),
  ]

  it('awards once per item per day (duplicates ignored) and removes points with the record', () => {
    const c = [
      { item_id: 'h', completed_date: '2026-11-10' },
      { item_id: 'h', completed_date: '2026-11-10' },
      { item_id: 'm', completed_date: '2026-11-10' },
    ]
    expect(computeXp(c, items).total).toBe(60)
    expect(computeXp(c.slice(2), items).total).toBe(50) // habit un-completed → its row is gone
    expect(computeXp([{ item_id: 'deleted', completed_date: '2026-11-10' }], items).total).toBe(0)
  })

  it('caps one-off items per day so splitting work into tiny tasks is not rewarded', () => {
    const c = Array.from({ length: 12 }, (_, i) => ({ item_id: `t${i}`, completed_date: '2026-11-10' }))
    const xp = computeXp(c, items)
    expect(xp.byType.task).toBe(DAILY_ONE_OFF_CAP * 15)
    expect(xp.capped).toBe(12 - DAILY_ONE_OFF_CAP)
  })

  it('weekly-target habits earn only up to their target each week', () => {
    const v = item({ id: 'v', type: 'habit', schedule: weekly(2) })
    const c = ['2026-11-09', '2026-11-10', '2026-11-11'].map((d) => ({ item_id: 'v', completed_date: d }))
    expect(computeXp(c, [v]).total).toBe(20)
  })

  it('a completed Plan earns its bonus only with real activity', () => {
    expect(computeXp([], [], [{ id: 'p' }], { p: 2 }).byType.plan).toBe(0)
    expect(computeXp([], [], [{ id: 'p' }], { p: 3 }).byType.plan).toBe(100)
  })
})

describe('levels', () => {
  it('maps XP to named levels with progress, and keeps scaling after level 6', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, name: 'Getting Started', progress: 0 })
    expect(levelFor(300)).toMatchObject({ level: 2, name: 'Building Momentum', progress: 50 })
    expect(levelFor(LEVELS[5].minXp)).toMatchObject({ level: 6, name: 'Sustained Progress' })
    expect(levelFor(LEVELS[5].minXp + 2500)).toMatchObject({ level: 7, name: 'Sustained Progress II' })
    expect(levelFor(-5).level).toBe(1)
  })
})

describe('momentum', () => {
  const daily = item({ id: 'd', type: 'habit', created_at: '2026-10-01T08:00:00Z', schedule: null })

  it('is transparent: 70% habit sessions + 30% active days over 14 days', () => {
    const c = Array.from({ length: 13 }, (_, i) => ({ item_id: 'd', completed_date: `2026-10-${String(29 + i > 31 ? 0 : 29 + i).padStart(2, '0')}` }))
      .filter((x) => !x.completed_date.endsWith('-00'))
    const dates = ['2026-10-29', '2026-10-30', '2026-10-31', ...Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)]
    const m = calcMomentum([daily], dates.map((d) => ({ item_id: 'd', completed_date: d })), WED)
    expect(c.length).toBeGreaterThan(0)
    expect(m.habitRate).toBe(100)
    expect(m.score).toBe(100)
    expect(m.explanation).toMatch(/13 of 13 scheduled habit sessions/)
  })

  it('does not drop in the morning because today is still pending', () => {
    const dates = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
    const m = calcMomentum([{ ...daily, created_at: '2026-11-01T08:00:00Z' }], dates.map((d) => ({ item_id: 'd', completed_date: d })), WED)
    expect(m.habitRate).toBe(100)
  })

  it('after a missed week the score reflects it honestly, without fake streaks', () => {
    const m = calcMomentum([daily], [{ item_id: 'd', completed_date: '2026-11-02' }], WED)
    expect(m.score).toBeLessThan(25)
    expect(m.label).toBe('Starting')
  })
})

describe('achievements', () => {
  it('are earned from verifiable records only', () => {
    const items = [item({ id: 'm', type: 'milestone' }), item({ id: 'h', type: 'habit' })]
    const plans = [
      plan({ id: 'arc', status: 'completed', start_date: '2026-11-09', end_date: '2027-02-06', completed_at: '2027-02-06T20:00:00Z' }),
    ]
    const dates = ['2026-11-01', '2026-11-02', '2026-11-05', '2026-11-06', '2026-11-07']
    const a = calcAchievements({
      completions: [...dates.map((d) => ({ item_id: 'h', completed_date: d })), { item_id: 'm', completed_date: '2026-11-06' }],
      items,
      plans,
      longestDailyStreak: 3,
      now: new Date(2027, 1, 7),
    })
    const earned = Object.fromEntries(a.map((x) => [x.id, x.earned]))
    expect(earned).toMatchObject({
      first_completion: true,
      first_week_streak: false,
      first_milestone: true,
      first_plan: true,
      active_30: false,
      arc_90: true,
      personal_best: true, // a 3-day run beat the earlier 2-day run
    })
    expect(a.find((x) => x.id === 'first_completion')?.earnedOn).toBe('2026-11-01')
  })

  it('nothing is earned without activity', () => {
    const a = calcAchievements({ completions: [], items: [], plans: [], longestDailyStreak: 0 })
    expect(a.every((x) => !x.earned)).toBe(true)
  })
})

describe('Plan outcome report', () => {
  it('summarises milestones, tasks, habit consistency and active days inside the Plan dates', () => {
    const arc = plan({ start_date: '2026-11-09', end_date: '2026-11-15' })
    const items = [
      item({ id: 'm', type: 'milestone', status: 'done' }),
      item({ id: 't', type: 'task', status: 'todo' }),
      item({ id: 'h', type: 'habit', name: 'Stretch', created_at: '2026-11-01T08:00:00Z' }),
    ]
    const r = buildPlanOutcomeReport(arc, items, { h: ['2026-11-08', '2026-11-09', '2026-11-10'], m: ['2026-11-12'] }, new Date(2026, 10, 20))
    expect(r.milestones).toEqual({ done: 1, total: 1 })
    expect(r.tasks).toEqual({ done: 0, total: 1 })
    expect(r.completions).toBe(3) // 8 Nov is before the Arc
    expect(r.activeDays).toBe(3)
    expect(r.habits[0]).toMatchObject({ name: 'Stretch', consistency: 29 }) // 2 of 7 days
  })
})

describe('checklist steps', () => {
  it('normalises, caps and toggles entries', () => {
    const n = normalizeChecklistEntries([{ id: 'a', label: '  Sort ', done: true }, { label: '' }, { id: 'a', label: 'Load' }, 'junk'])!
    expect(n.map((e) => e.label)).toEqual(['Sort', 'Load'])
    expect(new Set(n.map((e) => e.id)).size).toBe(2)
    expect(checklistProgress(n)).toEqual({ done: 1, total: 2, percent: 50 })
    expect(checklistProgress(toggleChecklistEntry(n, n[1].id)).done).toBe(2)
    expect(normalizeChecklistEntries(Array.from({ length: 80 }, (_, i) => ({ label: `s${i}` })))).toHaveLength(50)
    expect(normalizeChecklistEntries([])).toBeNull()
  })
})

describe('pre-migration database compatibility', () => {
  beforeEach(() => resetSchemaCompat())

  it('retries once without the new columns and reports what was dropped', async () => {
    const calls: Record<string, unknown>[] = []
    const res = await writeWithOptionalColumns<{ id: string }>(
      { name: 'Gym', start_date: '2026-11-16', checklist_entries: null },
      ['start_date', 'checklist_entries'],
      async (p) => {
        calls.push(p)
        return 'start_date' in p
          ? { data: null, error: { code: 'PGRST204', message: "Could not find the 'start_date' column" } }
          : { data: { id: '1' }, error: null }
      },
    )
    expect(res.data.id).toBe('1')
    expect(res.dropped).toEqual(['start_date'])
    expect(calls).toHaveLength(2)
    expect(isLegacySchema()).toBe(true)
  })

  it('other errors are surfaced, never retried', async () => {
    await expect(
      writeWithOptionalColumns({ start_date: 'x' }, ['start_date'], async () => ({ data: null, error: { code: '42501', message: 'denied' } })),
    ).rejects.toThrow('denied')
    expect(isMissingColumnError({ code: '42703' })).toBe(true)
    expect(isMissingColumnError({ code: '23505' })).toBe(false)
  })
})

import type { ExecutionItem, ItemType, Plan } from '../types/domain'
import { getTodayDateString } from './dates'
import { calcHabitAdherence } from './analytics'
import { planKindOf, planTimeline } from './plans'
import { addDaysTo, hasStarted, isFixedScheduleDay, weekStartOf, weeklyTarget } from './schedule'

/**
 * Quiet, transparent gamification derived ONLY from completion records
 * (track_now_item_completions, one row per item per day, enforced by a unique index).
 *
 * Because nothing is stored separately:
 * - a duplicate request cannot award points twice (the row already exists);
 * - un-completing an item deletes its completion row, so its points disappear with it;
 * - creating, editing or opening things earns nothing.
 * Task fragmentation is limited by a daily cap on one-off item points.
 */

export interface CompletionLike {
  item_id: string
  completed_date: string
}

export type XpItem = Pick<ExecutionItem, 'id' | 'type'> & Partial<Pick<ExecutionItem, 'schedule'>>

export const XP_PER_TYPE: Record<ItemType, number> = {
  habit: 10,
  task: 15,
  checklist: 15,
  project: 25,
  milestone: 50,
}
/** Bonus when a Plan is completed with real activity in it. */
export const PLAN_COMPLETION_XP = 100
/** At most this many one-off items (task/checklist/project) earn points per day. */
export const DAILY_ONE_OFF_CAP = 8
/** A completed Plan only earns its bonus when it had at least this many completions. */
export const PLAN_BONUS_MIN_COMPLETIONS = 3

export interface XpBreakdown {
  total: number
  byType: Record<ItemType | 'plan', number>
  /** Completions that earned nothing because of the caps (shown so the rule is visible). */
  capped: number
}

export function computeXp(
  completions: readonly CompletionLike[],
  items: readonly XpItem[],
  completedPlans: readonly Pick<Plan, 'id'>[] = [],
  completionsByPlan: Readonly<Record<string, number>> = {},
): XpBreakdown {
  const byId = new Map(items.map((i) => [i.id, i]))
  const byType: XpBreakdown['byType'] = { habit: 0, task: 0, checklist: 0, project: 0, milestone: 0, plan: 0 }
  const seen = new Set<string>()
  const oneOffPerDay = new Map<string, number>()
  const weeklyPerWeek = new Map<string, number>()
  let capped = 0

  const sorted = [...completions].sort((a, b) =>
    a.completed_date === b.completed_date ? a.item_id.localeCompare(b.item_id) : a.completed_date < b.completed_date ? -1 : 1,
  )
  for (const c of sorted) {
    const key = `${c.item_id}|${c.completed_date}`
    if (seen.has(key)) continue
    seen.add(key)
    const item = byId.get(c.item_id)
    if (!item) continue // item deleted: its history (and points) are gone too
    if (item.type === 'habit') {
      const target = weeklyTarget(item.schedule)
      if (target !== null) {
        const wk = `${item.id}|${weekStartOf(c.completed_date)}`
        const n = (weeklyPerWeek.get(wk) ?? 0) + 1
        weeklyPerWeek.set(wk, n)
        if (n > target) {
          capped++
          continue
        }
      }
    } else if (item.type !== 'milestone') {
      const n = (oneOffPerDay.get(c.completed_date) ?? 0) + 1
      oneOffPerDay.set(c.completed_date, n)
      if (n > DAILY_ONE_OFF_CAP) {
        capped++
        continue
      }
    }
    byType[item.type] += XP_PER_TYPE[item.type]
  }
  for (const plan of completedPlans) {
    if ((completionsByPlan[plan.id] ?? 0) >= PLAN_BONUS_MIN_COMPLETIONS) byType.plan += PLAN_COMPLETION_XP
  }
  const total = Object.values(byType).reduce((a, b) => a + b, 0)
  return { total, byType, capped }
}

export const LEVELS = [
  { level: 1, name: 'Getting Started', minXp: 0 },
  { level: 2, name: 'Building Momentum', minXp: 150 },
  { level: 3, name: 'Finding Rhythm', minXp: 450 },
  { level: 4, name: 'Consistent', minXp: 1000 },
  { level: 5, name: 'Disciplined', minXp: 2000 },
  { level: 6, name: 'Sustained Progress', minXp: 3500 },
] as const
/** After level 6 each further level needs this much more XP (never impossible, never trivial). */
export const XP_PER_LEVEL_AFTER_6 = 2500

export interface LevelInfo {
  level: number
  name: string
  xp: number
  levelStartXp: number
  nextLevelXp: number
  /** Whole-number percent towards the next level. */
  progress: number
}

export function levelFor(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp))
  const last = LEVELS[LEVELS.length - 1]
  if (safe >= last.minXp) {
    const extra = Math.floor((safe - last.minXp) / XP_PER_LEVEL_AFTER_6)
    const levelStartXp = last.minXp + extra * XP_PER_LEVEL_AFTER_6
    const nextLevelXp = levelStartXp + XP_PER_LEVEL_AFTER_6
    return {
      level: last.level + extra,
      name: extra === 0 ? last.name : `${last.name} ${toRoman(extra + 1)}`,
      xp: safe,
      levelStartXp,
      nextLevelXp,
      progress: Math.floor(((safe - levelStartXp) / XP_PER_LEVEL_AFTER_6) * 100),
    }
  }
  let idx = 0
  for (let i = 0; i < LEVELS.length; i++) if (safe >= LEVELS[i].minXp) idx = i
  const cur = LEVELS[idx]
  const next = LEVELS[idx + 1]
  return {
    level: cur.level,
    name: cur.name,
    xp: safe,
    levelStartXp: cur.minXp,
    nextLevelXp: next.minXp,
    progress: Math.floor(((safe - cur.minXp) / (next.minXp - cur.minXp)) * 100),
  }
}

function toRoman(n: number): string {
  const map: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = ''
  let rest = n
  for (const [v, s] of map) while (rest >= v) (out += s), (rest -= v)
  return out
}

// ---------------------------------------------------------------------------
// Momentum: how consistently you executed over the last 14 days.
// ---------------------------------------------------------------------------

export const MOMENTUM_WINDOW_DAYS = 14

export interface Momentum {
  /** 0–100. */
  score: number
  label: 'Starting' | 'Building' | 'Steady' | 'Strong'
  /** Scheduled habit occurrences completed in the window (null without habits). */
  habitRate: number | null
  habitExpected: number
  habitCompleted: number
  activeDays: number
  windowDays: number
  /** Plain-language formula shown to the user. */
  explanation: string
}

export type MomentumHabit = Pick<ExecutionItem, 'id' | 'type' | 'created_at' | 'schedule' | 'status'> & {
  start_date?: string | null
}

/**
 * Momentum = 70% habit consistency (scheduled occurrences completed) + 30% active days, over the
 * last 14 days. Without habits it is the share of active days. Today only counts once something
 * is done (a pending day is never a miss), so the score never drops just because it is morning.
 */
export function calcMomentum(
  habits: readonly MomentumHabit[],
  completions: readonly CompletionLike[],
  now = new Date(),
): Momentum {
  const today = getTodayDateString(now)
  const start = addDaysTo(today, -(MOMENTUM_WINDOW_DAYS - 1))
  const recent = completions.filter((c) => c.completed_date >= start && c.completed_date <= today)
  const activeSet = new Set(recent.map((c) => c.completed_date))
  const activeDays = activeSet.size
  const windowDays = activeSet.has(today) ? MOMENTUM_WINDOW_DAYS : MOMENTUM_WINDOW_DAYS - 1

  const byItem = new Map<string, Set<string>>()
  for (const c of recent) {
    const set = byItem.get(c.item_id) ?? new Set<string>()
    set.add(c.completed_date)
    byItem.set(c.item_id, set)
  }
  let habitExpected = 0
  let habitCompleted = 0
  for (const h of habits) {
    if (h.type !== 'habit' || h.status === 'archived') continue
    const a = calcHabitAdherence(h, byItem.get(h.id) ?? new Set(), { start, end: today }, now)
    habitExpected += a.expected
    habitCompleted += a.completed
  }
  const habitRate = habitExpected > 0 ? Math.round((habitCompleted / habitExpected) * 100) : null
  const activeRate = windowDays > 0 ? Math.min(100, Math.round((activeDays / windowDays) * 100)) : 0
  const score = habitRate === null ? activeRate : Math.round(0.7 * habitRate + 0.3 * activeRate)
  const label = score >= 80 ? 'Strong' : score >= 55 ? 'Steady' : score >= 25 ? 'Building' : 'Starting'
  const explanation =
    habitRate === null
      ? `Active on ${activeDays} of the last ${windowDays} days.`
      : `${habitCompleted} of ${habitExpected} scheduled habit sessions done (70%) and active on ${activeDays} of ${windowDays} days (30%), last 14 days.`
  return { score, label, habitRate, habitExpected, habitCompleted, activeDays, windowDays, explanation }
}

// ---------------------------------------------------------------------------
// Achievements: a short list, each derived from verifiable records.
// ---------------------------------------------------------------------------

export type AchievementId =
  | 'first_completion'
  | 'first_week_streak'
  | 'first_milestone'
  | 'first_plan'
  | 'active_30'
  | 'arc_90'
  | 'personal_best'
  | 'explorer'
  | 'arc_builder'
  | 'perfect_week'
  | 'comeback'
  | 'century'
  | 'streak_30'
  | 'five_milestones'

export interface Achievement {
  id: AchievementId
  title: string
  description: string
  earned: boolean
  /** Local date it was first earned, when it can be derived. */
  earnedOn: string | null
}

export interface AchievementInput {
  completions: readonly CompletionLike[]
  items: readonly XpItem[]
  plans: readonly (Pick<Plan, 'id' | 'status' | 'start_date' | 'end_date' | 'completed_at' | 'plan_kind'> & { arc_name?: string | null })[]
  /** Longest habit streak in days (from streak summaries). */
  longestDailyStreak: number
  now?: Date
  /** Facts the app knows locally (not in the database). */
  extras?: { tourCompleted?: boolean }
  /** Fixed-day habits with their start, for the "perfect week" check. */
  habits?: readonly (Pick<ExecutionItem, 'id' | 'status'> & { schedule?: ExecutionItem['schedule']; start_date?: string | null; created_at?: string })[]
}

/**
 * First finished Mon–Sun week (before the current one) in which every scheduled fixed-day
 * habit occurrence was completed, with at least 3 occurrences planned. Null when none.
 */
export function firstPerfectWeek(
  habits: NonNullable<AchievementInput['habits']>,
  completions: readonly CompletionLike[],
  today: string,
): string | null {
  const done = new Set(completions.map((c) => `${c.item_id}|${c.completed_date}`))
  const dates = completions.map((c) => c.completed_date).sort()
  if (!dates.length) return null
  const fixed = habits.filter((h) => h.status !== 'archived' && weeklyTarget(h.schedule) === null)
  if (!fixed.length) return null
  const currentWeek = weekStartOf(today)
  for (let ws = weekStartOf(dates[0]); ws < currentWeek; ws = addDaysTo(ws, 7)) {
    let planned = 0
    let missed = false
    for (const h of fixed) {
      const since = h.start_date ?? (h.created_at ? getTodayDateString(new Date(h.created_at)) : null)
      for (let i = 0; i < 7 && !missed; i++) {
        const d = addDaysTo(ws, i)
        if (since && d < since) continue
        if (!hasStarted(h, d) || !isFixedScheduleDay(h.schedule, d)) continue
        planned++
        if (!done.has(`${h.id}|${d}`)) missed = true
      }
      if (missed) break
    }
    if (!missed && planned >= 3) return ws
  }
  return null
}

export function longestRun(sortedDates: readonly string[]): { best: number; current: number; bestEndedOn: string | null } {
  let best = 0
  let run = 0
  let prev: string | null = null
  let bestEndedOn: string | null = null
  for (const d of sortedDates) {
    run = prev && addDaysTo(prev, 1) === d ? run + 1 : 1
    if (run > best) {
      best = run
      bestEndedOn = d
    }
    prev = d
  }
  return { best, current: run, bestEndedOn }
}

export function calcAchievements(input: AchievementInput): Achievement[] {
  const now = input.now ?? new Date()
  const today = getTodayDateString(now)
  const byId = new Map(input.items.map((i) => [i.id, i]))
  const dates = Array.from(new Set(input.completions.map((c) => c.completed_date))).filter((d) => d <= today).sort()
  const first = dates[0] ?? null
  const milestoneDates = input.completions
    .filter((c) => byId.get(c.item_id)?.type === 'milestone')
    .map((c) => c.completed_date)
    .sort()
  const completedPlans = input.plans.filter((p) => p.status === 'completed')
  const planDate = (p: (typeof completedPlans)[number]) =>
    p.completed_at ? getTodayDateString(new Date(p.completed_at)) : null
  const arcs = completedPlans.filter((p) => {
    if (planKindOf(p) !== 'time_bound') return false
    const t = planTimeline(p, now)
    return Boolean(t && t.totalDays >= 84)
  })

  // Personal best: a later run of active days (3+) beat an earlier best. Once earned it stays.
  let pbDate: string | null = null
  {
    let bestSoFar = 0
    let run = 0
    let prev: string | null = null
    let beatenFrom = 0
    for (const d of dates) {
      if (prev && addDaysTo(prev, 1) === d) run++
      else {
        beatenFrom = bestSoFar
        run = 1
      }
      if (!pbDate && beatenFrom > 0 && run >= 3 && run > beatenFrom) pbDate = d
      bestSoFar = Math.max(bestSoFar, run)
      prev = d
    }
  }
  const personalBest = pbDate !== null

  // Comeback: a completion after a gap of 7+ days following earlier activity.
  let comebackDate: string | null = null
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] > addDaysTo(dates[i - 1], 7)) {
      comebackDate = dates[i]
      break
    }
  }
  const arcPlans = input.plans.filter((p) => Boolean(p.arc_name?.trim()))
  const perfectWeek = input.habits ? firstPerfectWeek(input.habits, input.completions, today) : null
  const uniqueCompletions = new Set(input.completions.map((c) => `${c.item_id}|${c.completed_date}`)).size

  return [
    {
      id: 'explorer',
      title: 'Explorer',
      description: 'Take the tour of Track.now.',
      earned: Boolean(input.extras?.tourCompleted),
      earnedOn: null,
    },
    { id: 'first_completion', title: 'First step', description: 'Complete anything for the first time.', earned: Boolean(first), earnedOn: first },
    {
      id: 'first_week_streak',
      title: 'Seven in a row',
      description: 'Complete a habit on 7 scheduled days in a row.',
      earned: input.longestDailyStreak >= 7,
      earnedOn: null,
    },
    { id: 'first_milestone', title: 'Milestone reached', description: 'Achieve your first milestone.', earned: milestoneDates.length > 0, earnedOn: milestoneDates[0] ?? null },
    {
      id: 'first_plan',
      title: 'Plan complete',
      description: 'Finish a Plan and review it.',
      earned: completedPlans.length > 0,
      earnedOn: completedPlans.map(planDate).filter((d): d is string => Boolean(d)).sort()[0] ?? null,
    },
    { id: 'active_30', title: '30 active days', description: 'Do something meaningful on 30 different days.', earned: dates.length >= 30, earnedOn: dates[29] ?? null },
    {
      id: 'arc_90',
      title: 'Arc finished',
      description: 'Complete a time-bound Arc of about 90 days.',
      earned: arcs.length > 0,
      earnedOn: arcs.map(planDate).filter((d): d is string => Boolean(d)).sort()[0] ?? null,
    },
    {
      id: 'personal_best',
      title: 'Personal best',
      description: 'Beat your previous longest run of active days.',
      earned: personalBest,
      earnedOn: pbDate,
    },
    {
      id: 'perfect_week',
      title: 'Perfect week',
      description: 'Complete every scheduled habit in a Mon–Sun week (3+ planned).',
      earned: perfectWeek !== null,
      earnedOn: perfectWeek,
    },
    {
      id: 'comeback',
      title: 'Comeback',
      description: 'Return after a week or more away. Missing days never costs points.',
      earned: comebackDate !== null,
      earnedOn: comebackDate,
    },
    {
      id: 'arc_builder',
      title: 'Arc builder',
      description: 'Group Plans from different Tracks into one Arc.',
      earned: arcPlans.length > 0,
      earnedOn: null,
    },
    {
      id: 'streak_30',
      title: 'Thirty in a row',
      description: 'Complete a habit on 30 scheduled days in a row.',
      earned: input.longestDailyStreak >= 30,
      earnedOn: null,
    },
    {
      id: 'five_milestones',
      title: 'Five milestones',
      description: 'Achieve five milestones.',
      earned: new Set(milestoneDates.length ? input.completions.filter((c) => byId.get(c.item_id)?.type === 'milestone').map((c) => c.item_id) : []).size >= 5,
      earnedOn: null,
    },
    {
      id: 'century',
      title: 'Century',
      description: '100 completions, counted once per item per day.',
      earned: uniqueCompletions >= 100,
      earnedOn: uniqueCompletions >= 100 ? dates[Math.min(dates.length - 1, 99)] ?? null : null,
    },
  ]
}

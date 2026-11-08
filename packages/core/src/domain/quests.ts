import type { CompletionLike } from './momentum'
import { longestRun } from './momentum'

/**
 * Getting-started quests: a short, finite path for a new account. Every quest is checked
 * against real records (Tracks, Plans, items, completion rows); the two that cannot be
 * derived from the database (taking the tour, using Focus) are local flags the app passes in.
 * Each finished quest adds a small, one-time starter bonus to lifetime XP.
 */

export type QuestId =
  | 'tour'
  | 'first_track'
  | 'first_plan'
  | 'three_items'
  | 'first_completion'
  | 'focus'
  | 'arc'
  | 'three_day_run'

export interface Quest {
  id: QuestId
  title: string
  description: string
  xp: number
  done: boolean
  /** Where to go to do it (app path). */
  to: string
}

export const QUEST_XP = 20

export interface QuestInput {
  tracks: number
  plans: number
  items: number
  /** Plans that belong to an Arc (arc_name set) — or a time-bound Plan. */
  arcPlans: number
  completions: readonly CompletionLike[]
  tourDone: boolean
  focusUsed: boolean
}

export function calcQuests(input: QuestInput): Quest[] {
  const dates = Array.from(new Set(input.completions.map((c) => c.completed_date))).sort()
  const run = longestRun(dates).best
  return [
    { id: 'tour', title: 'Take the tour', description: 'Two minutes to see how Track.now fits together.', xp: QUEST_XP, done: input.tourDone, to: '/today?tour=1' },
    { id: 'first_track', title: 'Create a Track', description: 'One area of your life, like Health or Money.', xp: QUEST_XP, done: input.tracks > 0, to: '/tracks/new' },
    { id: 'first_plan', title: 'Start a Plan', description: 'An Arc with an end date, or an ongoing routine.', xp: QUEST_XP, done: input.plans > 0, to: '/tracks' },
    { id: 'three_items', title: 'Add 3 items', description: 'Habits, tasks, a checklist or a milestone.', xp: QUEST_XP, done: input.items >= 3, to: '/today' },
    { id: 'first_completion', title: 'Complete something', description: 'Tick anything off. That is where every point comes from.', xp: QUEST_XP, done: dates.length > 0, to: '/today' },
    { id: 'focus', title: 'Star a Focus item', description: 'Pick up to 3 things that matter most today.', xp: QUEST_XP, done: input.focusUsed, to: '/today' },
    { id: 'arc', title: 'Group Plans into an Arc', description: 'Give Plans from different Tracks one Arc name.', xp: QUEST_XP, done: input.arcPlans > 0, to: '/tracks' },
    { id: 'three_day_run', title: 'Three active days in a row', description: 'Do something meaningful on 3 consecutive days.', xp: QUEST_XP, done: run >= 3, to: '/today' },
  ]
}

export const questXp = (quests: readonly Pick<Quest, 'done' | 'xp'>[]): number =>
  quests.reduce((sum, q) => sum + (q.done ? q.xp : 0), 0)

/** Length of the current run of active days ending today or yesterday (0 when it broke). */
export function activeDayStreak(completions: readonly CompletionLike[], today: string, yesterday: string): number {
  const dates = Array.from(new Set(completions.map((c) => c.completed_date))).filter((d) => d <= today).sort()
  if (!dates.length) return 0
  const last = dates[dates.length - 1]
  if (last !== today && last !== yesterday) return 0
  return longestRun(dates).current
}

import type { AppPreferences } from '../services/preferences'

/**
 * The app's vocabulary. "Standard" is the precise model (Track → Plan → Arc); "simple" uses
 * everyday words for people who find the model unfamiliar. Only labels change — nothing else.
 */
export interface Terms {
  track: string
  tracks: string
  plan: string
  plans: string
  arc: string
  arcs: string
  ongoing: string
  /** One-line explanation of the hierarchy in this vocabulary. */
  hierarchy: string
}

export const STANDARD_TERMS: Terms = {
  track: 'Track',
  tracks: 'Tracks',
  plan: 'Plan',
  plans: 'Plans',
  arc: 'Arc',
  arcs: 'Arcs',
  ongoing: 'Ongoing',
  hierarchy: 'Tracks hold Plans; Plans hold the habits, tasks and milestones you do.',
}

export const SIMPLE_TERMS: Terms = {
  track: 'Area',
  tracks: 'Areas',
  plan: 'Goal',
  plans: 'Goals',
  arc: 'Challenge',
  arcs: 'Challenges',
  ongoing: 'Routine',
  hierarchy: 'Areas of your life hold Goals; Goals hold the habits, tasks and milestones you do.',
}

export function termsFor(naming: AppPreferences['naming']): Terms {
  return naming === 'simple' ? SIMPLE_TERMS : STANDARD_TERMS
}

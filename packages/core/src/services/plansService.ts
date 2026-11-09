import { supabase } from '../lib/supabase'
import type { ExecutionItemSummary, NewPlanInput, Plan, PlanCompletionInput, PlanStatus } from '../types/domain'
import { fetchAllPages, unwrap } from './helpers'
import {
  MIGRATION_ONLY_PLAN_STATUSES,
  PLAN_OPTIONAL_COLUMNS,
  isCheckViolation,
  writeWithOptionalColumns,
} from './schemaCompat'
import { track } from './telemetry'

const clean = (v: string | null | undefined) => {
  const t = typeof v === 'string' ? v.trim() : v
  return t ? t : null
}

/** Trims free-text Plan fields so blanks are stored as NULL. */
function normalizePlanPayload<T extends Partial<NewPlanInput>>(input: T): T {
  const out: Record<string, unknown> = { ...input }
  for (const key of ['description', 'outcome', 'success_criteria', 'arc_name'] as const) {
    if (key in out) out[key] = clean(out[key] as string | null)
  }
  return out as T
}

export async function listPlans(trackId?: string): Promise<Plan[]> {
  let query = supabase.from('track_now_plans').select('*').order('created_at', { ascending: true })
  if (trackId) {
    query = query.eq('track_id', trackId)
  }
  return unwrap(await query) as Plan[]
}

/** Loads one plan; null when it does not exist or is not visible (RLS). Failures throw. */
export async function getPlan(planId: string): Promise<Plan | null> {
  const { data, error } = await supabase.from('track_now_plans').select('*').eq('id', planId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Plan | null) ?? null
}

export async function createPlan(userId: string, input: NewPlanInput): Promise<Plan> {
  if (input.track_id) {
    const { data: track, error: trackErr } = await supabase
      .from('track_now_tracks')
      .select('id')
      .eq('id', input.track_id)
      .maybeSingle()
    if (trackErr || !track) {
      throw new Error('Unauthorized or target track does not exist')
    }
  }

  const payload = { ...normalizePlanPayload(input), user_id: userId } as Record<string, unknown>
  const { data } = await writeWithOptionalColumns<Plan>(payload, PLAN_OPTIONAL_COLUMNS, (p) =>
    supabase.from('track_now_plans').insert(p).select().single(),
  )
  track('plan_created', { kind: input.plan_kind ?? 'ongoing' })
  return data
}

export async function updatePlan(planId: string, updates: Partial<NewPlanInput>): Promise<Plan> {
  const { data } = await writeWithOptionalColumns<Plan>(
    normalizePlanPayload(updates) as Record<string, unknown>,
    PLAN_OPTIONAL_COLUMNS,
    (p) => supabase.from('track_now_plans').update(p).eq('id', planId).select().single(),
  )
  return data
}

export const STATUS_NEEDS_MIGRATION_MESSAGE =
  'Pausing and drafting Plans needs the latest database update. The Plan was not changed.'

/** Moves a Plan through its lifecycle (draft → active → paused → completed → archived). */
export async function setPlanStatus(planId: string, status: PlanStatus): Promise<Plan> {
  const { data, error } = await supabase
    .from('track_now_plans')
    .update({ status })
    .eq('id', planId)
    .select()
    .single()
  if (error) {
    if (isCheckViolation(error) && MIGRATION_ONLY_PLAN_STATUSES.has(status)) {
      throw new Error(STATUS_NEEDS_MIGRATION_MESSAGE)
    }
    throw new Error(error.message)
  }
  return data as Plan
}

/**
 * Completes a Plan and stores its completion review with it. History (items, completions)
 * is never touched, so the Plan's results stay visible afterwards.
 */
export async function completePlan(planId: string, review: PlanCompletionInput, now = new Date()): Promise<Plan> {
  const payload: Record<string, unknown> = {
    status: 'completed',
    completed_at: now.toISOString(),
    result_notes: clean(review.result_notes),
    lessons_learned: clean(review.lessons_learned),
    next_decision: clean(review.next_decision),
  }
  const { data } = await writeWithOptionalColumns<Plan>(payload, PLAN_OPTIONAL_COLUMNS, (p) =>
    supabase.from('track_now_plans').update(p).eq('id', planId).select().single(),
  )
  return data
}

/** Re-opens a completed Plan (its completion review is kept). */
export async function reopenPlan(planId: string): Promise<Plan> {
  return setPlanStatus(planId, 'active')
}

export async function setPlanArchived(planId: string, archived: boolean): Promise<void> {
  unwrap(
    await supabase
      .from('track_now_plans')
      // Archival is represented by `status` alone; the schema has no archived_at column
      // (the updated_at trigger records when the transition happened).
      .update({ status: archived ? 'archived' : 'active' })
      .eq('id', planId)
      .select('id')
      .single(),
  )
}

export async function deletePlan(planId: string): Promise<void> {
  unwrap(
    await supabase.from('track_now_plans').delete().eq('id', planId).select('id').single(),
  )
}

/**
 * Lightweight projection of all the user's execution items (for progress + activity),
 * including each habit's schedule so progress only counts habits due today. Paged so
 * large accounts are never silently truncated at the PostgREST row cap.
 */
export async function listItemSummaries(): Promise<ExecutionItemSummary[]> {
  const rows = await fetchAllPages<ExecutionItemSummary & { track_now_item_schedules?: unknown }>((from, to) =>
    supabase
      .from('track_now_execution_items')
      .select('*, track_now_item_schedules(*)')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  )
  return rows.map(({ track_now_item_schedules: sched, ...row }) => {
    const first = Array.isArray(sched) ? sched[0] : sched
    return { ...row, schedule: (first as ExecutionItemSummary['schedule']) ?? null }
  })
}

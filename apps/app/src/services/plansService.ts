import { supabase } from '@/lib/supabase/client'
import type { ExecutionItemSummary, NewPlanInput, Plan } from '@/types/domain'
import { fetchAllPages, unwrap } from './helpers'

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

  return unwrap(
    await supabase
      .from('track_now_plans')
      .insert({ ...input, user_id: userId })
      .select()
      .single(),
  ) as Plan
}

export async function updatePlan(planId: string, updates: Partial<NewPlanInput>): Promise<Plan> {
  return unwrap(
    await supabase
      .from('track_now_plans')
      .update(updates)
      .eq('id', planId)
      .select()
      .single(),
  ) as Plan
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
      .select('id, plan_id, track_id, type, status, updated_at, track_now_item_schedules(frequency, days_of_week)')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  )
  return rows.map(({ track_now_item_schedules: sched, ...row }) => {
    const first = Array.isArray(sched) ? sched[0] : sched
    return { ...row, schedule: (first as ExecutionItemSummary['schedule']) ?? null }
  })
}

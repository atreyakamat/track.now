import { supabase } from '@/lib/supabase/client'
import type { ExecutionItemSummary, NewPlanInput, Plan } from '@/types/domain'
import { unwrap } from './helpers'

export async function listPlans(trackId?: string): Promise<Plan[]> {
  let query = supabase.from('track_now_plans').select('*').order('created_at', { ascending: true })
  if (trackId) {
    query = query.eq('track_id', trackId)
  }
  return unwrap(await query) as Plan[]
}

export async function getPlan(planId: string): Promise<Plan> {
  return unwrap(
    await supabase.from('track_now_plans').select('*').eq('id', planId).single(),
  ) as Plan
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
      .update({
        status: archived ? 'archived' : 'active',
        archived_at: archived ? new Date().toISOString() : null,
      })
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

/** Lightweight projection of all the user's execution items (for progress + activity). */
export async function listItemSummaries(): Promise<ExecutionItemSummary[]> {
  return unwrap(
    await supabase.from('track_now_execution_items').select('id, plan_id, track_id, type, status, updated_at'),
  ) as ExecutionItemSummary[]
}

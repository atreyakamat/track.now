import { supabase } from '../lib/supabase'
import type { ExecutionItem, ItemType, Plan } from '../types/domain'
import { unwrap } from './helpers'

/**
 * Read-only Plan sharing for an accountability partner or coach. The owner creates a link
 * (a random token); anyone with the link sees the Plan, its items and the last 90 days of
 * completions through a SECURITY DEFINER RPC — never the owner's other data. The owner can
 * revoke the link at any time. Needs migration 20261109000000.
 */
export interface PlanShare {
  id: string
  plan_id: string
  user_id: string
  token: string
  created_at: string
  revoked_at: string | null
}

export interface SharedPlanView {
  plan: Pick<Plan, 'name' | 'description' | 'start_date' | 'end_date' | 'status' | 'outcome' | 'success_criteria' | 'arc_name'>
  track: { name: string; color: string | null; icon: string | null } | null
  owner_name: string | null
  items: (Pick<ExecutionItem, 'id' | 'name' | 'type' | 'status' | 'due_date' | 'start_date'> & { schedule?: Pick<NonNullable<ExecutionItem['schedule']>, 'frequency' | 'days_of_week' | 'times_per_week'> | null })[]
  completions: { item_id: string; completed_date: string }[]
}

export const SHARING_NEEDS_MIGRATION_MESSAGE = 'Sharing needs the latest database update (migration 20261109000000).'

function randomToken(): string {
  const bytes = new Uint8Array(24)
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function listPlanShares(planId: string): Promise<PlanShare[]> {
  const { data, error } = await supabase.from('track_now_plan_shares').select('*').eq('plan_id', planId).is('revoked_at', null)
  if (error) {
    if (error.code === '42P01' || /relation .* does not exist|schema cache/i.test(error.message)) throw new Error(SHARING_NEEDS_MIGRATION_MESSAGE)
    throw new Error(error.message)
  }
  return (data ?? []) as PlanShare[]
}

export async function createPlanShare(userId: string, planId: string): Promise<PlanShare> {
  const payload = { user_id: userId, plan_id: planId, token: randomToken() }
  const { data, error } = await supabase.from('track_now_plan_shares').insert(payload).select().single()
  if (error) {
    if (error.code === '42P01' || /relation .* does not exist|schema cache/i.test(error.message)) throw new Error(SHARING_NEEDS_MIGRATION_MESSAGE)
    throw new Error(error.message)
  }
  return data as PlanShare
}

export async function revokePlanShare(shareId: string): Promise<void> {
  unwrap(await supabase.from('track_now_plan_shares').update({ revoked_at: new Date().toISOString() }).eq('id', shareId).select())
}

/** Public: anyone with the token (no session needed). Null when the link is unknown or revoked. */
export async function getSharedPlan(token: string): Promise<SharedPlanView | null> {
  const { data, error } = await supabase.rpc('track_now_get_shared_plan', { share_token: token })
  if (error) throw new Error(error.message)
  return (data as SharedPlanView | null) ?? null
}

export const SHARE_ITEM_TYPES: ItemType[] = ['habit', 'task', 'checklist', 'milestone', 'project']

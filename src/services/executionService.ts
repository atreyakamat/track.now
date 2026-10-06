import { supabase } from '@/lib/supabase/client'
import type { ExecutionItem, ItemStatus, NewExecutionItemInput } from '@/types/domain'
import { unwrap } from './helpers'

export async function listExecutionItems(planId?: string): Promise<ExecutionItem[]> {
  let query = supabase.from('track_now_execution_items').select('*').order('created_at', { ascending: true })
  if (planId) {
    query = query.eq('plan_id', planId)
  }
  return unwrap(await query) as ExecutionItem[]
}

/**
 * Aggregates execution items from all ACTIVE tracks and all ACTIVE plans.
 * Explicitly excludes items from archived plans and archived tracks.
 */
export async function listTodayExecutionItems(): Promise<ExecutionItem[]> {
  const { data: activeTracks, error: tracksErr } = await supabase
    .from('track_now_tracks')
    .select('id')
    .eq('status', 'active')

  if (tracksErr) throw new Error(tracksErr.message)
  if (!activeTracks || activeTracks.length === 0) return []

  const activeTrackIds = activeTracks.map((t) => t.id)

  const { data: activePlans, error: plansErr } = await supabase
    .from('track_now_plans')
    .select('id')
    .in('track_id', activeTrackIds)
    .eq('status', 'active')

  if (plansErr) throw new Error(plansErr.message)
  if (!activePlans || activePlans.length === 0) return []

  const activePlanIds = activePlans.map((p) => p.id)

  const { data: items, error: itemsErr } = await supabase
    .from('track_now_execution_items')
    .select('*')
    .in('plan_id', activePlanIds)
    .neq('status', 'archived')
    .order('created_at', { ascending: true })

  if (itemsErr) throw new Error(itemsErr.message)
  return (items || []) as ExecutionItem[]
}

export async function listExecutionItemsByTrack(trackId: string): Promise<ExecutionItem[]> {
  const query = supabase
    .from('track_now_execution_items')
    .select('*')
    .eq('track_id', trackId)
    .order('created_at', { ascending: true })
  return unwrap(await query) as ExecutionItem[]
}

export async function getExecutionItem(itemId: string): Promise<ExecutionItem> {
  return unwrap(
    await supabase.from('track_now_execution_items').select('*').eq('id', itemId).single(),
  ) as ExecutionItem
}

export async function createExecutionItem(
  userId: string,
  input: NewExecutionItemInput,
): Promise<ExecutionItem> {
  return unwrap(
    await supabase
      .from('track_now_execution_items')
      .insert({
        ...input,
        user_id: userId,
        status: input.status || 'todo',
        priority: input.priority || 'medium',
      })
      .select()
      .single(),
  ) as ExecutionItem
}

export async function updateExecutionItem(
  itemId: string,
  updates: Partial<ExecutionItem>,
): Promise<ExecutionItem> {
  return unwrap(
    await supabase
      .from('track_now_execution_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single(),
  ) as ExecutionItem
}

export async function recordCompletion(
  userId: string,
  itemId: string,
  notes?: string,
  completedDate?: string,
): Promise<void> {
  const dateStr = completedDate || new Date().toISOString().split('T')[0]
  // Prevent duplicate completions for the same item and date
  const { data: existing } = await supabase
    .from('track_now_item_completions')
    .select('id')
    .eq('item_id', itemId)
    .eq('completed_date', dateStr)
    .maybeSingle()

  if (existing) {
    return
  }

  // 2. Perform insert and gracefully handle database unique constraint conflicts (23505)
  const { error } = await supabase.from('track_now_item_completions').insert({
    item_id: itemId,
    user_id: userId,
    completed_date: dateStr,
    notes: notes || null,
  })

  // Code 23505 indicates a concurrent insert satisfied the unique index; treat as idempotent success
  if (error && error.code !== '23505') {
    throw new Error(error.message)
  }
}

export async function deleteCompletionForDate(
  itemId: string,
  completedDate?: string,
): Promise<void> {
  const dateStr = completedDate || new Date().toISOString().split('T')[0]
  await supabase
    .from('track_now_item_completions')
    .delete()
    .eq('item_id', itemId)
    .eq('completed_date', dateStr)
}

export async function toggleItemStatus(
  itemId: string,
  currentStatus: ItemStatus,
  userId?: string,
): Promise<ExecutionItem> {
  const nextStatus: ItemStatus = currentStatus === 'done' ? 'todo' : 'done'
  const updated = await updateExecutionItem(itemId, { status: nextStatus })

  if (userId) {
    if (nextStatus === 'done') {
      await recordCompletion(userId, itemId).catch((err) => {
        console.warn('Could not record completion log:', err)
      })
    } else {
      await deleteCompletionForDate(itemId).catch((err) => {
        console.warn('Could not remove completion log on uncomplete:', err)
      })
    }
  }

  return updated
}

export async function deleteExecutionItem(itemId: string): Promise<void> {
  unwrap(
    await supabase.from('track_now_execution_items').delete().eq('id', itemId).select('id').single(),
  )
}

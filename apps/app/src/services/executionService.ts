import { supabase } from '@/lib/supabase/client'
import type {
  ExecutionItem,
  ItemSchedule,
  ItemStatus,
  NewExecutionItemInput,
  NewItemScheduleInput,
  UpdateExecutionItemInput,
} from '@/types/domain'
import { unwrap } from './helpers'

function mapExecutionItemRow(row: any): ExecutionItem {
  const rawSched = row.track_now_item_schedules ?? row.schedule
  const schedule: ItemSchedule | null = Array.isArray(rawSched)
    ? (rawSched[0] ?? null)
    : (rawSched ?? null)
  const { track_now_item_schedules: _t, schedule: _s, ...clean } = row
  return {
    ...clean,
    target_count: clean.target_count ?? 1,
    current_count: clean.current_count ?? 0,
    unit: clean.unit ?? null,
    schedule,
  } as ExecutionItem
}

export async function listExecutionItems(planId?: string): Promise<ExecutionItem[]> {
  let query = supabase
    .from('track_now_execution_items')
    .select('*, track_now_item_schedules(*)')
    .order('created_at', { ascending: true })
  if (planId) {
    query = query.eq('plan_id', planId)
  }
  const rows = unwrap(await query) as any[]
  return rows.map(mapExecutionItemRow)
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
    .select('*, track_now_item_schedules(*)')
    .in('plan_id', activePlanIds)
    .neq('status', 'archived')
    .order('created_at', { ascending: true })

  if (itemsErr) throw new Error(itemsErr.message)
  return ((items || []) as any[]).map(mapExecutionItemRow)
}

export async function listExecutionItemsByTrack(trackId: string): Promise<ExecutionItem[]> {
  const query = supabase
    .from('track_now_execution_items')
    .select('*, track_now_item_schedules(*)')
    .eq('track_id', trackId)
    .order('created_at', { ascending: true })
  const rows = unwrap(await query) as any[]
  return rows.map(mapExecutionItemRow)
}

export async function getExecutionItem(itemId: string): Promise<ExecutionItem> {
  const row = unwrap(
    await supabase
      .from('track_now_execution_items')
      .select('*, track_now_item_schedules(*)')
      .eq('id', itemId)
      .single(),
  )
  return mapExecutionItemRow(row)
}

export async function createExecutionItem(
  userId: string,
  input: NewExecutionItemInput,
): Promise<ExecutionItem> {
  if (input.plan_id) {
    const { data: plan, error: planErr } = await supabase
      .from('track_now_plans')
      .select('id')
      .eq('id', input.plan_id)
      .maybeSingle()
    if (planErr || !plan) {
      throw new Error('Unauthorized or target plan does not exist')
    }
  }

  const { schedule: scheduleInput, ...itemFields } = input
  const targetCount = Math.max(1, input.target_count ?? 1)
  const currentCount = Math.max(0, input.current_count ?? 0)
  const initialStatus =
    itemFields.status || (currentCount >= targetCount && targetCount > 0 ? 'done' : 'todo')

  const row = unwrap(
    await supabase
      .from('track_now_execution_items')
      .insert({
        ...itemFields,
        user_id: userId,
        target_count: targetCount,
        current_count: currentCount,
        unit: input.unit?.trim() || null,
        status: initialStatus,
        priority: itemFields.priority || 'medium',
      })
      .select('*, track_now_item_schedules(*)')
      .single(),
  )
  const item = mapExecutionItemRow(row)

  // Persist schedule if provided or if type is habit
  if (scheduleInput || input.type === 'habit') {
    const schedPayload = {
      item_id: item.id,
      frequency: scheduleInput?.frequency || 'daily',
      days_of_week:
        scheduleInput?.days_of_week ??
        (scheduleInput?.frequency === 'daily' || !scheduleInput?.frequency
          ? [0, 1, 2, 3, 4, 5, 6]
          : null),
      time_of_day: scheduleInput?.time_of_day || 'anytime',
      reminder_time: scheduleInput?.reminder_time || null,
    }
    const { data: createdSched } = await supabase
      .from('track_now_item_schedules')
      .insert(schedPayload)
      .select()
      .maybeSingle()
    item.schedule = createdSched as ItemSchedule | null
  }

  return item
}

export async function saveItemSchedule(
  itemId: string,
  schedule: NewItemScheduleInput,
): Promise<ItemSchedule> {
  const { data: existing } = await supabase
    .from('track_now_item_schedules')
    .select('id')
    .eq('item_id', itemId)
    .maybeSingle()

  if (existing) {
    return unwrap(
      await supabase
        .from('track_now_item_schedules')
        .update({
          frequency: schedule.frequency,
          days_of_week: schedule.days_of_week ?? null,
          time_of_day: schedule.time_of_day ?? 'anytime',
          reminder_time: schedule.reminder_time ?? null,
        })
        .eq('id', existing.id)
        .select()
        .single(),
    ) as ItemSchedule
  }

  return unwrap(
    await supabase
      .from('track_now_item_schedules')
      .insert({
        item_id: itemId,
        frequency: schedule.frequency,
        days_of_week: schedule.days_of_week ?? null,
        time_of_day: schedule.time_of_day ?? 'anytime',
        reminder_time: schedule.reminder_time ?? null,
      })
      .select()
      .single(),
  ) as ItemSchedule
}

export async function updateExecutionItem(
  itemId: string,
  updates: Partial<ExecutionItem>,
): Promise<ExecutionItem> {
  const row = unwrap(
    await supabase
      .from('track_now_execution_items')
      .update(updates)
      .eq('id', itemId)
      .select('*, track_now_item_schedules(*)')
      .single(),
  )
  return mapExecutionItemRow(row)
}

export async function updateItemProgress(
  itemId: string,
  newCount: number,
  userId?: string,
): Promise<ExecutionItem> {
  const currentItem = await getExecutionItem(itemId)
  const targetCount = Math.max(1, currentItem.target_count ?? 1)
  const clampedCount = Math.max(0, newCount)
  const willBeDone = clampedCount >= targetCount
  const nextStatus: ItemStatus = willBeDone ? 'done' : 'todo'
  const wasDone = currentItem.status === 'done'

  const updated = await updateExecutionItem(itemId, {
    current_count: clampedCount,
    status: nextStatus,
  })

  if (userId) {
    if (willBeDone && !wasDone) {
      await recordCompletion(userId, itemId).catch((err) => {
        console.warn('Could not record completion log on progress completion:', err)
      })
    } else if (!willBeDone && wasDone) {
      await deleteCompletionForDate(itemId).catch((err) => {
        console.warn('Could not remove completion log on progress regress:', err)
      })
    }
  }

  return updated
}

export async function editExecutionItem(
  itemId: string,
  input: UpdateExecutionItemInput,
  userId?: string,
): Promise<ExecutionItem> {
  const currentItem = await getExecutionItem(itemId)

  // Determine updated fields
  const targetCount =
    input.target_count !== undefined
      ? Math.max(1, input.target_count)
      : Math.max(1, currentItem.target_count ?? 1)

  const currentCount =
    input.current_count !== undefined
      ? Math.max(0, input.current_count)
      : Math.max(0, currentItem.current_count ?? 0)

  const unit =
    input.unit !== undefined ? (input.unit?.trim() || null) : currentItem.unit

  // Canonical completion: current_count >= target_count
  const willBeDone = currentCount >= targetCount
  const wasDone = currentItem.status === 'done'
  const nextStatus: ItemStatus = willBeDone ? 'done' : 'todo'

  const updates: Partial<ExecutionItem> = {
    target_count: targetCount,
    current_count: currentCount,
    unit,
    status: nextStatus,
  }

  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.description !== undefined) updates.description = input.description?.trim() || null
  if (input.priority !== undefined) updates.priority = input.priority
  if (input.type !== undefined) updates.type = input.type
  if (input.due_date !== undefined) updates.due_date = input.due_date || null
  if (input.start_date !== undefined) updates.start_date = input.start_date || null

  const updated = await updateExecutionItem(itemId, updates)

  // Persist schedule if provided
  if (input.schedule) {
    const savedSchedule = await saveItemSchedule(itemId, input.schedule)
    updated.schedule = savedSchedule
  }

  if (userId) {
    if (willBeDone && !wasDone) {
      await recordCompletion(userId, itemId).catch((err) => {
        console.warn('Could not record completion log on edit completion:', err)
      })
    } else if (!willBeDone && wasDone) {
      await deleteCompletionForDate(itemId).catch((err) => {
        console.warn('Could not remove completion log on edit regress:', err)
      })
    }
  }

  return updated
}

export async function recordCompletion(
  userId: string,
  itemId: string,
  notes?: string,
  completedDate?: string,
): Promise<void> {
  const dateStr = completedDate || new Date().toISOString().split('T')[0]

  // Validate that target execution item exists and belongs to this user
  const { data: item, error: itemErr } = await supabase
    .from('track_now_execution_items')
    .select('id')
    .eq('id', itemId)
    .maybeSingle()
  if (itemErr || !item) {
    throw new Error('Unauthorized or target execution item does not exist')
  }

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
  const currentItem = await getExecutionItem(itemId)
  const targetCount = Math.max(1, currentItem.target_count ?? 1)
  const nextCount = nextStatus === 'done' ? Math.max(targetCount, currentItem.current_count ?? 0) : 0

  const updated = await updateExecutionItem(itemId, {
    status: nextStatus,
    current_count: nextCount,
  })

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

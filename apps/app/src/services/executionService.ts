import { supabase } from '@/lib/supabase/client'
import type {
  ExecutionItem,
  ItemSchedule,
  ItemStatus,
  NewExecutionItemInput,
  NewItemScheduleInput,
  UpdateExecutionItemInput,
} from '@/types/domain'
import { getTodayDateString } from '@/domain/dates'
import { calcHabitStreak, type HabitStreakSummary } from '@/domain/streaks'
import {
  STALE_DAY_MESSAGE,
  effectiveCurrentCount,
  isHabitCountStale,
  isStaleDayWrite,
  supportsCountDate,
} from '@/domain/habitCounter'
import { chunk, fetchAllPages, unwrap } from './helpers'

export function mapExecutionItemRow(row: any): ExecutionItem {
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

  const items: any[] = []
  for (const planIds of chunk(activePlanIds)) {
    const rows = await fetchAllPages<any>((from, to) =>
      supabase
        .from('track_now_execution_items')
        .select('*, track_now_item_schedules(*)')
        .in('plan_id', planIds)
        .neq('status', 'archived')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    )
    items.push(...rows)
  }
  items.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
  return items.map(mapExecutionItemRow)
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
    const { data: createdSched, error: schedErr } = await supabase
      .from('track_now_item_schedules')
      .insert(schedPayload)
      .select()
      .maybeSingle()
    if (schedErr) {
      // Never report a half-created item: roll the item back so the caller can retry cleanly.
      const { error: rollbackErr } = await supabase
        .from('track_now_execution_items')
        .delete()
        .eq('id', item.id)
      if (rollbackErr) {
        throw new Error(
          `The item was created but its schedule could not be saved (${schedErr.message}). Edit the item to set its schedule.`,
        )
      }
      throw new Error(`The item could not be created because its schedule failed to save (${schedErr.message}).`)
    }
    item.schedule = (createdSched as ItemSchedule | null) ?? null
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

/**
 * Habits restart their counter every day. True when the stored count belongs to an
 * earlier local day (from `count_date`, or the legacy `updated_at` heuristic) and the
 * habit is not completed today. See domain/habitCounter.ts.
 */
export function shouldResetHabitCount(
  item: Pick<ExecutionItem, 'type' | 'updated_at'> & Partial<Pick<ExecutionItem, 'count_date'>>,
  completedToday: boolean,
  now = new Date(),
): boolean {
  return isHabitCountStale(item, completedToday, now)
}

/** Fields that tie a written count to the day it belongs to (only when the column exists). */
function countDayFields(item: ExecutionItem, dateStr: string): Partial<ExecutionItem> {
  return supportsCountDate(item) ? { count_date: dateStr } : {}
}

/** True when a completion row exists for the item on the given local calendar date. */
export async function hasCompletionOnDate(itemId: string, dateStr: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('track_now_item_completions')
    .select('id')
    .eq('item_id', itemId)
    .eq('completed_date', dateStr)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

/**
 * "Was done" before a mutation: for habits this is per-day truth from the completion
 * log (status may still read 'done' from a previous day); for one-off items it is status.
 */
async function wasItemDoneBefore(item: ExecutionItem, dateStr: string): Promise<boolean> {
  if (item.type === 'habit') return hasCompletionOnDate(item.id, dateStr)
  return item.status === 'done'
}

/**
 * Keeps the completion log consistent with a status transition. Failures are surfaced
 * (never swallowed) so the UI can tell the user that history is out of sync.
 */
async function syncCompletionLog(
  userId: string,
  itemId: string,
  dateStr: string,
  wasDone: boolean,
  willBeDone: boolean,
  itemType?: ExecutionItem['type'],
): Promise<void> {
  try {
    if (willBeDone && !wasDone) {
      await recordCompletion(userId, itemId, undefined, dateStr)
    } else if (!willBeDone && wasDone) {
      if (itemType && itemType !== 'habit') {
        // A one-off item has a single completion event; un-completing it (possibly on a
        // later day) must remove it so history and analytics do not overstate finished work.
        await deleteAllCompletionsForItem(itemId)
      } else {
        await deleteCompletionForDate(itemId, dateStr)
      }
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Progress was saved, but completion history could not be updated (${reason}).`)
  }
}

export async function updateItemProgress(
  itemId: string,
  newCount: number,
  userId?: string,
  completedDate?: string,
): Promise<ExecutionItem> {
  const currentItem = await getExecutionItem(itemId)
  const targetCount = Math.max(1, currentItem.target_count ?? 1)
  const clampedCount = Math.max(0, newCount)
  const willBeDone = clampedCount >= targetCount
  const nextStatus: ItemStatus = willBeDone ? 'done' : 'todo'
  const dateStr = completedDate || getTodayDateString()
  if (isStaleDayWrite(currentItem, dateStr)) throw new Error(STALE_DAY_MESSAGE)
  const wasDone = userId ? await wasItemDoneBefore(currentItem, dateStr) : currentItem.status === 'done'

  const updated = await updateExecutionItem(itemId, {
    current_count: clampedCount,
    status: nextStatus,
    ...countDayFields(currentItem, dateStr),
  })

  if (userId) {
    await syncCompletionLog(userId, itemId, dateStr, wasDone, willBeDone, currentItem.type)
  }

  return updated
}

/** PostgREST reports a missing/unknown RPC signature as PGRST202 (schema cache miss). */
export function isMissingRpcError(
  error: { code?: string; message?: string; status?: number } | null | undefined,
): boolean {
  if (!error) return false
  if (error.code === 'PGRST202') return true
  const m = (error.message || '').toLowerCase()
  return (
    m.includes('could not find the function') ||
    m.includes('function public.track_now_increment_item_count')
  )
}

/**
 * Atomic relative increment/decrement counter mutation.
 *
 * Preferred path: the SECURITY DEFINER RPC `track_now_increment_item_count`, which
 * derives the acting user from `auth.uid()` on the server (the client never sends a
 * user id) and applies the change under a row lock to prevent lost updates.
 *
 * Fallback path: only when PostgREST reports that the function does not exist (the
 * remediation migration has not been applied yet) we fall back to the RLS-protected
 * read-calculate-write path. Any other RPC error (unauthorized, validation) is surfaced.
 *
 * @param resetCount Hint that a habit is on a new local day. Once `count_date` exists the
 *   server (and the fallback path) decide from it and only use this hint for legacy rows.
 */
export async function stepItemCount(
  itemId: string,
  delta: number,
  userId?: string,
  completedDate?: string,
  resetCount?: boolean,
): Promise<ExecutionItem> {
  const dateStr = completedDate || getTodayDateString()
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error('Count change must be a non-zero whole number.')
  }

  if (userId) {
    const { data, error } = await supabase.rpc('track_now_increment_item_count', {
      p_item_id: itemId,
      p_delta: delta,
      p_completed_date: dateStr,
      p_reset_count: Boolean(resetCount),
    })
    if (!error && data) {
      return mapExecutionItemRow(data)
    }
    if (error && !isMissingRpcError(error)) {
      throw new Error(error.message || 'Could not update the item count.')
    }
    // RPC not deployed yet: continue with the RLS-protected client path below.
  }

  const currentItem = await getExecutionItem(itemId)
  if (isStaleDayWrite(currentItem, dateStr)) throw new Error(STALE_DAY_MESSAGE)
  let reset = false
  if (currentItem.type === 'habit') {
    const completedToday = userId
      ? await hasCompletionOnDate(itemId, dateStr)
      : currentItem.status === 'done'
    // The authoritative count_date decides; the caller's hint only matters for legacy rows.
    reset =
      currentItem.count_date || resetCount === undefined
        ? isHabitCountStale(currentItem, completedToday, new Date(`${dateStr}T12:00:00`))
        : resetCount && !completedToday
  }
  const baseCount = reset ? 0 : (currentItem.current_count ?? 0)
  const nextCount = Math.max(0, baseCount + delta)
  return updateItemProgress(itemId, nextCount, userId, dateStr)
}

export async function editExecutionItem(
  itemId: string,
  input: UpdateExecutionItemInput,
  userId?: string,
  completedDate?: string,
): Promise<ExecutionItem> {
  const currentItem = await getExecutionItem(itemId)
  const dateStr = completedDate || getTodayDateString()

  // Count/completion state is only recomputed when the edit touches it. A plain rename,
  // description or priority change must never change progress or completion history.
  const touchesProgress =
    input.target_count !== undefined ||
    input.current_count !== undefined ||
    (input.type !== undefined && input.type !== currentItem.type)

  const updates: Partial<ExecutionItem> = {}
  if (input.unit !== undefined) updates.unit = input.unit?.trim() || null

  let wasDone = false
  let willBeDone = false
  if (touchesProgress) {
    if (isStaleDayWrite(currentItem, dateStr)) throw new Error(STALE_DAY_MESSAGE)
    const targetCount =
      input.target_count !== undefined
        ? Math.max(1, input.target_count)
        : Math.max(1, currentItem.target_count ?? 1)
    wasDone = userId ? await wasItemDoneBefore(currentItem, dateStr) : currentItem.status === 'done'
    // A habit's stored count may belong to an earlier day: today's base is then 0, so an
    // edit on a new day can never carry yesterday's count (or completion) into today.
    const currentCount =
      input.current_count !== undefined
        ? Math.max(0, input.current_count)
        : effectiveCurrentCount(currentItem, currentItem.type === 'habit' && wasDone, new Date(`${dateStr}T12:00:00`))

    // Canonical completion: current_count >= target_count
    willBeDone = currentCount >= targetCount
    // Keep explicit non-terminal states (in_progress / archived) unless the edit completes the item.
    const preservedStatus: ItemStatus =
      currentItem.status === 'in_progress' || currentItem.status === 'archived' ? currentItem.status : 'todo'
    updates.target_count = targetCount
    updates.current_count = currentCount
    updates.status = willBeDone ? 'done' : preservedStatus
    Object.assign(updates, countDayFields(currentItem, dateStr))
  }

  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.description !== undefined) updates.description = input.description?.trim() || null
  if (input.priority !== undefined) updates.priority = input.priority
  if (input.type !== undefined) updates.type = input.type
  if (input.due_date !== undefined) updates.due_date = input.due_date || null
  // NOTE: track_now_execution_items has no start_date column; it is intentionally not persisted.

  const updated = await updateExecutionItem(itemId, updates)

  // Persist schedule if provided. A failure here is surfaced: the item fields were saved,
  // but the caller must know the schedule was not.
  if (input.schedule) {
    try {
      const savedSchedule = await saveItemSchedule(itemId, input.schedule)
      updated.schedule = savedSchedule
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      throw new Error(`Item details were saved, but the schedule could not be updated (${reason}).`)
    }
  } else if (currentItem.type === 'habit' && input.type !== undefined && input.type !== 'habit') {
    // The item is no longer a habit: remove its recurrence so it stops driving badges/reminders.
    const { error: schedDelErr } = await supabase
      .from('track_now_item_schedules')
      .delete()
      .eq('item_id', itemId)
    if (schedDelErr) {
      throw new Error(`Item details were saved, but its old habit schedule could not be removed (${schedDelErr.message}).`)
    }
    updated.schedule = null
  }

  if (userId && touchesProgress) {
    await syncCompletionLog(userId, itemId, dateStr, wasDone, willBeDone, updates.type ?? currentItem.type)
  }

  return updated
}

export async function recordCompletion(
  userId: string,
  itemId: string,
  notes?: string,
  completedDate?: string,
): Promise<void> {
  const dateStr = completedDate || getTodayDateString()

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

/** Removes every completion row for an item (used when a one-off item is un-completed). */
export async function deleteAllCompletionsForItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('track_now_item_completions').delete().eq('item_id', itemId)
  if (error) throw new Error(error.message)
}

export async function deleteCompletionForDate(
  itemId: string,
  completedDate?: string,
): Promise<void> {
  const dateStr = completedDate || getTodayDateString()
  const { error } = await supabase
    .from('track_now_item_completions')
    .delete()
    .eq('item_id', itemId)
    .eq('completed_date', dateStr)
  if (error) throw new Error(error.message)
}

export async function listCompletionsForDate(
  userId: string,
  dateStr = getTodayDateString(),
): Promise<string[]> {
  const { data, error } = await supabase
    .from('track_now_item_completions')
    .select('item_id')
    .eq('user_id', userId)
    .eq('completed_date', dateStr)
  if (error) throw new Error(error.message)
  return ((data || []) as Array<{ item_id: string }>).map((c) => c.item_id)
}

export async function toggleHabitTodayCompletion(
  userId: string,
  itemId: string,
  completedToday: boolean,
  dateStr = getTodayDateString(),
): Promise<boolean> {
  if (completedToday) {
    await deleteCompletionForDate(itemId, dateStr)
    return false
  } else {
    await recordCompletion(userId, itemId, undefined, dateStr)
    return true
  }
}

export async function toggleItemStatus(
  itemId: string,
  _currentStatus: ItemStatus,
  userId?: string,
  completedDate?: string,
): Promise<ExecutionItem> {
  // Derive the transition from the freshly loaded row, not the caller's possibly stale copy,
  // so double clicks / two tabs cannot invert the intended action.
  const currentItem = await getExecutionItem(itemId)
  const nextStatus: ItemStatus = currentItem.status === 'done' ? 'todo' : 'done'
  const targetCount = Math.max(1, currentItem.target_count ?? 1)
  const nextCount = nextStatus === 'done' ? Math.max(targetCount, currentItem.current_count ?? 0) : 0
  const dateStr = completedDate || getTodayDateString()

  const updated = await updateExecutionItem(itemId, {
    status: nextStatus,
    current_count: nextCount,
    ...countDayFields(currentItem, dateStr),
  })

  if (userId) {
    await syncCompletionLog(userId, itemId, dateStr, nextStatus !== 'done', nextStatus === 'done', currentItem.type)
  }

  return updated
}

/**
 * Idempotently marks an item done (or not done). Unlike toggleItemStatus, the caller
 * states the intended result, so an item already completed elsewhere (another tab or
 * device) is left as is instead of being flipped back and losing its history.
 */
export async function setItemDone(
  itemId: string,
  done: boolean,
  userId?: string,
  completedDate?: string,
): Promise<ExecutionItem> {
  const currentItem = await getExecutionItem(itemId)
  if (currentItem.type === 'habit') {
    const target = Math.max(1, currentItem.target_count ?? 1)
    return updateItemProgress(itemId, done ? target : 0, userId, completedDate)
  }
  if ((currentItem.status === 'done') === done) return currentItem
  return toggleItemStatus(itemId, currentItem.status, userId, completedDate)
}

export async function deleteExecutionItem(itemId: string): Promise<void> {
  unwrap(
    await supabase.from('track_now_execution_items').delete().eq('id', itemId).select('id').single(),
  )
}

/**
 * Fetches completed dates for a list of execution item IDs.
 */
export async function listCompletionsForItems(
  itemIds: string[],
  startDate?: string,
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {}
  if (!itemIds || itemIds.length === 0) return result
  itemIds.forEach((id) => {
    result[id] = []
  })

  const data: Array<{ item_id: string; completed_date: string }> = []
  for (const ids of chunk(itemIds)) {
    const rows = await fetchAllPages<{ item_id: string; completed_date: string }>((from, to) => {
      let query = supabase
        .from('track_now_item_completions')
        .select('item_id, completed_date')
        .in('item_id', ids)
      if (startDate) query = query.gte('completed_date', startDate)
      return query
        .order('completed_date', { ascending: true })
        .order('item_id', { ascending: true })
        .range(from, to)
    })
    data.push(...rows)
  }

  data.forEach((row) => {
    if (!result[row.item_id]) result[row.item_id] = []
    result[row.item_id].push(row.completed_date)
  })

  return result
}

/**
 * Computes deterministic streak summaries for a given list of habit items.
 */
export async function getHabitStreakSummaries(
  _userId: string,
  habits: ExecutionItem[],
  now = new Date(),
): Promise<Record<string, HabitStreakSummary>> {
  const eligibleHabits = habits.filter((h) => h.type === 'habit')
  const result: Record<string, HabitStreakSummary> = {}
  if (eligibleHabits.length === 0) return result

  const itemIds = eligibleHabits.map((h) => h.id)
  const completionsMap = await listCompletionsForItems(itemIds)

  eligibleHabits.forEach((habit) => {
    const dates = completionsMap[habit.id] || []
    result[habit.id] = calcHabitStreak(
      habit.id,
      habit.schedule,
      dates,
      now,
      undefined,
      habit.created_at ? getTodayDateString(new Date(habit.created_at)) : null,
    )
  })

  return result
}

/**
 * Fetches daily completion counts across all items for a given user.
 * Useful for aggregate consistency calendar heatmaps.
 */
export async function listUserDailyCompletionCounts(
  userId: string,
  startDate?: string,
): Promise<Record<string, number>> {
  const data = await fetchAllPages<{ completed_date: string }>((from, to) => {
    let query = supabase
      .from('track_now_item_completions')
      .select('completed_date, item_id')
      .eq('user_id', userId)
    if (startDate) query = query.gte('completed_date', startDate)
    return query
      .order('completed_date', { ascending: true })
      .order('item_id', { ascending: true })
      .range(from, to)
  })

  const counts: Record<string, number> = {}
  data.forEach((row) => {
    counts[row.completed_date] = (counts[row.completed_date] || 0) + 1
  })

  return counts
}


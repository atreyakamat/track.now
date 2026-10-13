import { supabase } from '@/lib/supabase/client'

/** One row of completion history (track_now_item_completions projection). */
export interface CompletionRecord {
  item_id: string
  /** Local calendar date the completion counts for, 'YYYY-MM-DD'. */
  completed_date: string
  completed_at: string | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** PostgREST commonly caps responses at 1000 rows; page explicitly so nothing is silently dropped. */
export const HISTORY_PAGE_SIZE = 1000
/** Hard stop so a misbehaving backend can never loop forever. */
const MAX_PAGES = 50

/**
 * Lists the user's completion history between two local dates (inclusive).
 * Errors are surfaced as thrown Errors — never swallowed — so pages can show a retry.
 */
export async function listCompletionHistory(
  userId: string,
  startDate: string,
  endDate?: string,
): Promise<CompletionRecord[]> {
  if (!userId) throw new Error('A signed-in user is required to load completion history.')
  if (!DATE_RE.test(startDate)) throw new Error(`Invalid start date: ${startDate}`)
  if (endDate !== undefined && !DATE_RE.test(endDate)) throw new Error(`Invalid end date: ${endDate}`)

  const records: CompletionRecord[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    let query = supabase
      .from('track_now_item_completions')
      .select('item_id, completed_date, completed_at')
      .eq('user_id', userId)
      .gte('completed_date', startDate)
    if (endDate) query = query.lte('completed_date', endDate)

    const from = page * HISTORY_PAGE_SIZE
    const { data, error } = await query
      .order('completed_date', { ascending: true })
      .order('item_id', { ascending: true })
      .range(from, from + HISTORY_PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as CompletionRecord[]
    records.push(...rows)
    if (rows.length < HISTORY_PAGE_SIZE) break
  }
  return records
}

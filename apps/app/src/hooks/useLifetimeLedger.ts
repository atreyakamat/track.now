import { useCallback, useEffect, useState } from 'react'
import { listCompletionHistory, type CompletionRecord } from '@tracknow/core/services/historyService'

/** Earliest date the lifetime ledger reads from (completions are one row per item per day). */
export const LIFETIME_START = '2000-01-01'

/**
 * The user's whole completion ledger (item id + date only), loaded after the page's own
 * data. Level, XP, streaks and achievements are all derived from it.
 */
export function useLifetimeLedger(userId: string | null | undefined) {
  const [ledger, setLedger] = useState<CompletionRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    if (!userId) return
    setError(null)
    return listCompletionHistory(userId, LIFETIME_START)
      .then((rows) => setLedger(rows))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load your history.'))
  }, [userId])

  useEffect(() => {
    let alive = true
    if (!userId) return
    listCompletionHistory(userId, LIFETIME_START)
      .then((rows) => alive && setLedger(rows))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : 'Could not load your history.'))
    return () => {
      alive = false
    }
  }, [userId])

  return { ledger, error, reload }
}

/** The ledger with today's rows replaced by the live set of completed ids (optimistic toggles). */
export function ledgerWithToday(ledger: readonly CompletionRecord[], today: string, completedTodayIds: Iterable<string>): CompletionRecord[] {
  const rows = ledger.filter((r) => r.completed_date !== today)
  for (const id of completedTodayIds) rows.push({ item_id: id, completed_date: today, completed_at: null })
  return rows
}

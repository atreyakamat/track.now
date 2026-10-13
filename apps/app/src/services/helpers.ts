import type { PostgrestError } from '@supabase/supabase-js'

/** Convert a Supabase/PostgREST result into data or a real Error. */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null) throw new Error('No data returned')
  return result.data
}

export function toMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** PostgREST commonly caps responses at 1000 rows; page explicitly so nothing is silently dropped. */
export const PAGE_SIZE = 1000
/** Hard stop so a misbehaving backend can never loop forever. */
const MAX_PAGES = 100

/**
 * Loads every row of a query page by page. `page(from, to)` must apply a deterministic
 * `.order(...)` and `.range(from, to)`; otherwise rows can repeat or be skipped.
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let i = 0; i < MAX_PAGES; i++) {
    const from = i * PAGE_SIZE
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return rows
  }
  throw new Error('Too much data to load at once. Please narrow the date range.')
}

/** Splits ids into chunks so `.in(...)` filters stay well under URL length limits. */
export function chunk<T>(values: readonly T[], size = 150): T[][] {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size))
  return out
}

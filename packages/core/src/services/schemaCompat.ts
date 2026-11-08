/**
 * Compatibility with databases that have not applied migration 20261108000000 yet.
 *
 * The app ships before the owner applies the migration, so every write that includes one of
 * the new optional columns retries once without them when PostgREST reports an unknown column.
 * The core data is always saved; the caller learns which optional fields were dropped so it can
 * tell the user instead of silently losing them.
 */

export const ARC_MIGRATION = '20261108000000_plans_arcs_and_flexible_items.sql'

export const PLAN_OPTIONAL_COLUMNS = [
  'plan_kind',
  'outcome',
  'success_criteria',
  'completed_at',
  'result_notes',
  'lessons_learned',
  'next_decision',
  'arc_name',
] as const
export const ITEM_OPTIONAL_COLUMNS = ['start_date', 'checklist_entries'] as const
export const SCHEDULE_OPTIONAL_COLUMNS = ['times_per_week'] as const

export const NEEDS_MIGRATION_MESSAGE =
  'Saved, but some fields need the latest database update and were not stored yet (start date, checklist steps, weekly target, Plan outcome or Arc).'

/** Statuses the pre-migration CHECK constraint rejects. */
export const MIGRATION_ONLY_PLAN_STATUSES = new Set(['draft', 'paused'])

interface PgError {
  code?: string
  message?: string
}

/** PGRST204 = column not in the schema cache; 42703 = undefined column. */
export function isMissingColumnError(error: PgError | null | undefined): boolean {
  if (!error) return false
  if (error.code === 'PGRST204' || error.code === '42703') return true
  return /column .* (does not exist|of .* in the schema cache)/i.test(error.message ?? '')
}

/** 23514 = CHECK violation (e.g. 'paused' before the migration widened the status list). */
export function isCheckViolation(error: PgError | null | undefined): boolean {
  return error?.code === '23514'
}

let legacySchema = false

/** True once a write proved the database is still on the pre-migration schema. */
export function isLegacySchema(): boolean {
  return legacySchema
}

/** Test hook. */
export function resetSchemaCompat(): void {
  legacySchema = false
}

const hasValue = (v: unknown) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)

export interface CompatWriteResult<T> {
  data: T
  /** Optional fields that held a value but could not be stored (pre-migration database). */
  dropped: string[]
}

/**
 * Runs `write(payload)`; when it fails because an optional column is unknown, retries once with
 * every optional column removed. Other errors are thrown unchanged.
 */
export async function writeWithOptionalColumns<T>(
  payload: Record<string, unknown>,
  optional: readonly string[],
  write: (payload: Record<string, unknown>) => PromiseLike<{ data: unknown; error: PgError | null }>,
): Promise<CompatWriteResult<T>> {
  const present = optional.filter((key) => key in payload)
  const stripped = () => {
    const copy = { ...payload }
    present.forEach((key) => delete copy[key])
    return copy
  }
  const first = await write(legacySchema && present.length ? stripped() : payload)
  if (!first.error) {
    return { data: first.data as T, dropped: legacySchema ? present.filter((k) => hasValue(payload[k])) : [] }
  }
  if (!present.length || !isMissingColumnError(first.error) || legacySchema) {
    throw new Error(first.error.message ?? 'Request failed')
  }
  legacySchema = true
  const retry = await write(stripped())
  if (retry.error) throw new Error(retry.error.message ?? 'Request failed')
  return { data: retry.data as T, dropped: present.filter((k) => hasValue(payload[k])) }
}

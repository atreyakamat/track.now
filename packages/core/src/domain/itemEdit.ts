import type { ExecutionItem, UpdateExecutionItemInput } from '../types/domain'
import { effectiveCurrentCount } from './habitCounter'

/**
 * Whether an item counts as "completed today" after an edit. An edit that does not touch
 * progress (rename, description, priority…) leaves it exactly as it was: a habit's stored
 * count may belong to an earlier day and must not mark it done today.
 */
export function doneTodayAfterEdit(
  input: UpdateExecutionItemInput,
  before: (Pick<ExecutionItem, 'type'> & Partial<Pick<ExecutionItem, 'status'>>) | undefined,
  updated: ExecutionItem,
  wasDoneToday: boolean,
): boolean {
  const touchesProgress =
    input.current_count !== undefined ||
    input.target_count !== undefined ||
    (input.type !== undefined && input.type !== before?.type)
  if (!touchesProgress && input.checklist_entries !== undefined && updated.type === 'checklist') {
    // Ticking the last step completes the checklist today; un-ticking one re-opens it.
    if (updated.status !== 'done') return false
    return wasDoneToday || before?.status !== 'done'
  }
  if (!touchesProgress) return wasDoneToday
  if (updated.type === 'habit') {
    return effectiveCurrentCount(updated, wasDoneToday) >= Math.max(1, updated.target_count ?? 1)
  }
  return updated.status === 'done'
}

import type { ExecutionItem, Plan, Track } from '../types/domain'

/**
 * "Export all my data": everything the account owns, as JSON (lossless) or CSV (one row per
 * item, plus one per completion). Pure: the caller fetches the rows and saves the file.
 */
export interface ExportBundle {
  format: 'tracknow.export.v1'
  exportedAt: string
  tracks: Track[]
  plans: Plan[]
  items: ExecutionItem[]
  completions: { item_id: string; completed_date: string; completed_at?: string | null }[]
}

export function buildExportBundle(input: Omit<ExportBundle, 'format' | 'exportedAt'>, now = new Date()): ExportBundle {
  return { format: 'tracknow.export.v1', exportedAt: now.toISOString(), ...input }
}

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  const s = Array.isArray(v) ? v.join('|') : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (cells: unknown[]) => cells.map(cell).join(',')

/** One CSV with every item and its context (Track, Plan, schedule). */
export function itemsCsv(bundle: Pick<ExportBundle, 'tracks' | 'plans' | 'items'>): string {
  const trackById = new Map(bundle.tracks.map((t) => [t.id, t]))
  const planById = new Map(bundle.plans.map((p) => [p.id, p]))
  const header = ['item_id', 'track', 'plan', 'arc', 'type', 'name', 'description', 'status', 'priority', 'due_date', 'start_date', 'target_count', 'unit', 'frequency', 'days_of_week', 'times_per_week', 'time_of_day', 'reminder_time', 'checklist_steps', 'created_at']
  const lines = [row(header)]
  for (const i of bundle.items) {
    const plan = planById.get(i.plan_id)
    const track = plan ? trackById.get(plan.track_id) : undefined
    lines.push(
      row([
        i.id, track?.name ?? '', plan?.name ?? '', plan?.arc_name ?? '', i.type, i.name, i.description, i.status, i.priority, i.due_date, i.start_date ?? '',
        i.target_count ?? 1, i.unit ?? '', i.schedule?.frequency ?? '', i.schedule?.days_of_week ?? '', i.schedule?.times_per_week ?? '', i.schedule?.time_of_day ?? '',
        i.schedule?.reminder_time ?? '', (i.checklist_entries ?? []).map((e) => `${e.done ? '[x]' : '[ ]'} ${e.label}`).join(' | '), i.created_at,
      ]),
    )
  }
  return lines.join('\n')
}

/** One CSV with every completion (one row per item per day). */
export function completionsCsv(bundle: Pick<ExportBundle, 'items' | 'completions'>): string {
  const nameById = new Map(bundle.items.map((i) => [i.id, i.name]))
  const lines = [row(['item_id', 'item', 'completed_date', 'completed_at'])]
  for (const c of [...bundle.completions].sort((a, b) => a.completed_date.localeCompare(b.completed_date))) {
    lines.push(row([c.item_id, nameById.get(c.item_id) ?? '(deleted item)', c.completed_date, c.completed_at ?? '']))
  }
  return lines.join('\n')
}

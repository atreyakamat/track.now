import type { ItemPriority, ItemType } from '../types/domain'

/**
 * Generic CSV import of items (Todoist / Habitica / Google Sheets exports, or a hand-made
 * sheet). Recognised columns (case-insensitive, any order): name|title|content|task|text,
 * type, due|due_date|date, priority, days|days_of_week|repeat|schedule, description|notes|note,
 * times_per_week. Unknown columns are ignored; nothing is guessed from column position except
 * that a single-column file is a list of names.
 */
export interface CsvItem {
  type: ItemType
  name: string
  description: string | null
  priority: ItemPriority
  due_date: string | null
  days_of_week: number[] | null
  times_per_week: number | null
}

export interface CsvImportResult {
  items: CsvItem[]
  skipped: number
  errors: string[]
  columns: string[]
}

export const CSV_IMPORT_LIMIT = 500
const DAY: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

/** RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const find = (headers: string[], names: string[]) => headers.findIndex((h) => names.includes(h))

function parseDays(raw: string): { days: number[] | null; timesPerWeek: number | null } {
  const s = raw.trim().toLowerCase()
  if (!s) return { days: null, timesPerWeek: null }
  const times = s.match(/(\d)\s*(?:x|×|times)?\s*(?:a|per|\/)\s*week/)
  if (times) return { days: null, timesPerWeek: Math.min(7, Math.max(1, Number(times[1]))) }
  if (/daily|every ?day|everyday/.test(s)) return { days: [0, 1, 2, 3, 4, 5, 6], timesPerWeek: null }
  if (/weekday/.test(s)) return { days: [1, 2, 3, 4, 5], timesPerWeek: null }
  if (/weekend/.test(s)) return { days: [0, 6], timesPerWeek: null }
  const days = Array.from(new Set(s.split(/[^a-z]+/).map((w) => DAY[w.slice(0, 3)]).filter((d): d is number => typeof d === 'number'))).sort()
  if (days.length) return { days, timesPerWeek: null }
  if (/^[0-6](\|[0-6])*$/.test(s)) return { days: s.split('|').map(Number), timesPerWeek: null }
  return { days: null, timesPerWeek: null }
}

const normDate = (raw: string): string | null => {
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const normPriority = (raw: string): ItemPriority => {
  const s = raw.trim().toLowerCase()
  if (['urgent', 'p1', '1', '4'].includes(s)) return s === '4' ? 'low' : 'urgent'
  if (['high', 'p2', '2'].includes(s)) return 'high'
  if (['low', 'p4'].includes(s)) return 'low'
  return 'medium'
}

export function importItemsFromCsv(text: string): CsvImportResult {
  const rows = parseCsv(text)
  if (!rows.length) return { items: [], skipped: 0, errors: ['The file is empty.'], columns: [] }
  const headers = rows[0].map((h) => h.trim().toLowerCase())
  const nameIdx = find(headers, ['name', 'title', 'content', 'task', 'text', 'habit'])
  const single = rows[0].length === 1 && nameIdx === -1
  const body = single || nameIdx === -1 ? rows : rows.slice(1)
  if (!single && nameIdx === -1 && rows[0].length > 1) {
    return { items: [], skipped: 0, errors: ['No name/title column found. Add a header row with a "name" column.'], columns: headers }
  }
  const col = {
    name: single ? 0 : nameIdx,
    type: find(headers, ['type', 'kind']),
    due: find(headers, ['due', 'due_date', 'date', 'deadline']),
    priority: find(headers, ['priority']),
    days: find(headers, ['days', 'days_of_week', 'repeat', 'schedule', 'frequency', 'recurrence']),
    description: find(headers, ['description', 'notes', 'note', 'details']),
    tpw: find(headers, ['times_per_week', 'per_week']),
  }
  const items: CsvItem[] = []
  const errors: string[] = []
  let skipped = 0
  for (const r of body.slice(0, CSV_IMPORT_LIMIT)) {
    const name = (r[col.name] ?? '').trim().slice(0, 200)
    if (!name) {
      skipped++
      continue
    }
    const typeRaw = col.type >= 0 ? (r[col.type] ?? '').trim().toLowerCase() : ''
    const sched = col.days >= 0 ? parseDays(r[col.days] ?? '') : { days: null, timesPerWeek: null }
    const tpwRaw = col.tpw >= 0 ? Number(r[col.tpw]) : NaN
    const timesPerWeek = Number.isInteger(tpwRaw) && tpwRaw >= 1 && tpwRaw <= 7 ? tpwRaw : sched.timesPerWeek
    let type: ItemType = (['habit', 'task', 'checklist', 'milestone', 'project'] as ItemType[]).includes(typeRaw as ItemType) ? (typeRaw as ItemType) : 'task'
    if (typeRaw === '' && (sched.days || timesPerWeek)) type = 'habit'
    items.push({
      type,
      name,
      description: col.description >= 0 ? (r[col.description] ?? '').trim().slice(0, 2000) || null : null,
      priority: col.priority >= 0 ? normPriority(r[col.priority] ?? '') : 'medium',
      due_date: type === 'habit' ? null : col.due >= 0 ? normDate(r[col.due] ?? '') : null,
      days_of_week: type === 'habit' ? (timesPerWeek ? null : (sched.days ?? [0, 1, 2, 3, 4, 5, 6])) : null,
      times_per_week: type === 'habit' ? timesPerWeek : null,
    })
  }
  if (body.length > CSV_IMPORT_LIMIT) errors.push(`Only the first ${CSV_IMPORT_LIMIT} rows were read.`)
  return { items, skipped, errors, columns: headers }
}

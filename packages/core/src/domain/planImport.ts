import type { ItemPriority, ItemType, PlanKind } from '../types/domain'

/**
 * A portable plan file ("tracknow.plan.v1"): Tracks → Plans → items, so a whole personal
 * system (e.g. a 90-day Arc across several life areas) can be set up in one step.
 * Parsing is pure and strict: anything unexpected is reported, never guessed.
 */
export const PLAN_FILE_FORMAT = 'tracknow.plan.v1'

export interface ImportSchedule {
  frequency: 'daily' | 'weekly' | 'custom'
  days_of_week: number[] | null
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime'
  reminder_time: string | null
  times_per_week: number | null
}

export interface ImportItem {
  type: ItemType
  name: string
  description: string | null
  priority: ItemPriority
  due_date: string | null
  start_date: string | null
  target_count: number
  unit: string | null
  schedule: ImportSchedule | null
  steps: string[]
}

export interface ImportPlan {
  name: string
  kind: PlanKind
  description: string | null
  start_date: string | null
  end_date: string | null
  outcome: string | null
  success_criteria: string | null
  /** Arc this Plan belongs to (plan "arc", else the file's top-level "arc"). */
  arc_name: string | null
  items: ImportItem[]
}

export interface ImportTrack {
  name: string
  description: string | null
  icon: string
  color: string
  plans: ImportPlan[]
}

export interface PlanFile {
  title: string | null
  arc: string | null
  tracks: ImportTrack[]
}

export interface ParseResult {
  file: PlanFile | null
  errors: string[]
  counts: { tracks: number; plans: number; items: number }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const COLOR = /^#[0-9a-fA-F]{6}$/
const TYPES: ItemType[] = ['habit', 'task', 'checklist', 'milestone', 'project']
const PRIORITIES: ItemPriority[] = ['low', 'medium', 'high', 'urgent']
const TIMES = ['morning', 'afternoon', 'evening', 'anytime'] as const
export const IMPORT_LIMITS = { tracks: 20, plansPerTrack: 30, itemsPerPlan: 100, totalItems: 500 }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

function validDate(v: unknown): v is string {
  if (typeof v !== 'string' || !DATE.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export function parsePlanFile(input: unknown): ParseResult {
  const errors: string[] = []
  const counts = { tracks: 0, plans: 0, items: 0 }
  const fail = (): ParseResult => ({ file: null, errors, counts })
  let root: unknown = input
  if (typeof input === 'string') {
    try {
      root = JSON.parse(input)
    } catch {
      errors.push('The file is not valid JSON.')
      return fail()
    }
  }
  if (!isObj(root)) {
    errors.push('The file must contain a JSON object.')
    return fail()
  }
  if (root.format !== PLAN_FILE_FORMAT) {
    errors.push(`Unsupported format. Expected "format": "${PLAN_FILE_FORMAT}".`)
    return fail()
  }
  if (!Array.isArray(root.tracks) || root.tracks.length === 0) {
    errors.push('"tracks" must be a non-empty list.')
    return fail()
  }
  if (root.tracks.length > IMPORT_LIMITS.tracks) errors.push(`At most ${IMPORT_LIMITS.tracks} Tracks per file.`)

  const fileArc = str(root.arc, 80)
  const tracks: ImportTrack[] = []
  root.tracks.slice(0, IMPORT_LIMITS.tracks).forEach((rawTrack, ti) => {
    const at = `Track ${ti + 1}`
    if (!isObj(rawTrack)) return void errors.push(`${at}: must be an object.`)
    const name = str(rawTrack.name, 80)
    if (!name) return void errors.push(`${at}: "name" is required.`)
    const color = typeof rawTrack.color === 'string' && COLOR.test(rawTrack.color) ? rawTrack.color : '#6366f1'
    const plansRaw = Array.isArray(rawTrack.plans) ? rawTrack.plans : []
    if (plansRaw.length > IMPORT_LIMITS.plansPerTrack) errors.push(`${name}: at most ${IMPORT_LIMITS.plansPerTrack} Plans.`)
    const plans: ImportPlan[] = []
    plansRaw.slice(0, IMPORT_LIMITS.plansPerTrack).forEach((rawPlan, pi) => {
      const pat = `${name} › Plan ${pi + 1}`
      if (!isObj(rawPlan)) return void errors.push(`${pat}: must be an object.`)
      const pname = str(rawPlan.name, 120)
      if (!pname) return void errors.push(`${pat}: "name" is required.`)
      const start = rawPlan.start_date ?? null
      const end = rawPlan.end_date ?? null
      if (start !== null && !validDate(start)) errors.push(`${name} › ${pname}: start_date must be YYYY-MM-DD.`)
      if (end !== null && !validDate(end)) errors.push(`${name} › ${pname}: end_date must be YYYY-MM-DD.`)
      if (validDate(start) && validDate(end) && end < start) errors.push(`${name} › ${pname}: end_date is before start_date.`)
      const kind: PlanKind =
        rawPlan.kind === 'ongoing' || rawPlan.kind === 'time_bound' || rawPlan.kind === 'recurring'
          ? rawPlan.kind
          : validDate(end)
            ? 'time_bound'
            : 'ongoing'
      if (kind === 'time_bound' && !validDate(end)) errors.push(`${name} › ${pname}: an Arc needs an end_date.`)
      const itemsRaw = Array.isArray(rawPlan.items) ? rawPlan.items : []
      if (itemsRaw.length > IMPORT_LIMITS.itemsPerPlan) errors.push(`${name} › ${pname}: at most ${IMPORT_LIMITS.itemsPerPlan} items.`)
      const items: ImportItem[] = []
      itemsRaw.slice(0, IMPORT_LIMITS.itemsPerPlan).forEach((rawItem, ii) => {
        const iat = `${name} › ${pname} › item ${ii + 1}`
        if (!isObj(rawItem)) return void errors.push(`${iat}: must be an object.`)
        const iname = str(rawItem.name, 200)
        if (!iname) return void errors.push(`${iat}: "name" is required.`)
        const type = TYPES.includes(rawItem.type as ItemType) ? (rawItem.type as ItemType) : null
        if (!type) return void errors.push(`${iat} (${iname}): "type" must be one of ${TYPES.join(', ')}.`)
        for (const key of ['due_date', 'start_date'] as const) {
          if (rawItem[key] != null && !validDate(rawItem[key])) errors.push(`${iat} (${iname}): ${key} must be YYYY-MM-DD.`)
        }
        const target = rawItem.target_count == null ? 1 : Number(rawItem.target_count)
        if (!Number.isInteger(target) || target < 1 || target > 100000) errors.push(`${iat} (${iname}): target_count must be a whole number ≥ 1.`)
        let schedule: ImportSchedule | null = null
        if (type === 'habit') {
          const sc = isObj(rawItem.schedule) ? rawItem.schedule : {}
          const timesPerWeek = sc.times_per_week == null ? null : Number(sc.times_per_week)
          if (timesPerWeek !== null && (!Number.isInteger(timesPerWeek) || timesPerWeek < 1 || timesPerWeek > 7)) {
            errors.push(`${iat} (${iname}): times_per_week must be 1–7.`)
          }
          const days = Array.isArray(sc.days_of_week) ? sc.days_of_week : null
          if (days && !days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)) {
            errors.push(`${iat} (${iname}): days_of_week uses 0 (Sun) … 6 (Sat).`)
          }
          const reminder = sc.reminder_time ?? null
          if (reminder !== null && (typeof reminder !== 'string' || !TIME.test(reminder))) {
            errors.push(`${iat} (${iname}): reminder_time must be HH:MM.`)
          }
          const tod = TIMES.includes(sc.time_of_day as (typeof TIMES)[number]) ? (sc.time_of_day as ImportSchedule['time_of_day']) : 'anytime'
          const fixedDays = days && days.length && days.length < 7 ? [...new Set(days as number[])].sort() : null
          schedule = {
            frequency: timesPerWeek ? 'weekly' : fixedDays ? 'weekly' : 'daily',
            days_of_week: timesPerWeek ? null : fixedDays,
            time_of_day: tod,
            reminder_time: typeof reminder === 'string' && TIME.test(reminder) ? reminder : null,
            times_per_week: timesPerWeek && Number.isInteger(timesPerWeek) ? timesPerWeek : null,
          }
        }
        const steps = Array.isArray(rawItem.steps)
          ? rawItem.steps.map((x) => str(x, 200)).filter((x): x is string => Boolean(x)).slice(0, 50)
          : []
        items.push({
          type,
          name: iname,
          description: str(rawItem.description, 2000),
          priority: PRIORITIES.includes(rawItem.priority as ItemPriority) ? (rawItem.priority as ItemPriority) : 'medium',
          due_date: validDate(rawItem.due_date) ? rawItem.due_date : null,
          start_date: validDate(rawItem.start_date) ? rawItem.start_date : null,
          target_count: Number.isInteger(target) && target >= 1 ? target : 1,
          unit: str(rawItem.unit, 30),
          schedule,
          steps: type === 'checklist' ? steps : [],
        })
      })
      plans.push({
        name: pname,
        kind,
        description: str(rawPlan.description, 2000),
        start_date: validDate(start) ? start : null,
        end_date: kind === 'ongoing' ? null : validDate(end) ? end : null,
        outcome: str(rawPlan.outcome, 2000),
        success_criteria: str(rawPlan.success_criteria, 4000),
        arc_name: rawPlan.arc === null ? null : (str(rawPlan.arc, 80) ?? fileArc),
        items,
      })
      counts.plans++
      counts.items += items.length
    })
    tracks.push({
      name,
      description: str(rawTrack.description, 500),
      icon: str(rawTrack.icon, 40) ?? 'folder',
      color,
      plans,
    })
    counts.tracks++
  })
  if (counts.items > IMPORT_LIMITS.totalItems) errors.push(`At most ${IMPORT_LIMITS.totalItems} items per file.`)
  if (errors.length) return { file: null, errors, counts }
  return { file: { title: str(root.title, 120), arc: fileArc, tracks }, errors, counts }
}

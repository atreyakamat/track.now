import type { ItemType } from '../types/domain'
import { getTodayDateString } from './dates'
import { addDaysTo } from './schedule'

/**
 * Natural-language quick add: "Gym Mon Wed Fri 6am", "Call dentist tomorrow", "Read 20 pages
 * every evening", "Run 3x a week", "Pay rent on 2026-12-01 !high".
 *
 * Pure and conservative: anything it does not understand stays in the name, and the result is
 * only a pre-filled form the user can still change. Dates are local calendar dates.
 */

export interface QuickAddResult {
  name: string
  type: ItemType
  dueDate: string | null
  daysOfWeek: number[] | null
  timesPerWeek: number | null
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime'
  /** HH:MM when a clock time was given. */
  time: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  targetCount: number | null
  unit: string | null
  /** Human summary of what was recognised, for the form hint. */
  recognised: string[]
}

const DAY_WORDS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
}
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

const pad = (n: number) => String(n).padStart(2, '0')
const clean = (s: string) => s.replace(/\s{2,}/g, ' ').replace(/^[\s,\-–:]+|[\s,\-–:]+$/g, '').trim()

export function parseQuickAdd(input: string, now = new Date()): QuickAddResult {
  const today = getTodayDateString(now)
  let text = ` ${input.trim()} `
  const recognised: string[] = []
  const out: QuickAddResult = {
    name: '',
    type: 'task',
    dueDate: null,
    daysOfWeek: null,
    timesPerWeek: null,
    timeOfDay: 'anytime',
    time: null,
    priority: 'medium',
    targetCount: null,
    unit: null,
    recognised,
  }
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = text.match(re)
    if (m) {
      fn(m)
      text = text.replace(re, ' ')
    }
  }

  // Priority: !high / !urgent / !low, or "urgent"/"high priority"
  take(/\s!(urgent|high|low|medium)\b/i, (m) => {
    out.priority = m[1].toLowerCase() as QuickAddResult['priority']
    recognised.push(`${out.priority} priority`)
  })
  take(/\s(urgent|high priority|low priority)\s/i, (m) => {
    const p = m[1].toLowerCase()
    out.priority = p === 'urgent' ? 'urgent' : p.startsWith('high') ? 'high' : 'low'
    recognised.push(`${out.priority} priority`)
  })

  // Clock time: 6am, 6:30pm, 18:15
  take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, (m) => {
    let h = Number(m[1]) % 12
    if (m[3].toLowerCase() === 'pm') h += 12
    out.time = `${pad(h)}:${m[2] ?? '00'}`
  })
  if (!out.time) {
    take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/, (m) => {
      out.time = `${pad(Number(m[1]))}:${m[2]}`
    })
  }
  if (out.time) {
    const h = Number(out.time.slice(0, 2))
    out.timeOfDay = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
    recognised.push(`at ${out.time}`)
  }

  // Time of day words
  take(/\s(?:in the\s+|every\s+|each\s+)?(morning|afternoon|evening|night)s?\b/i, (m) => {
    const w = m[1].toLowerCase()
    out.timeOfDay = w === 'night' ? 'evening' : (w as QuickAddResult['timeOfDay'])
    out.type = 'habit'
    recognised.push(`${out.timeOfDay}s`)
  })

  // "3x a week" / "3 times a week" / "twice a week"
  take(/\s(\d|once|twice|three times|four times|five times|six times)\s*(?:x|×|times)?\s*(?:a|per|\/)\s*week\b/i, (m) => {
    const words: Record<string, number> = { once: 1, twice: 2, 'three times': 3, 'four times': 4, 'five times': 5, 'six times': 6 }
    const n = words[m[1].toLowerCase()] ?? Number(m[1])
    if (n >= 1 && n <= 7) {
      out.timesPerWeek = n
      out.type = 'habit'
      recognised.push(`${n}× a week`)
    }
  })

  // "next monday"
  take(/\snext\s+(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i, (m) => {
    const target = DAY_WORDS[m[1].toLowerCase()]
    const d = new Date(`${today}T00:00:00`)
    let delta = (target - d.getDay() + 7) % 7
    if (delta === 0) delta = 7
    out.dueDate = addDaysTo(today, delta)
    recognised.push(`due ${DAY_LABEL[target]}`)
  })

  // Weekday lists: "Mon Wed Fri", "every monday", "on tuesdays and thursdays", "weekdays", "weekends"
  take(/\s(?:every\s+|on\s+|each\s+)?weekdays?\b/i, () => {
    out.daysOfWeek = [1, 2, 3, 4, 5]
    out.type = 'habit'
    recognised.push('weekdays')
  })
  take(/\s(?:every\s+|on\s+|each\s+)?weekends?\b/i, () => {
    out.daysOfWeek = [0, 6]
    out.type = 'habit'
    recognised.push('weekends')
  })
  {
    const dayRe = /\b(?:every\s+|on\s+|each\s+)?((?:(?:sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)?s?)(?:\s*(?:,|and|&|\/|\s)\s*(?:(?:sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)?s?))*)\b/i
    const m = text.match(dayRe)
    if (m) {
      const days = Array.from(new Set(m[1].toLowerCase().split(/[\s,&/]+|and/).filter(Boolean).map((w) => DAY_WORDS[w.replace(/s$/, '')] ?? DAY_WORDS[w]).filter((d): d is number => typeof d === 'number'))).sort()
      if (days.length) {
        out.daysOfWeek = days
        out.type = 'habit'
        recognised.push(days.map((d) => DAY_LABEL[d]).join(' · '))
        text = text.replace(dayRe, ' ')
      }
    }
  }
  take(/\s(every ?day|daily|each day)\b/i, () => {
    out.daysOfWeek = [0, 1, 2, 3, 4, 5, 6]
    out.type = 'habit'
    recognised.push('daily')
  })

  // Due dates: today, tomorrow, next week, in N days, on 2026-12-01, on 1 Dec / Dec 1
  take(/\s(today)\b/i, () => {
    out.dueDate = today
    recognised.push('due today')
  })
  take(/\s(tomorrow|tmrw|tmr)\b/i, () => {
    out.dueDate = addDaysTo(today, 1)
    recognised.push('due tomorrow')
  })
  take(/\snext\s+week\b/i, () => {
    out.dueDate = addDaysTo(today, 7)
    recognised.push('due next week')
  })
  take(/\sin\s+(\d{1,3})\s+days?\b/i, (m) => {
    out.dueDate = addDaysTo(today, Number(m[1]))
    recognised.push(`due in ${m[1]} days`)
  })
  take(/\s(?:on\s+|by\s+|due\s+)?(\d{4}-\d{2}-\d{2})\b/, (m) => {
    out.dueDate = m[1]
    recognised.push(`due ${m[1]}`)
  })
  take(/\s(?:on\s+|by\s+|due\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b(?:\s+(\d{4}))?/i, (m) => {
    out.dueDate = dateFrom(Number(m[1]), MONTHS[m[2].toLowerCase()], m[3] ? Number(m[3]) : null, today)
    recognised.push(`due ${out.dueDate}`)
  })
  take(/\s(?:on\s+|by\s+|due\s+)?(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/i, (m) => {
    out.dueDate = dateFrom(Number(m[2]), MONTHS[m[1].toLowerCase()], m[3] ? Number(m[3]) : null, today)
    recognised.push(`due ${out.dueDate}`)
  })
  // Quantity + unit: "20 pages", "8 glasses", "30 min"
  take(/\s(\d{1,5})\s+(pages?|glasses?|min(?:ute)?s?|km|miles?|reps?|words?|steps?|hours?|hrs?|sets?)\b/i, (m) => {
    out.targetCount = Number(m[1])
    out.unit = m[2].toLowerCase()
    recognised.push(`${m[1]} ${out.unit}`)
  })

  // Explicit type words
  take(/\s#(habit|task|milestone|checklist|project)\b/i, (m) => {
    out.type = m[1].toLowerCase() as ItemType
    recognised.push(out.type)
  })
  take(/\s(milestone):?\s/i, () => {
    out.type = 'milestone'
    recognised.push('milestone')
  })

  // A recurring item with a due date is still a habit; a one-off with a schedule word is a habit.
  if (out.type === 'habit' && !out.daysOfWeek && !out.timesPerWeek) out.daysOfWeek = [0, 1, 2, 3, 4, 5, 6]

  out.name = clean(text.replace(/\b(every|on|at|by|due|each)\s*$/i, ''))
  out.name = out.name.charAt(0).toUpperCase() + out.name.slice(1)
  return out
}

function dateFrom(day: number, month: number, year: number | null, today: string): string {
  const y = year ?? Number(today.slice(0, 4))
  let date = `${y}-${pad(month)}-${pad(day)}`
  // No year given and the date has passed: assume next year.
  if (!year && date < today) date = `${y + 1}-${pad(month)}-${pad(day)}`
  return date
}

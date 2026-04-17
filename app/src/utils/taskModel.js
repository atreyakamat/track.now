import {
  TASK_CATEGORY_META,
  TASK_DEFAULTS,
  TASK_PRIORITY_META
} from 'src/constants/taskMeta'
import { getDateKey, shiftDate } from 'src/utils/habitModel'

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const CATEGORY_KEYWORDS = [
  { category: 'shopping', words: ['buy', 'book', 'order', 'shop', 'restaurant', 'grocery'] },
  { category: 'work', words: ['meeting', 'client', 'project', 'follow up', 'email', 'deadline', 'office'] },
  { category: 'finance', words: ['payment', 'invoice', 'bill', 'bank', 'tax', 'salary'] },
  { category: 'health', words: ['doctor', 'gym', 'workout', 'medicine', 'meditation', 'walk'] },
  { category: 'learning', words: ['study', 'read', 'course', 'practice', 'learn'] },
  { category: 'family', words: ['family', 'mom', 'dad', 'kids', 'home'] },
  { category: 'personal', words: ['call', 'friend', 'personal', 'travel', 'trip'] }
]

const PRIORITY_KEYWORDS = [
  { priority: 'urgent', words: ['urgent', 'asap', 'immediately', 'right away', 'critical'] },
  { priority: 'high', words: ['important', 'high priority', 'must', 'need to'] },
  { priority: 'low', words: ['sometime', 'later', 'low priority', 'whenever'] }
]

const DAY_NAME_TO_INDEX = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6
}

const MONTH_NAME_TO_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toTime24(hours, minutes = 0, meridian = '') {
  let h = Number(hours)
  const m = Number(minutes || 0)
  const lowerMeridian = String(meridian || '').toLowerCase()

  if (lowerMeridian === 'pm' && h < 12) h += 12
  if (lowerMeridian === 'am' && h === 12) h = 0

  return `${pad2(h)}:${pad2(m)}`
}

function sanitizeTranscript(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveCategory(text) {
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.words.some((word) => text.includes(word))) {
      return entry.category
    }
  }
  return TASK_DEFAULTS.category
}

function resolvePriority(text) {
  for (const entry of PRIORITY_KEYWORDS) {
    if (entry.words.some((word) => text.includes(word))) {
      return entry.priority
    }
  }
  return TASK_DEFAULTS.priority
}

function extractRelativeDate(text, now = new Date()) {
  if (text.includes('tomorrow')) return getDateKey(shiftDate(now, 1))
  if (text.includes('today')) return getDateKey(now)
  if (/\b(thos|those)\b/.test(text) && text.includes('evening')) {
    const date = new Date(now)
    const targetDay = 4
    let delta = (targetDay - date.getDay() + 7) % 7
    if (delta === 0) delta = 7
    return getDateKey(shiftDate(date, delta))
  }

  const dayNameMatch = text.match(/\b(next\s+)?(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/)
  if (dayNameMatch) {
    const targetDay = DAY_NAME_TO_INDEX[dayNameMatch[2]]
    const date = new Date(now)
    let delta = (targetDay - date.getDay() + 7) % 7

    if (delta === 0 || dayNameMatch[1]) {
      delta += 7
    }

    return getDateKey(shiftDate(date, delta))
  }

  return ''
}

function extractExplicitDate(text, now = new Date()) {
  const slashDateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (slashDateMatch) {
    const month = Number(slashDateMatch[1])
    const day = Number(slashDateMatch[2])
    let year = slashDateMatch[3] ? Number(slashDateMatch[3]) : now.getFullYear()
    if (year < 100) year += 2000

    const parsed = new Date(year, month - 1, day)
    if (!Number.isNaN(parsed.getTime())) return getDateKey(parsed)
  }

  const monthDateMatch = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?\b/
  )
  if (monthDateMatch) {
    const monthIndex = MONTH_NAME_TO_INDEX[monthDateMatch[1]]
    const day = Number(monthDateMatch[2])
    const year = monthDateMatch[3] ? Number(monthDateMatch[3]) : now.getFullYear()
    const parsed = new Date(year, monthIndex, day)
    if (!Number.isNaN(parsed.getTime())) return getDateKey(parsed)
  }

  return ''
}

function extractTime(text) {
  const amPmMatch = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  if (amPmMatch) {
    return toTime24(amPmMatch[1], amPmMatch[2], amPmMatch[3])
  }

  const hhMmMatch = text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (hhMmMatch) {
    return toTime24(hhMmMatch[1], hhMmMatch[2], '')
  }

  if (text.includes('this evening') || text.includes('evening') || text.includes('tonight')) {
    return '19:00'
  }
  if (text.includes('this morning') || text.includes('morning')) {
    return '09:00'
  }
  if (text.includes('afternoon')) {
    return '15:00'
  }

  return ''
}

function stripIntentNoise(originalText) {
  return originalText
    .replace(/\b(remind me to|please|schedule|add task to|create task to|i need to|i want to|todo|to do)\b/gi, '')
    .replace(/\b(today|tomorrow|tonight|this evening|this morning|afternoon)\b/gi, '')
    .replace(/\b(next\s+)?(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/gi, '')
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, '')
    .replace(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:\s*,?\s*\d{4})?\b/gi,
      ''
    )
    .replace(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi, '')
    .replace(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.\s-]+|[,.\s-]+$/g, '')
    .trim()
}

export function normalizeTask(task = {}) {
  const category = TASK_CATEGORY_META[task.category]?.value || TASK_DEFAULTS.category
  const priority = TASK_PRIORITY_META[task.priority]?.value || TASK_DEFAULTS.priority
  const dueTime = TIME_PATTERN.test(task.dueTime || '') ? task.dueTime : ''

  return {
    ...TASK_DEFAULTS,
    ...task,
    title: String(task.title || '').trim(),
    notes: String(task.notes || '').trim(),
    category,
    priority,
    dueDate: String(task.dueDate || ''),
    dueTime,
    completed: Boolean(task.completed),
    source: task.source === 'voice' ? 'voice' : 'manual'
  }
}

export function formatTaskDue(task) {
  if (!task?.dueDate) return 'No due date'
  const [year, month, day] = task.dueDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  if (!task.dueTime) return dateLabel
  return `${dateLabel}, ${toDisplayTime(task.dueTime)}`
}

export function toDisplayTime(value) {
  if (!TIME_PATTERN.test(value || '')) return ''
  const [hours, minutes] = value.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function compareTasks(a, b) {
  const dateA = a.dueDate || '9999-12-31'
  const dateB = b.dueDate || '9999-12-31'
  if (dateA !== dateB) return dateA.localeCompare(dateB)

  const timeA = a.dueTime || '23:59'
  const timeB = b.dueTime || '23:59'
  if (timeA !== timeB) return timeA.localeCompare(timeB)

  const tsA = Date.parse(a.createdAt || 0)
  const tsB = Date.parse(b.createdAt || 0)
  return tsA - tsB
}

export function parseVoiceTask(transcript, baseDate = new Date()) {
  const cleanTranscript = sanitizeTranscript(transcript)
  const lower = cleanTranscript.toLowerCase()

  const explicitDate = extractExplicitDate(lower, baseDate)
  const relativeDate = extractRelativeDate(lower, baseDate)
  const dueDate = explicitDate || relativeDate
  const dueTime = extractTime(lower)
  const category = resolveCategory(lower)
  const priority = resolvePriority(lower)
  const suggestedTitle = stripIntentNoise(cleanTranscript)

  return normalizeTask({
    title: suggestedTitle || cleanTranscript,
    category,
    priority,
    dueDate,
    dueTime,
    source: 'voice',
    voiceTranscript: cleanTranscript
  })
}

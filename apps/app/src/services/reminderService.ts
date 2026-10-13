import type { ItemReminder, ReminderPreset, ReminderStatus } from '@/types/notifications'
import type { ExecutionItem } from '@/types/domain'

/**
 * Device-local smart reminders.
 *
 * Reminders live in user-namespaced localStorage (`tracknow_reminders_<userId>`). They are
 * NOT synced to the server or to other devices, and they can only fire while Track.now is
 * open in a browser tab (see webNotificationEngine). Reminders that came due while the app
 * was closed are caught up when it is reopened.
 */
const REMINDERS_STORAGE_PREFIX = 'tracknow_reminders_'
const MINUTE = 60 * 1000
/** Delivered/cancelled records older than this are pruned on every save. */
export const REMINDER_HISTORY_RETENTION_MS = 30 * 24 * 60 * MINUTE
/** Hard cap on stored records to keep parsing cheap. */
export const MAX_STORED_REMINDERS = 300
/** At most this many individual notifications are shown in one sweep; the rest become a digest. */
export const REMINDER_FLOOD_CAP = 3

const VALID_STATUSES: ReadonlySet<ReminderStatus> = new Set([
  'upcoming',
  'delivered',
  'snoozed',
  'cancelled',
  'dismissed',
])

const SCHEDULE_RELATIVE_PRESETS: ReadonlySet<ReminderPreset> = new Set([
  'scheduled_time',
  '10m_before',
  '30m_before',
  '1h_before',
  '2h_before',
])

export function getRemindersKey(userId: string): string {
  return `${REMINDERS_STORAGE_PREFIX}${userId}`
}

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(new Date(value).getTime())

/** Structural validation for a stored reminder (protects against corrupted/stale storage). */
export function isValidReminder(value: unknown, userId?: string): value is ItemReminder {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.itemId !== 'string' || typeof r.userId !== 'string') return false
  if (userId && r.userId !== userId) return false
  if (typeof r.itemName !== 'string' || typeof r.preset !== 'string') return false
  if (!isIsoDate(r.remindAt)) return false
  if (typeof r.status !== 'string' || !VALID_STATUSES.has(r.status as ReminderStatus)) return false
  // Optional fields: when present they must have the right shape, or later code (re-arming,
  // labels, pruning) could throw or compute garbage dates.
  if (r.planId !== undefined && r.planId !== null && (typeof r.planId !== 'string' || !SAFE_ID_RE.test(r.planId)))
    return false
  if (r.trackId !== undefined && r.trackId !== null && typeof r.trackId !== 'string') return false
  if (r.updatedAt !== undefined && typeof r.updatedAt !== 'string') return false
  if (r.createdAt !== undefined && typeof r.createdAt !== 'string') return false
  if (r.itemType !== undefined && r.itemType !== null && (typeof r.itemType !== 'string' || !ITEM_TYPES.has(r.itemType)))
    return false
  for (const key of ['snoozedUntil', 'deliveredAt', 'occursAt'] as const) {
    const v = r[key]
    if (v !== undefined && v !== null && !isIsoDate(v)) return false
  }
  if (r.scheduleSnapshot !== undefined && r.scheduleSnapshot !== null && !isValidScheduleSnapshot(r.scheduleSnapshot))
    return false
  return true
}

const ITEM_TYPES: ReadonlySet<string> = new Set(['habit', 'task', 'checklist', 'milestone', 'project'])
const FREQUENCIES: ReadonlySet<string> = new Set(['daily', 'weekly', 'monthly', 'custom'])
/** planId is interpolated into a route (`/plans/<id>`), so only plain id characters are accepted. */
const SAFE_ID_RE = /^[A-Za-z0-9_-]{0,64}$/
const REMINDER_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

function isValidScheduleSnapshot(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const s = value as Record<string, unknown>
  if (typeof s.frequency !== 'string' || !FREQUENCIES.has(s.frequency)) return false
  if (s.days_of_week !== undefined && s.days_of_week !== null) {
    if (!Array.isArray(s.days_of_week)) return false
    if (!s.days_of_week.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return false
  }
  if (s.time_of_day !== undefined && s.time_of_day !== null && typeof s.time_of_day !== 'string') return false
  if (s.reminder_time !== undefined && s.reminder_time !== null) {
    if (typeof s.reminder_time !== 'string' || !REMINDER_TIME_RE.test(s.reminder_time)) return false
  }
  return true
}

export function loadUserReminders(userId: string): ItemReminder[] {
  if (!userId || typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(getRemindersKey(userId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((r): r is ItemReminder => isValidReminder(r, userId))
  } catch {
    // Corrupted JSON: treat as empty; the next save rewrites a clean array.
    return []
  }
}

/** Drops old terminal records and caps total size (newest kept). */
export function pruneReminders(reminders: ItemReminder[], now = new Date()): ItemReminder[] {
  const cutoff = now.getTime() - REMINDER_HISTORY_RETENTION_MS
  const kept = reminders.filter((r) => {
    if (r.status === 'upcoming' || r.status === 'snoozed') return true
    const stamp = new Date(r.updatedAt || r.deliveredAt || r.remindAt).getTime()
    return Number.isNaN(stamp) || stamp >= cutoff
  })
  if (kept.length <= MAX_STORED_REMINDERS) return kept
  const active = kept.filter((r) => r.status === 'upcoming' || r.status === 'snoozed')
  const history = kept
    .filter((r) => r.status !== 'upcoming' && r.status !== 'snoozed')
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return [...active, ...history].slice(0, MAX_STORED_REMINDERS)
}

export function saveUserReminders(userId: string, reminders: ItemReminder[]): boolean {
  if (!userId) return false
  try {
    const pruned = pruneReminders(reminders)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getRemindersKey(userId), JSON.stringify(pruned))
    }
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tracknow:reminders-updated', { detail: { userId, count: pruned.length } }),
      )
    }
    return true
  } catch {
    return false
  }
}


function resolveTimeOfDay(schedule: Partial<ExecutionItem>['schedule']): { hours: number; minutes: number } {
  if (schedule?.reminder_time) {
    const [h, m] = schedule.reminder_time.split(':')
    const hours = parseInt(h, 10)
    const minutes = parseInt(m, 10)
    if (Number.isFinite(hours) && Number.isFinite(minutes)) return { hours, minutes }
  }
  switch (schedule?.time_of_day) {
    case 'morning':
      return { hours: 8, minutes: 30 }
    case 'afternoon':
      return { hours: 13, minutes: 30 }
    case 'evening':
      return { hours: 19, minutes: 0 }
    default:
      return { hours: 9, minutes: 0 }
  }
}

function parseDueDate(item: Partial<ExecutionItem>): { y: number; m: number; d: number } | null {
  if (!item.due_date) return null
  const parts = item.due_date.split('-').map((p) => parseInt(p, 10))
  if (parts.length !== 3 || !parts.every(Number.isFinite)) return null
  return { y: parts[0], m: parts[1], d: parts[2] }
}

/** Habits are always schedule-driven: a stray due_date on a habit must not pin its reminder. */
function isScheduleDriven(item?: Partial<ExecutionItem> | null): boolean {
  if (!item) return false
  if (item.type === 'habit') return true
  return !parseDueDate(item) && Boolean(item.schedule)
}

/** End of the local calendar day containing `now` (23:59:59.999). */
export function endOfLocalDay(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
}

/**
 * Finds the next occurrence of a recurring schedule such that
 *  - its reminder instant (occurrence - offsetMinutes) is strictly after `now`, and
 *  - the occurrence itself is strictly after `after` (when given), e.g. the occurrence that was
 *    just delivered, or the end of today when today's occurrence is already completed.
 */
export function findNextScheduledOccurrence(
  schedule: Partial<ExecutionItem>['schedule'] | undefined,
  offsetMinutes: number,
  now = new Date(),
  after?: Date | null,
): Date | null {
  const { hours, minutes } = resolveTimeOfDay(schedule ?? null)
  const isDayActive = (date: Date) => {
    if (!schedule || schedule.frequency === 'daily' || !schedule.days_of_week?.length) return true
    return schedule.days_of_week.includes(date.getDay())
  }
  const afterMs = after && Number.isFinite(after.getTime()) ? after.getTime() : -Infinity
  const nowMs = now.getTime()
  // Start from whichever is later (today or the day of `after`), then scan 9 days, which always
  // covers a full week of a weekly/custom schedule.
  const base = afterMs > nowMs ? (after as Date) : now
  for (let i = 0; i <= 8; i++) {
    const occurrence = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, hours, minutes, 0, 0)
    if (!isDayActive(occurrence)) continue
    if (occurrence.getTime() <= afterMs) continue
    if (occurrence.getTime() - offsetMinutes * MINUTE <= nowMs) continue
    return occurrence
  }
  return null
}

/**
 * Resolves the target scheduled or due Date for an item (local time).
 * - Habits: the next scheduled occurrence after `now` (any due_date on a habit is ignored).
 * - Other items with a due date: that date at the schedule's time (default 09:00).
 * - Other items with only a schedule: the next scheduled occurrence after `now`.
 * Returns null when the item has neither a due date nor a schedule.
 */
export function getItemTargetTime(
  item?: Partial<ExecutionItem> | null,
  now = new Date(),
): Date | null {
  if (!item) return null

  if (!isScheduleDriven(item)) {
    const due = parseDueDate(item)
    if (!due) return null
    const { hours, minutes } = resolveTimeOfDay(item.schedule)
    return new Date(due.y, due.m - 1, due.d, hours, minutes, 0, 0)
  }

  return findNextScheduledOccurrence(item.schedule, 0, now)
}

const OFFSETS: Partial<Record<ReminderPreset, number>> = {
  '10m_in': 10,
  '30m_in': 30,
  '1h_in': 60,
  '2h_in': 120,
  // legacy aliases ("in X")
  '10m': 10,
  '30m': 30,
  '1h': 60,
  '2h': 120,
}

const BEFORE_OFFSETS: Partial<Record<ReminderPreset, number>> = {
  scheduled_time: 0,
  '10m_before': 10,
  '30m_before': 30,
  '1h_before': 60,
  '2h_before': 120,
}

export interface ReminderTimingOptions {
  /**
   * Schedule-driven items only: ignore occurrences at or before this instant. Used when today's
   * occurrence of a habit is already completed (pass the end of today) or was just delivered.
   */
  occurrenceAfter?: Date | null
}

interface ComputedReminder {
  remindAt: string
  /** The due/scheduled occurrence this reminder belongs to (null for countdown / custom). */
  occursAt: string | null
}

function computeReminder(
  preset: ReminderPreset,
  item: Partial<ExecutionItem> | null | undefined,
  customIso: string | undefined,
  now: Date,
  options?: ReminderTimingOptions,
): ComputedReminder | null {
  if (preset === 'none') return null

  if (preset === 'exact_time') {
    if (!customIso) return null
    const parsed = new Date(customIso)
    return Number.isNaN(parsed.getTime()) ? null : { remindAt: parsed.toISOString(), occursAt: null }
  }

  const inMinutes = OFFSETS[preset]
  if (inMinutes !== undefined) return { remindAt: new Date(now.getTime() + inMinutes * MINUTE).toISOString(), occursAt: null }

  const beforeMinutes = BEFORE_OFFSETS[preset]
  if (beforeMinutes === undefined) return null

  if (isScheduleDriven(item)) {
    // Recurring: pick the first occurrence whose reminder is still in the future, so a
    // "1 hour before 00:30" habit reminder is never computed as an already-past instant.
    const occurrence = findNextScheduledOccurrence(item?.schedule, beforeMinutes, now, options?.occurrenceAfter)
    if (!occurrence) return null
    return {
      remindAt: new Date(occurrence.getTime() - beforeMinutes * MINUTE).toISOString(),
      occursAt: occurrence.toISOString(),
    }
  }

  const target = getItemTargetTime(item, now)
  if (!target) return null
  return { remindAt: new Date(target.getTime() - beforeMinutes * MINUTE).toISOString(), occursAt: target.toISOString() }
}

/**
 * Calculates the exact target ISO timestamp for a preset and item context.
 * - "_in" presets count from `now`.
 * - "_before" presets count back from the item's due/scheduled time; without one they
 *   return null (the caller must ask for a due date instead of guessing).
 * - "scheduled_time" uses the due/scheduled time.
 * - "exact_time" parses `customIso` (a `YYYY-MM-DDTHH:mm` value is local time).
 */
export function calculateReminderTime(
  preset: ReminderPreset,
  item?: Partial<ExecutionItem> | null,
  customIso?: string,
  now = new Date(),
  options?: ReminderTimingOptions,
): string | null {
  return computeReminder(preset, item, customIso, now, options)?.remindAt ?? null
}

export interface ReminderPreview {
  remindAt: string | null
  error: string | null
}

/**
 * Validates a reminder choice before anything is saved, so the UI can explain the problem
 * instead of silently dropping or immediately firing the reminder.
 */
export function previewReminder(
  preset: ReminderPreset,
  item: Partial<ExecutionItem>,
  customIso?: string,
  now = new Date(),
  options?: ReminderTimingOptions,
): ReminderPreview {
  if (preset === 'none') return { remindAt: null, error: null }
  if (preset === 'exact_time' && !customIso) {
    return { remindAt: null, error: 'Choose a date and time for the custom reminder.' }
  }
  const remindAt = calculateReminderTime(preset, item, customIso, now, options)
  if (!remindAt) {
    if (preset === 'exact_time') return { remindAt: null, error: 'The custom reminder date and time is not valid.' }
    return {
      remindAt: null,
      error:
        item.type === 'habit'
          ? 'This habit has no schedule to remind you about.'
          : 'Set a due date first: this reminder is relative to the due date (09:00 unless a time is set).',
    }
  }
  if (new Date(remindAt).getTime() <= now.getTime()) {
    return {
      remindAt: null,
      error: 'That reminder time has already passed. Pick a later time or a "from now" option.',
    }
  }
  return { remindAt, error: null }
}

/** Whether a preset is relative to the item's due/scheduled time. */
export function isScheduleRelativePreset(preset: ReminderPreset): boolean {
  return SCHEDULE_RELATIVE_PRESETS.has(preset)
}

/** Retrieves the active (upcoming or snoozed) reminder for a specific item. */
export function getReminderForItem(userId: string, itemId: string): ItemReminder | null {
  const all = loadUserReminders(userId)
  return all.find((r) => r.itemId === itemId && (r.status === 'upcoming' || r.status === 'snoozed')) || null
}

const newReminderId = () => `rem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

function snapshotSchedule(item: Partial<ExecutionItem>): ItemReminder['scheduleSnapshot'] {
  return item.schedule
    ? {
        frequency: item.schedule.frequency,
        days_of_week: item.schedule.days_of_week ?? null,
        time_of_day: item.schedule.time_of_day ?? null,
        reminder_time: item.schedule.reminder_time ?? null,
      }
    : null
}

/**
 * Creates or replaces the reminder for an execution item.
 * Throws when the requested time cannot be resolved or is already in the past.
 */
export function setReminderForItem(
  userId: string,
  item: ExecutionItem,
  preset: ReminderPreset,
  customTimeIso?: string,
  now = new Date(),
  options?: ReminderTimingOptions,
): ItemReminder | null {
  if (!userId || !item?.id) return null

  const others = loadUserReminders(userId).filter((r) => r.itemId !== item.id)

  if (preset === 'none') {
    saveUserReminders(userId, others)
    return null
  }

  const { remindAt, error } = previewReminder(preset, item, customTimeIso, now, options)
  if (!remindAt) throw new Error(error ?? 'Could not schedule this reminder.')
  const occursAt = computeReminder(preset, item, customTimeIso, now, options)?.occursAt ?? null

  const stamp = now.toISOString()
  const reminder: ItemReminder = {
    id: newReminderId(),
    itemId: item.id,
    userId,
    itemName: item.name,
    itemType: item.type,
    scheduleSnapshot: snapshotSchedule(item),
    planId: item.plan_id,
    trackId: item.track_id,
    preset,
    remindAt,
    occursAt,
    status: 'upcoming',
    snoozedUntil: null,
    deliveredAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  }

  others.push(reminder)
  if (!saveUserReminders(userId, others)) {
    throw new Error('The reminder could not be saved on this device (storage unavailable or full).')
  }
  return reminder
}

/**
 * Updates the descriptive fields (name, type, plan, schedule snapshot) of an item's active
 * reminder without moving it. Used when an edit leaves the reminder timing unchanged.
 */
export function refreshReminderItemDetails(userId: string, item: ExecutionItem, now = new Date()): ItemReminder | null {
  if (!userId || !item?.id) return null
  const all = loadUserReminders(userId)
  let found: ItemReminder | null = null
  for (const r of all) {
    if (r.itemId !== item.id || (r.status !== 'upcoming' && r.status !== 'snoozed')) continue
    r.itemName = item.name
    r.itemType = item.type
    r.planId = item.plan_id
    r.trackId = item.track_id
    r.scheduleSnapshot = snapshotSchedule(item)
    r.updatedAt = now.toISOString()
    found = r
  }
  if (found) saveUserReminders(userId, all)
  return found
}

const normalizeTimeOfDay = (tod: string | null | undefined) => (tod && tod !== 'anytime' ? tod : 'anytime')

function scheduleTimingKey(item: Partial<ExecutionItem>): string {
  const s = item.schedule
  if (!s) return 'none'
  const days = s.frequency === 'daily' ? '' : [...(s.days_of_week ?? [])].sort((a, b) => a - b).join(',')
  return [s.frequency, days, normalizeTimeOfDay(s.time_of_day), (s.reminder_time ?? '').slice(0, 5)].join('|')
}

/**
 * Edit flow: true when the existing reminder can be kept as-is because neither the preset nor
 * anything its time depends on changed (due date, schedule, type, custom time). Keeping it
 * preserves snoozes, avoids "already passed" errors for an unchanged overdue reminder, and
 * avoids re-arming today's occurrence of a habit that is already done.
 */
export function isReminderTimingUnchanged(args: {
  existing: ItemReminder | null
  preset: ReminderPreset
  exactTimeInput?: string
  before: Partial<ExecutionItem>
  after: Partial<ExecutionItem>
}): boolean {
  const { existing, preset, exactTimeInput, before, after } = args
  if (!existing || existing.preset !== preset) return false
  if (preset === 'none') return true
  if (OFFSETS[preset] !== undefined) return true // countdown: never depends on the item
  if (preset === 'exact_time') return toLocalDateTimeInputValue(existing.remindAt) === (exactTimeInput ?? '')
  if ((before.type ?? null) !== (after.type ?? null)) return false
  if ((before.due_date || null) !== (after.due_date || null)) return false
  return scheduleTimingKey(before) === scheduleTimingKey(after)
}

/**
 * Cancels matching active reminders and retires matching DELIVERED records (status
 * 'dismissed'), so a reminder toast still on screen can never be snoozed back to life and a
 * habit completion can never re-arm a reminder the user removed. Returns how many ACTIVE
 * reminders were cancelled.
 */
function markCancelled(
  userId: string,
  predicate: (r: ItemReminder) => boolean,
  now = new Date(),
): number {
  const all = loadUserReminders(userId)
  let cancelled = 0
  let changed = false
  const stamp = now.toISOString()
  const updated = all.map((r) => {
    if ((r.status === 'upcoming' || r.status === 'snoozed') && predicate(r)) {
      cancelled += 1
      changed = true
      return { ...r, status: 'cancelled' as const, updatedAt: stamp }
    }
    if (r.status === 'delivered' && predicate(r)) {
      changed = true
      return { ...r, status: 'dismissed' as const, updatedAt: stamp }
    }
    return r
  })
  if (changed) saveUserReminders(userId, updated)
  return cancelled
}

/** Cancels the active reminder for a specific item (completion, deletion). */
export function cancelReminderForItem(userId: string, itemId: string): void {
  if (!userId || !itemId) return
  markCancelled(userId, (r) => r.itemId === itemId)
}

/** Cancels all active reminders belonging to a plan (archive/delete). */
export function cancelRemindersForPlan(userId: string, planId: string): void {
  if (!userId || !planId) return
  markCancelled(userId, (r) => r.planId === planId)
}

/** Cancels all active reminders belonging to a track (archive/delete). */
export function cancelRemindersForTrack(userId: string, trackId: string, planIds: string[] = []): void {
  if (!userId || !trackId) return
  const plans = new Set(planIds)
  markCancelled(userId, (r) => r.trackId === trackId || plans.has(r.planId))
}

/**
 * Cancels active reminders whose item is no longer in the active set (deleted elsewhere,
 * or its plan/track was archived). Call only with the COMPLETE active item list.
 */
export function reconcileRemindersWithActiveItems(userId: string, activeItemIds: Iterable<string>): number {
  if (!userId) return 0
  const active = new Set(activeItemIds)
  return markCancelled(userId, (r) => !active.has(r.itemId))
}

/** The due/scheduled occurrence a reminder belongs to (falls back to remindAt + offset). */
function occurrenceOf(r: ItemReminder): Date {
  if (r.occursAt) {
    const at = new Date(r.occursAt)
    if (Number.isFinite(at.getTime())) return at
  }
  return new Date(new Date(r.remindAt).getTime() + (BEFORE_OFFSETS[r.preset] ?? 0) * MINUTE)
}

export interface ReminderReconcileResult {
  cancelled: number
  advanced: number
}

/**
 * Reconciles stored reminders with the server state (COMPLETE list of active items + today's
 * completions), so reminders for items completed, deleted or archived elsewhere (another
 * device/tab, or while this tab was closed) never fire:
 *  - item missing / archived, or a non-habit marked done -> cancelled;
 *  - a habit already completed today whose reminder still targets today's occurrence ->
 *    moved to its next occurrence.
 */
export function reconcileRemindersWithSnapshot(
  userId: string,
  items: ExecutionItem[],
  completedTodayIds: Iterable<string>,
  now = new Date(),
): ReminderReconcileResult {
  if (!userId) return { cancelled: 0, advanced: 0 }
  const byId = new Map(items.map((i) => [i.id, i]))
  const completed = new Set(completedTodayIds)

  const cancelled = markCancelled(
    userId,
    (r) => {
      const item = byId.get(r.itemId)
      if (!item || item.status === 'archived') return true
      return item.type !== 'habit' && item.status === 'done'
    },
    now,
  )

  const endOfToday = endOfLocalDay(now).getTime()
  const toAdvance = new Map<string, ExecutionItem>()
  const oneOffForDoneHabits = new Set<string>()
  for (const r of loadUserReminders(userId)) {
    if (r.status !== 'upcoming' && r.status !== 'snoozed') continue
    const item = byId.get(r.itemId)
    if (!item || item.type !== 'habit' || !completed.has(item.id)) continue
    if (!SCHEDULE_RELATIVE_PRESETS.has(r.preset)) {
      // A countdown / custom-time reminder for a habit already completed today is moot.
      if (new Date(r.remindAt).getTime() <= endOfToday) oneOffForDoneHabits.add(r.id)
      continue
    }
    if (occurrenceOf(r).getTime() <= endOfToday) toAdvance.set(item.id, item)
  }
  const extraCancelled = oneOffForDoneHabits.size ? markCancelled(userId, (r) => oneOffForDoneHabits.has(r.id), now) : 0
  let advanced = 0
  toAdvance.forEach((item) => {
    if (advanceHabitReminderToNextOccurrence(userId, item, now)) advanced += 1
  })
  return { cancelled: cancelled + extraCancelled, advanced }
}

/** Statuses that may be snoozed. Cancelled/dismissed reminders stay retired. */
const SNOOZABLE: ReadonlySet<ReminderStatus> = new Set(['upcoming', 'snoozed', 'delivered'])

/**
 * Snoozes a reminder. An already-fired (or overdue) reminder is pushed to now + minutes;
 * a reminder that has not fired yet is delayed by `minutes` from its current time
 * (snoozing never pulls a reminder earlier). Cancelled or dismissed reminders (item
 * completed, deleted, archived, or reminder removed) are never revived: returns null.
 */
export function snoozeReminder(userId: string, reminderId: string, minutes = 10, now = new Date()): ItemReminder | null {
  const all = loadUserReminders(userId)
  const target = all.find((r) => r.id === reminderId)
  if (!target || !SNOOZABLE.has(target.status)) return null

  const current = new Date(target.remindAt).getTime()
  const base = Number.isFinite(current) && current > now.getTime() ? current : now.getTime()
  const snoozedUntil = new Date(base + minutes * MINUTE).toISOString()
  target.status = 'snoozed'
  target.snoozedUntil = snoozedUntil
  target.remindAt = snoozedUntil
  target.updatedAt = now.toISOString()

  if (!saveUserReminders(userId, all)) return null
  return target
}

/** Marks a reminder as delivered. */
export function markReminderDelivered(userId: string, reminderId: string, now = new Date()): void {
  const all = loadUserReminders(userId)
  const target = all.find((r) => r.id === reminderId)
  if (!target) return
  target.status = 'delivered'
  target.deliveredAt = now.toISOString()
  target.updatedAt = now.toISOString()
  saveUserReminders(userId, all)
}

export function isRecurringHabitReminder(r: Pick<ItemReminder, 'itemType' | 'preset'>): boolean {
  return r.itemType === 'habit' && SCHEDULE_RELATIVE_PRESETS.has(r.preset)
}

/** Reminders overdue by more than this on catch-up are only summarised, never fired one by one. */
export const REMINDER_STALE_AFTER_MS = 24 * 60 * MINUTE

export interface DueReminderSweep {
  /** Reminders to show individually (most recent first-due order, at most REMINDER_FLOOD_CAP). */
  deliver: ItemReminder[]
  /**
   * Reminders that also came due but are summarised in one digest instead: anything overdue by
   * more than REMINDER_STALE_AFTER_MS (catch-up after a long absence) plus older ones beyond the
   * flood cap.
   */
  overflow: ItemReminder[]
}

/**
 * Collects matured reminders exactly once. Every returned reminder is marked delivered in
 * storage before returning, so concurrent sweeps/tabs cannot deliver it twice. The caller must
 * show them synchronously (see webNotificationEngine) so a claimed reminder is never lost.
 * Reminders overdue by more than a day are summarised in the digest only; of the rest, at most
 * REMINDER_FLOOD_CAP (the most recent) are delivered individually.
 *
 * Recurring habit reminders are not retired after delivery: their stored record is moved to
 * the next occurrence by the caller via `rescheduleRecurringAfterDelivery`.
 */
export function collectDueReminders(userId: string, now = new Date()): DueReminderSweep {
  if (!userId) return { deliver: [], overflow: [] }
  const all = loadUserReminders(userId)
  const nowMs = now.getTime()

  const due = all
    .filter((r) => (r.status === 'upcoming' || r.status === 'snoozed') && new Date(r.remindAt).getTime() <= nowMs)
    .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime())

  if (due.length === 0) return { deliver: [], overflow: [] }

  const nowIso = now.toISOString()
  due.forEach((r) => {
    r.status = 'delivered'
    r.deliveredAt = nowIso
    r.updatedAt = nowIso
  })
  saveUserReminders(userId, all)

  const isStale = (r: ItemReminder) => nowMs - new Date(r.remindAt).getTime() > REMINDER_STALE_AFTER_MS
  const fresh = due.filter((r) => !isStale(r))
  const stale = due.filter(isStale)
  const deliver = fresh.slice(-REMINDER_FLOOD_CAP)
  const overflow = [...stale, ...fresh.slice(0, Math.max(0, fresh.length - REMINDER_FLOOD_CAP))]
  return { deliver: deliver.map((r) => ({ ...r })), overflow: overflow.map((r) => ({ ...r })) }
}

/** Backwards-compatible wrapper returning only the individually delivered reminders. */
export function checkDueReminders(userId: string, now = new Date()): ItemReminder[] {
  return collectDueReminders(userId, now).deliver
}

/** Clears all reminders for a user (manual sign-out). */
export function clearRemindersForUser(userId: string): void {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(getRemindersKey(userId))
  } catch {
    /* storage unavailable */
  }
}

/**
 * Recalculates a schedule/due-relative reminder after the item is rescheduled.
 * Countdown and exact-time reminders are left untouched.
 */
export function rescheduleReminderForItem(
  userId: string,
  item: ExecutionItem,
  now = new Date(),
): ItemReminder | null {
  if (!userId || !item?.id) return null
  const existing = getReminderForItem(userId, item.id)
  if (!existing) return null
  if (!SCHEDULE_RELATIVE_PRESETS.has(existing.preset)) return existing
  return setReminderForItem(userId, item, existing.preset, undefined, now)
}

/**
 * Moves a recurring habit reminder to its next scheduled occurrence.
 *
 * The next occurrence is the first one whose reminder time is still in the future AND which is
 * after `afterOccurrence`. By default (habit completed for today) that is the end of today, so
 * today's occurrence is skipped. After a reminder is delivered the caller passes the delivered
 * occurrence instead, so a catch-up on a later day still re-arms today's later occurrence.
 */
export function advanceHabitReminderToNextOccurrence(
  userId: string,
  item: ExecutionItem,
  now = new Date(),
  options: { afterOccurrence?: Date; source?: ItemReminder } = {},
): ItemReminder | null {
  if (!userId || !item?.id || item.type !== 'habit') return null
  const all = loadUserReminders(userId)
  // Only an ACTIVE reminder (or the one just delivered, passed explicitly by the delivery
  // path) is advanced. Old delivered history must never re-create a reminder the user removed.
  const existing =
    options.source ??
    all
      .filter((r) => r.itemId === item.id && (r.status === 'upcoming' || r.status === 'snoozed'))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0]
  if (!existing || !SCHEDULE_RELATIVE_PRESETS.has(existing.preset)) return null

  const after = options.afterOccurrence ?? endOfLocalDay(now)
  const next = computeReminder(existing.preset, { ...item, due_date: null }, undefined, now, { occurrenceAfter: after })
  if (!next || new Date(next.remindAt).getTime() <= now.getTime()) return null

  const stamp = now.toISOString()
  const nextReminder: ItemReminder = {
    ...existing,
    id: newReminderId(),
    itemName: item.name,
    itemType: 'habit',
    remindAt: next.remindAt,
    occursAt: next.occursAt,
    status: 'upcoming',
    snoozedUntil: null,
    deliveredAt: null,
    updatedAt: stamp,
  }
  const updated = all.filter((r) => !(r.itemId === item.id && (r.status === 'upcoming' || r.status === 'snoozed')))
  updated.push(nextReminder)
  saveUserReminders(userId, updated)
  return nextReminder
}

/**
 * Reminder bookkeeping when an item is completed (today):
 *  - a habit's schedule-relative reminder moves to its next scheduled occurrence;
 *  - anything else (one-off items, or a countdown / custom-time reminder on a habit) is
 *    cancelled, so it can no longer fire for work that is already done.
 */
export function settleRemindersAfterCompletion(userId: string, item: ExecutionItem, now = new Date()): void {
  if (!userId || !item?.id) return
  if (item.type === 'habit' && advanceHabitReminderToNextOccurrence(userId, item, now)) return
  cancelReminderForItem(userId, item.id)
}

/**
 * After delivery, recurring habit reminders are re-armed for the habit's next scheduled
 * occurrence after the one just delivered (using the stored schedule snapshot) so "daily"
 * reminders keep working. A failure for one reminder never prevents re-arming the others.
 */
export function rescheduleRecurringAfterDelivery(
  userId: string,
  delivered: ItemReminder[],
  now = new Date(),
): ItemReminder[] {
  const rearmed: ItemReminder[] = []
  for (const rem of delivered) {
    try {
      if (!isRecurringHabitReminder(rem) || !rem.scheduleSnapshot) continue
      const habitLike = {
        id: rem.itemId,
        user_id: userId,
        plan_id: rem.planId,
        track_id: rem.trackId,
        type: 'habit',
        name: rem.itemName,
        description: null,
        status: 'todo',
        priority: 'medium',
        due_date: null,
        created_at: rem.createdAt,
        updated_at: rem.updatedAt,
        schedule: { id: '', item_id: rem.itemId, created_at: '', ...rem.scheduleSnapshot },
      } as ExecutionItem
      const next = advanceHabitReminderToNextOccurrence(userId, habitLike, now, {
        afterOccurrence: occurrenceOf(rem),
        source: rem,
      })
      if (next) rearmed.push(next)
    } catch {
      // A malformed record must not stop the remaining reminders from being re-armed.
    }
  }
  return rearmed
}

/** Formats a reminder's target time into a user-friendly label. */
export function formatReminderLabel(reminder: ItemReminder, now = new Date()): string {
  const targetDate =
    reminder.status === 'snoozed' && reminder.snoozedUntil
      ? new Date(reminder.snoozedUntil)
      : new Date(reminder.remindAt)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const timeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const monthStr = targetDate.toLocaleDateString([], { month: 'short', day: 'numeric' })

  const when = sameDay(targetDate, now)
    ? `Today ${timeStr}`
    : sameDay(targetDate, tomorrow)
      ? `Tomorrow ${timeStr}`
      : `${monthStr}, ${timeStr}`

  if (reminder.status === 'snoozed') return `Snoozed (${sameDay(targetDate, now) ? timeStr : when})`
  return when
}

/** Converts an ISO instant to the `YYYY-MM-DDTHH:mm` local value a datetime-local input expects. */
export function toLocalDateTimeInputValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

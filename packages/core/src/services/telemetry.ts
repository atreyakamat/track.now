import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { loadPreferences } from './preferences'

/**
 * First-party usage events and error reports (table track_now_client_events, migration
 * 20261110000000). Rows are buffered in memory and inserted in batches.
 *
 * - Nothing here ever throws into the caller: every failure is swallowed.
 * - Nothing is sent while signed out, when Supabase is not configured, or when the user
 *   switched off "Share usage and error reports" (checked at flush time).
 * - The app ships before the migration is applied: the first "table not found" answer
 *   switches sending off for the rest of the session.
 * - Privacy: props are primitives only and never carry text typed by the user.
 */

export type TelemetryApp = 'web' | 'mobile'
export type TelemetryProps = Record<string, string | number | boolean | null>

export const TELEMETRY_TABLE = 'track_now_client_events'

const FLUSH_SIZE = 20
const FLUSH_DELAY_MS = 10_000
/** Rows kept for a retry after a failed request (the newest win). */
const MAX_RETAINED_ROWS = 100
/** Events fired just before the user is known (e.g. around sign-in). */
const MAX_PRE_AUTH_ROWS = 10
const MAX_SESSION_ROWS = 200
const MAX_SAME_ERROR = 3
const MAX_PROP_KEYS = 12
const MAX_KEY_LENGTH = 40
const MAX_STRING_LENGTH = 200
const MAX_NAME_LENGTH = 80
const MAX_MESSAGE_LENGTH = 300
const MAX_STACK_LENGTH = 1500
const MAX_VERSION_LENGTH = 40
/** The table rejects props over 4096 bytes; stay clear of it (multi-byte text counts more). */
const MAX_PROPS_BYTES = 3600

interface PendingRow {
  kind: 'event' | 'error'
  name: string
  props: TelemetryProps
  app: TelemetryApp
  app_version: string | null
  session_id: string
}
type Row = PendingRow & { user_id: string }

interface PgError {
  code?: string
  message?: string
}

let config: { app: TelemetryApp; appVersion: string | null } | null = null
let userId: string | null = null
let sessionId = newSessionId()
let queue: Row[] = []
let preAuth: PendingRow[] = []
let timer: ReturnType<typeof setTimeout> | undefined
/** The table does not exist yet (migration not applied): stop for this session. */
let disabled = false
/** The last request failed; wait for the timer instead of sending on every new row. */
let failing = false
let accepted = 0
let sessionStarted = false
let errorCounts = new Map<string, number>()
let chain: Promise<void> = Promise.resolve()

function newSessionId(): string {
  const bytes = new Uint8Array(16)
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Upper bound of the UTF-8 size of a string. */
function byteLength(value: string): number {
  let bytes = 0
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3
  }
  return bytes
}

/** At most `maxChars` characters and `maxBytes` bytes. */
function clip(value: string, maxChars: number, maxBytes = maxChars * 3): string {
  let out = value.slice(0, maxChars)
  while (byteLength(out) > maxBytes) out = out.slice(0, Math.floor(out.length * 0.8))
  return out
}

function sanitizeProps(props: unknown): TelemetryProps {
  const out: TelemetryProps = {}
  if (!props || typeof props !== 'object') return out
  let count = 0
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (count >= MAX_PROP_KEYS) break
    const k = key.slice(0, MAX_KEY_LENGTH)
    if (typeof value === 'string') out[k] = value.slice(0, MAX_STRING_LENGTH)
    else if (typeof value === 'boolean' || value === null) out[k] = value
    else if (typeof value === 'number') out[k] = Number.isFinite(value) ? value : null
    else continue // objects, arrays and functions are never sent
    count++
  }
  return out
}

function describeError(error: unknown): { name: string; message: string; stack: string } {
  let className = ''
  let message = ''
  let stack = ''
  if (typeof error === 'string') {
    message = error
  } else if (error && typeof error === 'object') {
    const e = error as { name?: unknown; message?: unknown; stack?: unknown }
    if (typeof e.name === 'string') className = e.name
    if (typeof e.message === 'string') message = e.message
    if (typeof e.stack === 'string') stack = e.stack
  }
  if (!message && !className && error !== null && error !== undefined) {
    try {
      message = String(error)
    } catch {
      message = ''
    }
  }
  // A bare "Error" says nothing: group those by the start of their message instead.
  const name = (className && className !== 'Error' ? className : message || className || 'UnknownError').slice(0, MAX_NAME_LENGTH)
  return { name, message: clip(message, MAX_MESSAGE_LENGTH, 900), stack: clip(stack, MAX_STACK_LENGTH, 2400) }
}

const canAccept = () => config !== null && !disabled && accepted < MAX_SESSION_ROWS

function clearTimer(): void {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
}

/** One timer, started by the first queued row. */
function schedule(): void {
  if (timer !== undefined) return
  timer = setTimeout(() => {
    timer = undefined
    void flushTelemetry()
  }, FLUSH_DELAY_MS)
}

function enqueue(kind: PendingRow['kind'], rawName: string, props: TelemetryProps): void {
  const name = rawName.trim().slice(0, MAX_NAME_LENGTH)
  if (!config || !canAccept() || !name) return
  const row: PendingRow = {
    kind,
    name,
    props: byteLength(JSON.stringify(props)) > MAX_PROPS_BYTES ? { truncated: true } : props,
    app: config.app,
    app_version: config.appVersion,
    session_id: sessionId,
  }
  accepted++
  if (!userId) {
    preAuth.push(row)
    if (preAuth.length > MAX_PRE_AUTH_ROWS) preAuth.shift()
    return
  }
  queue.push({ ...row, user_id: userId })
  if (queue.length >= FLUSH_SIZE && !failing) void flushTelemetry()
  else schedule()
}

/** PGRST205 = table not in the schema cache; 42P01 = undefined table. */
function isMissingTableError(error: PgError): boolean {
  if (error.code === 'PGRST205' || error.code === '42P01') return true
  return /could not find the table|relation .* does not exist/i.test(error.message ?? '')
}

/** Class 22/23 = the rows themselves were refused (bad data, constraint): a retry cannot succeed. */
function isRejectedRowsError(error: PgError): boolean {
  return /^2[23]/.test(error.code ?? '')
}

async function sendQueued(): Promise<void> {
  try {
    clearTimer()
    const uid = userId
    if (disabled || !uid || !isSupabaseConfigured || !loadPreferences(uid).shareDiagnostics) {
      queue = []
      return
    }
    const batch = queue.filter((row) => row.user_id === uid)
    queue = []
    if (!batch.length) return

    let error: PgError | null
    try {
      // Insert only, nothing read back: app users have no read access to this table.
      error = (await supabase.from(TELEMETRY_TABLE).insert(batch)).error
    } catch (err) {
      error = { message: err instanceof Error ? err.message : 'Request failed' }
    }
    if (!error) {
      failing = false
      return
    }
    if (isMissingTableError(error)) {
      disabled = true
      queue = []
      preAuth = []
      clearTimer()
      return
    }
    if (isRejectedRowsError(error)) return
    // Network or server trouble: keep the newest rows for the next flush.
    failing = true
    queue = batch.concat(queue).slice(-MAX_RETAINED_ROWS)
  } catch {
    /* telemetry must never break the app */
  }
}

/** Call once at startup, before anything is tracked. Until then every call is a no-op. */
export function configureTelemetry(options: { app: TelemetryApp; appVersion?: string }): void {
  const version = typeof options.appVersion === 'string' ? options.appVersion.trim().slice(0, MAX_VERSION_LENGTH) : ''
  config = { app: options.app, appVersion: version || null }
}

/**
 * The signed-in user, or null when signed out. Rows queued for a previous user are dropped;
 * events tracked just before sign-in are attributed to the new user. The first time a user is
 * known after launch, `session_start` is recorded.
 */
export function setTelemetryUser(next: string | null): void {
  try {
    if (next === userId) return
    queue = []
    clearTimer()
    userId = next
    if (!next) return
    const pending = preAuth
    preAuth = []
    for (const row of pending) queue.push({ ...row, user_id: next })
    if (config && !sessionStarted) {
      sessionStarted = true
      enqueue('event', 'session_start', {})
    }
    if (queue.length) schedule()
  } catch {
    /* telemetry must never break the app */
  }
}

/** Records that a feature was used. Props: at most 12 primitive values, strings cut to 200 characters. */
export function track(name: string, props?: TelemetryProps): void {
  try {
    if (typeof name === 'string') enqueue('event', name, sanitizeProps(props))
  } catch {
    /* telemetry must never break the app */
  }
}

/** Reports an error (class or start of the message, message, stack). Each distinct error is sent at most 3 times per session. */
export function captureError(error: unknown, context?: { where?: string }): void {
  try {
    if (!canAccept()) return
    const { name, message, stack } = describeError(error)
    const key = `${name}\n${message}`
    const seen = errorCounts.get(key) ?? 0
    if (seen >= MAX_SAME_ERROR) return
    errorCounts.set(key, seen + 1)
    const where = typeof context?.where === 'string' && context.where ? clip(context.where, MAX_STRING_LENGTH, 300) : null
    enqueue('error', name, { message, stack, where })
  } catch {
    /* telemetry must never break the app */
  }
}

/** Sends everything queued now (also runs on its own: 20 rows queued, or 10 s after the first). Never rejects. */
export function flushTelemetry(): Promise<void> {
  chain = chain.then(sendQueued, sendQueued)
  return chain
}

/** Test hook: back to the state of a fresh, unconfigured app launch. */
export function resetTelemetryForTests(): void {
  clearTimer()
  config = null
  userId = null
  sessionId = newSessionId()
  queue = []
  preAuth = []
  disabled = false
  failing = false
  accepted = 0
  sessionStarted = false
  errorCounts = new Map()
  chain = Promise.resolve()
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * First-party usage events and error reports. The Supabase client is mocked: nothing here
 * can reach a real project. Timers are fake so the 10-second batch window is exact.
 */
const h = vi.hoisted(() => {
  const insert = vi.fn()
  const from = vi.fn((_table: string) => ({ insert }))
  return { insert, from, state: { configured: true } }
})

vi.mock('@tracknow/core/lib/supabase', () => ({
  supabase: { from: h.from },
  get isSupabaseConfigured() {
    return h.state.configured
  },
}))

import { configureStorage } from '@tracknow/core/platform/storage'
import { loadPreferences, savePreferences } from '@tracknow/core/services/preferences'
import {
  TELEMETRY_TABLE,
  captureError,
  configureTelemetry,
  flushTelemetry,
  resetTelemetryForTests,
  setTelemetryUser,
  track,
  type TelemetryProps,
} from '@tracknow/core/services/telemetry'

interface SentRow {
  user_id: string
  kind: 'event' | 'error'
  name: string
  props: TelemetryProps
  app: string
  app_version: string | null
  session_id: string
}

const USER = '00000000-0000-4000-8000-0000000000a1'
const OTHER = '00000000-0000-4000-8000-0000000000b2'
const MISSING_TABLE = { code: 'PGRST205', message: "Could not find the table 'public.track_now_client_events' in the schema cache" }
const NETWORK = { message: 'TypeError: Failed to fetch' }

const batch = (call: number) => h.insert.mock.calls[call][0] as SentRow[]
const sent = () => h.insert.mock.calls.flatMap((c) => c[0] as SentRow[])
const names = (rows: SentRow[]) => rows.map((r) => r.name)
/** Lets a flush started by a timer or by the 20-row trigger finish. */
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

function memoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    keys: () => [...store.keys()],
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  h.insert.mockReset().mockResolvedValue({ error: null })
  h.from.mockReset().mockImplementation(() => ({ insert: h.insert }))
  h.state.configured = true
  configureStorage(memoryStorage())
  resetTelemetryForTests()
  configureTelemetry({ app: 'web', appVersion: '1.2.3' })
})

afterEach(() => {
  resetTelemetryForTests()
  configureStorage(null)
  vi.useRealTimers()
})

describe('batching', () => {
  it('sends one request 10 seconds after the first queued row', async () => {
    setTelemetryUser(USER)
    track('tour_started')
    await vi.advanceTimersByTimeAsync(5_000)
    track('tour_finished')
    await vi.advanceTimersByTimeAsync(4_999)
    expect(h.insert).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await settle()
    expect(h.from).toHaveBeenCalledWith(TELEMETRY_TABLE)
    expect(h.insert).toHaveBeenCalledTimes(1)
    expect(names(batch(0))).toEqual(['session_start', 'tour_started', 'tour_finished'])
    expect(batch(0)[1]).toEqual({
      user_id: USER,
      kind: 'event',
      name: 'tour_started',
      props: {},
      app: 'web',
      app_version: '1.2.3',
      session_id: expect.stringMatching(/^[0-9a-f]{32}$/),
    })
    expect(new Set(batch(0).map((r) => r.session_id)).size).toBe(1)

    // The timer is not left running once the queue is empty.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(h.insert).toHaveBeenCalledTimes(1)
  })

  it('sends as soon as 20 rows are queued, without waiting for the timer', async () => {
    setTelemetryUser(USER) // queues session_start
    for (let i = 1; i <= 18; i++) track(`e${i}`)
    await settle()
    expect(h.insert).not.toHaveBeenCalled()

    track('e19')
    await settle()
    expect(h.insert).toHaveBeenCalledTimes(1)
    expect(batch(0)).toHaveLength(20)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(h.insert).toHaveBeenCalledTimes(1)
  })

  it('flushes on demand and records session_start once per launch', async () => {
    setTelemetryUser(USER)
    track('quest_clicked', { quest: 'first_plan' })
    await flushTelemetry()
    expect(names(batch(0))).toEqual(['session_start', 'quest_clicked'])
    expect(batch(0)[1].props).toEqual({ quest: 'first_plan' })

    setTelemetryUser(null)
    setTelemetryUser(USER)
    track('plan_created')
    await flushTelemetry()
    expect(names(batch(1))).toEqual(['plan_created'])
  })

  it('does nothing at all before configureTelemetry is called', async () => {
    resetTelemetryForTests()
    setTelemetryUser(USER)
    track('a')
    captureError(new Error('x'))
    await vi.advanceTimersByTimeAsync(60_000)
    await flushTelemetry()
    expect(h.from).not.toHaveBeenCalled()
  })
})

describe('signed out', () => {
  it('sends nothing while there is no user', async () => {
    track('a')
    captureError(new Error('login page broke'))
    await vi.advanceTimersByTimeAsync(60_000)
    await flushTelemetry()
    expect(h.from).not.toHaveBeenCalled()
  })

  it('keeps the last 10 pre-auth rows and sends them for the user who signs in', async () => {
    for (let i = 1; i <= 12; i++) track(`e${i}`)
    track('sign_in_completed', { method: 'code' })
    setTelemetryUser(USER)
    await flushTelemetry()

    expect(h.insert).toHaveBeenCalledTimes(1)
    expect(names(batch(0))).toEqual(['e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12', 'sign_in_completed', 'session_start'])
    expect(batch(0).every((r) => r.user_id === USER)).toBe(true)
  })

  it('drops rows queued for a user who signed out or was replaced', async () => {
    setTelemetryUser(USER)
    track('for_first_user')
    setTelemetryUser(OTHER)
    track('for_second_user')
    await flushTelemetry()
    expect(names(sent())).toEqual(['for_second_user'])
    expect(sent()[0].user_id).toBe(OTHER)

    track('queued_then_signed_out')
    setTelemetryUser(null)
    await vi.advanceTimersByTimeAsync(60_000)
    await flushTelemetry()
    expect(h.insert).toHaveBeenCalledTimes(1)
  })

  it('sends nothing when Supabase is not configured', async () => {
    h.state.configured = false
    setTelemetryUser(USER)
    track('a')
    await vi.advanceTimersByTimeAsync(60_000)
    await flushTelemetry()
    expect(h.from).not.toHaveBeenCalled()
  })
})

describe('opt-out', () => {
  it('defaults to sharing, and parses the stored preference defensively', () => {
    expect(loadPreferences(USER).shareDiagnostics).toBe(true)
    savePreferences(USER, { shareDiagnostics: false })
    expect(loadPreferences(USER).shareDiagnostics).toBe(false)
    savePreferences(USER, { shareDiagnostics: 'no' as unknown as boolean })
    expect(loadPreferences(USER).shareDiagnostics).toBe(true)
  })

  it('sends nothing for a user who switched reports off, and resumes when switched back on', async () => {
    savePreferences(USER, { shareDiagnostics: false })
    setTelemetryUser(USER)
    track('a')
    captureError(new Error('x'))
    await vi.advanceTimersByTimeAsync(60_000)
    await flushTelemetry()
    expect(h.from).not.toHaveBeenCalled()

    savePreferences(USER, { shareDiagnostics: true })
    track('b')
    await flushTelemetry()
    expect(names(sent())).toEqual(['b'])
  })

  it('reads the preference at flush time, so rows queued before opting out are not sent', async () => {
    setTelemetryUser(USER)
    track('a')
    savePreferences(USER, { shareDiagnostics: false })
    await vi.advanceTimersByTimeAsync(10_000)
    await settle()
    expect(h.from).not.toHaveBeenCalled()
  })
})

describe('before the migration is applied', () => {
  it.each([
    ['PostgREST schema cache (PGRST205)', MISSING_TABLE],
    ['Postgres undefined table (42P01)', { code: '42P01', message: 'relation "public.track_now_client_events" does not exist' }],
    ['message only', { message: "Could not find the table 'public.track_now_client_events' in the schema cache" }],
  ])('a missing-table answer (%s) stops sending for the session', async (_label, error) => {
    h.insert.mockResolvedValue({ error })
    setTelemetryUser(USER)
    track('a')
    await flushTelemetry()
    expect(h.insert).toHaveBeenCalledTimes(1)

    for (let i = 0; i < 30; i++) track(`later${i}`)
    captureError(new Error('later'))
    await vi.advanceTimersByTimeAsync(60_000)
    await flushTelemetry()
    setTelemetryUser(null)
    track('pre_auth')
    setTelemetryUser(OTHER)
    await flushTelemetry()
    expect(h.insert).toHaveBeenCalledTimes(1)
  })
})

describe('request failures', () => {
  it('keeps rows after a network error and sends them with the next flush', async () => {
    h.insert.mockResolvedValueOnce({ error: NETWORK })
    setTelemetryUser(USER)
    track('a')
    await flushTelemetry()
    expect(h.insert).toHaveBeenCalledTimes(1)

    track('b')
    await vi.advanceTimersByTimeAsync(10_000)
    await settle()
    expect(h.insert).toHaveBeenCalledTimes(2)
    expect(names(batch(1))).toEqual(['session_start', 'a', 'b'])
  })

  it('treats a rejected request like a network error', async () => {
    h.insert.mockRejectedValueOnce(new Error('socket hang up'))
    setTelemetryUser(USER)
    track('a')
    await expect(flushTelemetry()).resolves.toBeUndefined()
    await flushTelemetry()
    expect(names(batch(1))).toEqual(['session_start', 'a'])
  })

  it('keeps at most the newest 100 rows, and does not retry on every new row while failing', async () => {
    h.insert.mockResolvedValue({ error: NETWORK })
    setTelemetryUser(USER)
    await flushTelemetry()
    expect(h.insert).toHaveBeenCalledTimes(1)

    for (let i = 1; i <= 120; i++) track(`e${i}`)
    await settle()
    expect(h.insert).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    await settle()
    expect(h.insert).toHaveBeenCalledTimes(2)
    expect(batch(1)).toHaveLength(121)

    h.insert.mockResolvedValue({ error: null })
    await flushTelemetry()
    expect(h.insert).toHaveBeenCalledTimes(3)
    expect(batch(2)).toHaveLength(100)
    expect(batch(2)[0].name).toBe('e21')
    expect(batch(2)[99].name).toBe('e120')

    await flushTelemetry()
    expect(h.insert).toHaveBeenCalledTimes(3)
  })

  it('drops a batch the database refuses (constraint), so it cannot block later rows', async () => {
    h.insert.mockResolvedValueOnce({ error: { code: '23514', message: 'violates check constraint' } })
    setTelemetryUser(USER)
    track('a')
    await flushTelemetry()
    track('b')
    await flushTelemetry()
    expect(names(batch(1))).toEqual(['b'])
  })
})

describe('privacy limits', () => {
  it('cuts names to 80 and strings to 200 characters, keeps 12 primitive props, drops everything else', async () => {
    setTelemetryUser(USER)
    const props: Record<string, unknown> = { long: 'y'.repeat(500), count: 5, flag: true, none: null, nested: { secret: 'x' }, list: ['x'], inf: Infinity }
    for (let i = 1; i <= 10; i++) props[`k${i}`] = i
    track('n'.repeat(100), props as TelemetryProps)
    track('   ')
    await flushTelemetry()

    expect(names(sent())).toEqual(['session_start', 'n'.repeat(80)])
    const sentProps = sent()[1].props
    expect(Object.keys(sentProps)).toEqual(['long', 'count', 'flag', 'none', 'inf', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7'])
    expect(sentProps.long).toBe('y'.repeat(200))
    expect(sentProps.inf).toBeNull()
    expect(JSON.stringify(sentProps)).not.toContain('secret')
  })

  it('never sends props that would exceed the 4096-byte column limit', async () => {
    setTelemetryUser(USER)
    const props: TelemetryProps = {}
    for (let i = 1; i <= 12; i++) props[`k${i}`] = '€'.repeat(200)
    track('wide', props)
    await flushTelemetry()
    expect(sent()[1].props).toEqual({ truncated: true })
  })

  it('reports errors as class (or start of the message), message, stack and where, all bounded', async () => {
    setTelemetryUser(USER)
    const typed = new TypeError('m'.repeat(500))
    typed.stack = 's'.repeat(5000)
    captureError(typed, { where: 'window.error' })
    captureError(new Error(`Plain failure ${'p'.repeat(200)}`))
    captureError('a string rejection')
    captureError({ message: 'object with a message' })
    captureError(undefined)
    await flushTelemetry()

    const [, a, b, c, d, e] = sent()
    expect(a).toMatchObject({ kind: 'error', name: 'TypeError' })
    expect(a.props).toEqual({ message: 'm'.repeat(300), stack: 's'.repeat(1500), where: 'window.error' })
    expect(b.name).toBe(`Plain failure ${'p'.repeat(200)}`.slice(0, 80))
    expect(b.props.where).toBeNull()
    expect(c.name).toBe('a string rejection')
    expect(d.name).toBe('object with a message')
    expect(e.name).toBe('UnknownError')
    for (const row of sent()) expect(new TextEncoder().encode(JSON.stringify(row.props)).length).toBeLessThan(4000)
  })

  it('keeps multi-byte error text under the column limit', async () => {
    setTelemetryUser(USER)
    const err = new Error('错'.repeat(500))
    err.stack = '栈'.repeat(5000)
    captureError(err, { where: '位'.repeat(500) })
    await flushTelemetry()
    const row = sent()[1]
    expect(row.kind).toBe('error')
    expect(row.props).not.toEqual({ truncated: true })
    expect(new TextEncoder().encode(JSON.stringify(row.props)).length).toBeLessThan(4000)
  })
})

describe('volume limits', () => {
  it('sends each distinct error at most 3 times per session', async () => {
    setTelemetryUser(USER)
    for (let i = 0; i < 6; i++) captureError(new RangeError('same'))
    captureError(new RangeError('different'))
    await flushTelemetry()
    const errors = sent().filter((r) => r.kind === 'error')
    expect(errors.filter((r) => r.props.message === 'same')).toHaveLength(3)
    expect(errors.filter((r) => r.props.message === 'different')).toHaveLength(1)
  })

  it('stops at 200 rows per session', async () => {
    setTelemetryUser(USER)
    for (let i = 1; i <= 260; i++) {
      track(`e${i}`)
      if (i % 20 === 0) await settle()
    }
    for (let i = 0; i < 5; i++) captureError(new Error(`late ${i}`))
    await flushTelemetry()
    expect(sent()).toHaveLength(200)
    expect(sent()[199].name).toBe('e199')
  })
})

describe('never throws into the app', () => {
  it('swallows a client that throws synchronously', async () => {
    h.from.mockImplementation(() => {
      throw new Error('client exploded')
    })
    expect(() => setTelemetryUser(USER)).not.toThrow()
    expect(() => {
      for (let i = 0; i < 25; i++) track(`e${i}`)
    }).not.toThrow()
    expect(() => captureError(new Error('x'))).not.toThrow()
    await expect(flushTelemetry()).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(60_000)
    await expect(flushTelemetry()).resolves.toBeUndefined()
  })

  it('swallows broken storage, hostile error objects and wrong argument types', async () => {
    configureStorage({
      getItem: () => {
        throw new Error('storage exploded')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
      keys: () => [],
    })
    const hostile = {
      get message(): string {
        throw new Error('getter exploded')
      },
    }
    const unprintable = Object.create(null) as unknown

    expect(() => setTelemetryUser(USER)).not.toThrow()
    expect(() => captureError(hostile)).not.toThrow()
    expect(() => captureError(unprintable)).not.toThrow()
    expect(() => track(undefined as unknown as string)).not.toThrow()
    expect(() => track('ok', 'not an object' as unknown as TelemetryProps)).not.toThrow()
    await expect(flushTelemetry()).resolves.toBeUndefined()
    // Unreadable preferences fall back to the default (sharing on).
    expect(names(sent()).filter((n) => n === 'ok' || n === 'undefined')).toEqual(['ok'])
  })
})

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The repository has three scripts that talk to a REAL Supabase project. They must refuse
 * to start unless explicitly pointed at a disposable project, and must never use public
 * sign-up (which sends confirmation emails and leaves orphaned users). These checks run
 * entirely offline: the guard is called with fake inputs and the scripts are only read.
 */
const require = createRequire(import.meta.url)
const scriptsDir = resolve(__dirname, '../../../scripts')
const { assertLiveTargetAllowed, projectRef } = require(resolve(scriptsDir, 'lib/liveGuard.cjs')) as {
  assertLiveTargetAllowed: (o: { url?: string; serviceKey?: string; env?: Record<string, string>; scriptName?: string }) => string
  projectRef: (url: string) => string | null
}

const REF = 'abcdefghijklmnopqrst'
const URL_ = `https://${REF}.supabase.co`

function refusal(fn: () => unknown): string | null {
  const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`)
  }) as never)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    fn()
    return null
  } catch (err) {
    return (err as Error).message
  } finally {
    exit.mockRestore()
  }
}

afterEach(() => vi.restoreAllMocks())

describe('live Supabase script guard', () => {
  it('extracts the project ref only from real project URLs', () => {
    expect(projectRef(URL_)).toBe(REF)
    expect(projectRef('https://example.com')).toBeNull()
    expect(projectRef('not a url')).toBeNull()
  })

  it('refuses without the admin key, without opt-in, with a mismatched opt-in, or for a blocked ref', () => {
    expect(refusal(() => assertLiveTargetAllowed({ url: URL_, env: { ALLOW_LIVE_SUPABASE: REF } }))).toBe('exit:2')
    expect(refusal(() => assertLiveTargetAllowed({ url: URL_, serviceKey: 'k', env: {} }))).toBe('exit:2')
    expect(refusal(() => assertLiveTargetAllowed({ url: URL_, serviceKey: 'k', env: { ALLOW_LIVE_SUPABASE: 'zzzzzzzzzzzzzzzzzzzz' } }))).toBe('exit:2')
    expect(
      refusal(() =>
        assertLiveTargetAllowed({ url: URL_, serviceKey: 'k', env: { ALLOW_LIVE_SUPABASE: REF, PRODUCTION_SUPABASE_REFS: `x,${REF}` } }),
      ),
    ).toBe('exit:2')
  })

  it('allows an explicitly opted-in disposable project', () => {
    expect(refusal(() => assertLiveTargetAllowed({ url: URL_, serviceKey: 'k', env: { ALLOW_LIVE_SUPABASE: REF } }))).toBeNull()
  })

  it.each(['verify_e2e_journey.cjs', 'verify_rls_security.cjs', 'verify_browser_e2e.cjs', 'verify_rpc_http_dev.cjs'])(
    '%s calls the guard before creating any client and never uses public sign-up or real email domains',
    (name) => {
      const src = readFileSync(resolve(scriptsDir, name), 'utf8')
      const guardAt = src.indexOf("require('./lib/liveGuard.cjs').assertLiveTargetAllowed(")
      const firstClient = src.search(/createClient\(url,/)
      expect(guardAt).toBeGreaterThan(-1)
      expect(guardAt).toBeLessThan(firstClient)
      expect(src).not.toMatch(/auth\.signUp\(/)
      expect(src).not.toMatch(/@gmail\.com|@tracknow\.(sec|internal)\b/)
    },
  )

  it('the HTTP smoke test reads only exported variables, never the production .env files', () => {
    const src = readFileSync(resolve(scriptsDir, 'verify_rpc_http_dev.cjs'), 'utf8')
    expect(src).not.toMatch(/readFileSync|\.env['"]|loadEnv/)
    expect(src).toMatch(/deleteUser/)
  })
})

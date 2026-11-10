import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlanShare, secureShareToken, SHARING_NEEDS_SECURE_TOKEN_MESSAGE } from '@tracknow/core/services/shareService'
import { buildExportBundle, itemsCsv } from '@tracknow/core/domain/exportData'
import { loadReviewNote, loadReviewTombstones, saveReviewNote, deleteReviewNote } from '@tracknow/core/services/reviewNotesStorage'
import { loadFocusIds, toggleFocusId } from '@tracknow/core/services/focusService'
import { releaseSyncedCopies, resetSyncedStateForTests } from '@tracknow/core/services/syncedState'
import { supabase } from '@tracknow/core/lib/supabase'
import type { ExecutionItem } from '@tracknow/core/types/domain'

/**
 * Regression tests for the November 2026 security audit (SECURITY_AUDIT.md, S-28 to S-35).
 * Each block names the finding it pins.
 */

vi.mock('@tracknow/core/lib/supabase', () => ({
  supabase: { from: vi.fn() },
  isSupabaseConfigured: true,
}))

const root = (p: string) => resolve(__dirname, '../../..', p)
const from = () => supabase.from as ReturnType<typeof vi.fn>

function createStorage() {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      store = {}
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
    keys: () => Object.keys(store),
  }
}

describe('S-28: share tokens never come from a predictable source', () => {
  const realCrypto = globalThis.crypto
  afterEach(() => {
    vi.stubGlobal('crypto', realCrypto)
    vi.restoreAllMocks()
  })

  const insertChain = (result: { data: unknown; error: { code?: string; message: string } | null }) => {
    const insert = vi.fn()
    const chain: Record<string, unknown> = { insert, select: () => chain, single: () => Promise.resolve(result) }
    insert.mockReturnValue(chain)
    from().mockReturnValue(chain)
    return insert
  }

  it('with a secure random source: 48 hex characters, different every time', () => {
    const a = secureShareToken()
    const b = secureShareToken()
    expect(a).toMatch(/^[0-9a-f]{48}$/)
    expect(a).not.toBe(b)
  })

  it('without one: no token is invented, Math.random is never used, the database is asked to generate it', async () => {
    vi.stubGlobal('crypto', undefined)
    const random = vi.spyOn(Math, 'random')
    expect(secureShareToken()).toBeNull()
    const insert = insertChain({ data: { id: 's1', token: 'f'.repeat(64) }, error: null })
    const share = await createPlanShare('u1', 'p1')
    expect(insert.mock.calls[0][0]).toEqual({ user_id: 'u1', plan_id: 'p1' })
    expect(share.token).toHaveLength(64)
    expect(random).not.toHaveBeenCalled()
  })

  it('without one and before the database update: refuses with a clear message instead of a weak link', async () => {
    vi.stubGlobal('crypto', {})
    insertChain({ data: null, error: { code: '23502', message: 'null value in column "token"' } })
    await expect(createPlanShare('u1', 'p1')).rejects.toThrow(SHARING_NEEDS_SECURE_TOKEN_MESSAGE)
  })

  it('the source has no Math.random fallback left', () => {
    expect(readFileSync(root('packages/core/src/services/shareService.ts'), 'utf-8')).not.toMatch(/Math\.random\(/)
  })
})

describe('S-31: exported CSV cannot run formulas in a spreadsheet', () => {
  const item = (name: string, description: string | null = null): ExecutionItem =>
    ({ id: 'i', plan_id: 'p', user_id: 'u', type: 'task', name, description, status: 'todo', priority: 'medium', due_date: null, target_count: 5, current_count: 0, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' }) as ExecutionItem
  const csvFor = (it: ExecutionItem) =>
    itemsCsv(buildExportBundle({ profile: null, tracks: [], plans: [], items: [it], completions: [] } as unknown as Parameters<typeof buildExportBundle>[0]))

  it.each(['=HYPERLINK("http://evil.example","x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd'])('neutralises a name starting with %j', (name) => {
    const line = csvFor(item(name)).split('\n')[1]
    const cells = line.split(',')
    const nameCell = line.includes('"') ? line.slice(line.indexOf(',,,,task,') + 9) : cells[5]
    expect(nameCell.replace(/^"/, '').startsWith("'")).toBe(true)
  })

  it('leaves ordinary text and real numbers alone', () => {
    const line = csvFor(item('Run 5 km', 'easy pace'))
    expect(line.split('\n')[1]).toContain('Run 5 km,easy pace')
    expect(line.split('\n')[1]).toContain(',5,') // target_count stays a number
    expect(line.split('\n')[1]).not.toContain("'")
  })
})

describe('S-30: review notes do not stay on the device after sign-out once the account has them', () => {
  let storage: ReturnType<typeof createStorage>
  let rows: Array<{ user_id: string; scope: string; key: string; value: unknown; updated_at: string }>
  let failWith: { code?: string; message: string } | null

  beforeEach(() => {
    storage = createStorage()
    vi.stubGlobal('localStorage', storage)
    resetSyncedStateForTests()
    rows = []
    failWith = null
    from().mockImplementation(() => {
      let upserted: typeof rows | null = null
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        upsert: (r: typeof rows) => {
          upserted = r
          return b
        },
        then: (ok: (v: unknown) => unknown) =>
          Promise.resolve().then(() => {
            if (failWith) return ok({ data: null, error: failWith })
            if (upserted) rows.push(...upserted)
            return ok({ data: upserted ? null : rows.map(({ key, value, updated_at }) => ({ key, value, updated_at })), error: null })
          }),
      }
      return b
    })
    saveReviewNote('u1', { periodKey: 'weekly:2026-11-02', kind: 'weekly', answers: { friction: 'private thoughts' }, priorities: [] })
    saveReviewNote('u1', { periodKey: 'weekly:2026-10-26', kind: 'weekly', answers: { friction: 'older' }, priorities: [] })
    deleteReviewNote('u1', 'weekly:2026-10-26')
    toggleFocusId('u1', 'item-1')
  })

  it('synced: the note reaches the account first, then every local copy is gone', async () => {
    expect(await releaseSyncedCopies('u1')).toBe(true)
    expect(rows.some((r) => r.key === 'weekly:2026-11-02' && JSON.stringify(r.value).includes('private thoughts'))).toBe(true)
    expect(loadReviewNote('u1', 'weekly:2026-11-02')).toBeNull()
    expect(loadReviewTombstones('u1')).toEqual({})
    expect(loadFocusIds('u1')).toEqual([])
    expect(storage.keys().filter((k) => /reviews|focus/.test(k))).toEqual([])
  })

  it('account cannot store them (database update pending): the only copy is kept', async () => {
    failWith = { code: 'PGRST205', message: 'Could not find the table' }
    expect(await releaseSyncedCopies('u1')).toBe(false)
    expect(loadReviewNote('u1', 'weekly:2026-11-02')?.answers.friction).toBe('private thoughts')
  })

  it('offline: the only copy is kept', async () => {
    failWith = { message: 'Failed to fetch' }
    expect(await releaseSyncedCopies('u1')).toBe(false)
    expect(loadReviewNote('u1', 'weekly:2026-11-02')).not.toBeNull()
  })

  it('a hanging network never blocks sign-out', async () => {
    from().mockImplementation(() => {
      const b: Record<string, unknown> = { select: () => b, eq: () => b, upsert: () => b, then: () => new Promise(() => undefined) }
      return b
    })
    const started = Date.now()
    expect(await releaseSyncedCopies('u1', 50)).toBe(false)
    expect(Date.now() - started).toBeLessThan(1500)
    expect(loadReviewNote('u1', 'weekly:2026-11-02')).not.toBeNull()
  })

  it('both apps release the copies before the session is ended', () => {
    for (const p of ['apps/app/src/features/auth/AuthProvider.tsx', 'apps/mobile/src/features/auth/AuthProvider.tsx']) {
      const src = readFileSync(root(p), 'utf-8')
      const release = src.indexOf('await releaseSyncedCopies(userIdAtSignOut)')
      expect(release, p).toBeGreaterThan(-1)
      expect(src.indexOf('await authService.signOut()', release), p).toBeGreaterThan(release)
    }
  })
})

describe('S-32: transport and share-page headers', () => {
  const app = readFileSync(root('apps/app/netlify.toml'), 'utf-8')
  const landing = readFileSync(root('apps/landing/netlify.toml'), 'utf-8')

  it('both sites send HSTS and keep their CSP', () => {
    for (const toml of [app, landing]) {
      expect(toml).toContain('Strict-Transport-Security = "max-age=31536000; includeSubDomains"')
      expect(toml).toMatch(/Content-Security-Policy = "default-src 'self'; script-src 'self';/)
      expect(toml).toContain("frame-ancestors 'none'")
      expect(toml).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/)
    }
  })

  it('shared-plan links are kept out of search engines and referrers', () => {
    expect(app).toMatch(/for = "\/share\/\*"\s+\[headers\.values\]\s+X-Robots-Tag = "noindex, nofollow, noarchive"/)
    const page = readFileSync(root('apps/app/src/pages/SharedPlanPage.tsx'), 'utf-8')
    expect(page).toContain("['robots', 'noindex, nofollow, noarchive']")
    expect(page).toContain("['referrer', 'no-referrer']")
  })
})

describe('S-34: phone app data is not included in OS backups', () => {
  it('android.allowBackup is false', () => {
    const cfg = JSON.parse(readFileSync(root('apps/mobile/app.json'), 'utf-8'))
    expect(cfg.expo.android.allowBackup).toBe(false)
  })
})

describe('S-35: hardening migration', () => {
  const sql = readFileSync(root('supabase/migrations/20261112000000_security_hardening.sql'), 'utf-8').replace(/--.*$/gm, '')
  it('revokes anon from every core table and never grants anon a write', () => {
    for (const t of ['profiles', 'tracks', 'plans', 'execution_items', 'item_schedules', 'item_completions']) {
      expect(sql).toContain(`REVOKE ALL ON public.track_now_${t} FROM anon;`)
    }
    expect(sql.match(/\bGRANT\b[^;]*;/g)).toEqual(['GRANT SELECT ON public.track_now_track_templates TO anon, authenticated;'])
  })
  it('gives share tokens a database-side random default', () => {
    expect(sql).toMatch(/ALTER COLUMN token SET DEFAULT replace\(gen_random_uuid\(\)::text \|\| gen_random_uuid\(\)::text, '-', ''\)/)
  })
})

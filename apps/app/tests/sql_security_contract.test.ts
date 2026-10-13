import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Static (offline) checks of the SQL migrations. These do NOT prove anything about the
 * live database; they guard the repository's migration contracts against regressions.
 */
const MIGRATIONS_DIR = resolve(__dirname, '../../../supabase/migrations')
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
const read = (f: string) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf-8')
const REMEDIATION = '20261012000000_secure_increment_item_count_rpc.sql'

const stripComments = (sql: string) => sql.replace(/--.*$/gm, '')

describe('RPC remediation migration (prepared, not applied)', () => {
  const sql = read(REMEDIATION)
  const code = stripComments(sql)

  it('is clearly marked as not applied and requiring owner approval', () => {
    expect(sql).toContain('NOT APPLIED — REQUIRES EXPLICIT OWNER APPROVAL')
  })

  it('drops every overload of the function name (including the vulnerable p_user_id one)', () => {
    expect(code).toMatch(/p\.proname = 'track_now_increment_item_count'/)
    expect(code).toMatch(/EXECUTE pg_catalog\.format\('DROP FUNCTION %s', r\)/)
  })

  it('only honours the habit reset flag when the habit is not already done for that day', () => {
    expect(code).toMatch(/p_reset_count IS TRUE AND v_item\.type = 'habit' AND NOT v_done_today THEN 0/)
  })

  it('removes all completion rows when a one-off item is un-completed', () => {
    expect(code).toMatch(/ELSE\s+DELETE FROM public\.track_now_item_completions\s+WHERE item_id = p_item_id\s+AND user_id = v_actor;/)
  })

  it('recreates the function without any p_user_id parameter and derives the actor from auth.uid()', () => {
    const create = code.slice(code.indexOf('CREATE OR REPLACE FUNCTION public.track_now_increment_item_count'))
    const signature = create.slice(0, create.indexOf(')'))
    expect(signature).not.toMatch(/p_user_id/i)
    expect(code).not.toMatch(/p_user_id/i)
    expect(code).toMatch(/v_actor uuid := auth\.uid\(\)/)
    expect(code).toMatch(/IF v_actor IS NULL THEN/)
    expect(code).toMatch(/WHERE id = p_item_id AND user_id = v_actor/)
  })

  it('is SECURITY DEFINER with a pinned empty search_path', () => {
    expect(code).toMatch(/SECURITY DEFINER\s+SET search_path = ''/)
  })

  it('validates delta and completion-date inputs', () => {
    expect(code).toMatch(/p_delta IS NULL OR p_delta = 0 OR pg_catalog\.abs\(p_delta\) > 10000/)
    expect(code).toMatch(/p_completed_date < \(CURRENT_DATE - 2\)/)
  })

  it('revokes EXECUTE from PUBLIC and anon and grants only authenticated (plus service_role)', () => {
    const sig = 'public.track_now_increment_item_count(UUID, INTEGER, DATE, BOOLEAN)'
    expect(code).toContain(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC`)
    expect(code).toContain(`REVOKE ALL ON FUNCTION ${sig} FROM anon`)
    expect(code).toContain(`GRANT EXECUTE ON FUNCTION ${sig} TO authenticated`)
    expect(code).not.toMatch(/GRANT EXECUTE[^;]*TO (anon|PUBLIC)/i)
  })

  it('pins search_path on the other definer/trigger functions', () => {
    expect(code).toContain("ALTER FUNCTION public.handle_new_track_now_user() SET search_path = ''")
    expect(code).toContain("ALTER FUNCTION public.handle_track_now_updated_at() SET search_path = ''")
  })
})

describe('database boundary across all migrations', () => {
  it('never references the unrelated tracked_profiles table in executable SQL', () => {
    for (const f of files) {
      expect(stripComments(read(f)), f).not.toMatch(/tracked_profiles/i)
    }
  })

  it('only creates track_now_* tables', () => {
    for (const f of files) {
      const created = [...stripComments(read(f)).matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map((m) => m[1])
      created.forEach((t) => expect(t, f).toMatch(/^track_now_/))
    }
  })

  it('enables row level security on every track_now_* table that is created', () => {
    const all = files.map((f) => stripComments(read(f))).join('\n')
    const created = [...all.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map((m) => m[1])
    expect(created.length).toBe(7)
    created.forEach((t) => expect(all).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`))
  })
})

describe('client contract matches the remediated RPC', () => {
  it('executionService calls the RPC without a user id parameter', () => {
    const src = readFileSync(resolve(__dirname, '../src/services/executionService.ts'), 'utf-8')
    const call = src.slice(src.indexOf("supabase.rpc('track_now_increment_item_count'"))
    const args = call.slice(0, call.indexOf('})'))
    expect(args).toContain('p_item_id')
    expect(args).toContain('p_reset_count')
    expect(args).not.toContain('p_user_id')
  })
})

#!/usr/bin/env node
/**
 * LOCAL-ONLY SQL verification for the Track.now migrations.
 *
 * Creates a brand-new, throw-away PostgreSQL cluster in the OS temp directory,
 * listening only on 127.0.0.1 at a random port, applies a minimal Supabase stub
 * (supabase/verification/local/supabase_stub.sql) and the real migrations, runs
 * the verification SQL, then stops the cluster and deletes it.
 *
 * Safety:
 *   - It never reads DATABASE_URL, SUPABASE_*, .env files or any connection string.
 *     The only server it talks to is the one it started itself.
 *   - Nothing is written outside the temporary directory it creates.
 *
 * Requirements: PostgreSQL server binaries (initdb, pg_ctl, psql). Set PG_BIN to the
 * bin directory, or they are discovered under "C:\Program Files\PostgreSQL\<ver>\bin"
 * or on PATH.
 *
 * Usage: node scripts/verify_sql_local.cjs
 */
const { spawnSync, spawn } = require('node:child_process')
const fs = require('node:fs')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const MIG = path.join(ROOT, 'supabase', 'migrations')
const VER = path.join(ROOT, 'supabase', 'verification')
const MIGRATIONS = {
  init: path.join(MIG, '20261005000000_init_track_now.sql'),
  harden: path.join(MIG, '20261008000000_harden_constraints_and_rls.sql'),
  secure: path.join(MIG, '20261012000000_secure_increment_item_count_rpc.sql'),
  habit: path.join(MIG, '20261013000000_habit_daily_counter.sql'),
}
const ALL_IN_ORDER = [MIGRATIONS.init, MIGRATIONS.harden, MIGRATIONS.secure, MIGRATIONS.habit]

const exe = (name) => (process.platform === 'win32' ? `${name}.exe` : name)

function findPgBin() {
  const candidates = []
  if (process.env.PG_BIN) candidates.push(process.env.PG_BIN)
  if (process.platform === 'win32') {
    const base = 'C:\\Program Files\\PostgreSQL'
    if (fs.existsSync(base)) {
      fs.readdirSync(base)
        .filter((v) => /^\d+$/.test(v))
        .sort((a, b) => Number(b) - Number(a))
        .forEach((v) => candidates.push(path.join(base, v, 'bin')))
    }
  }
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, exe('initdb'))) && fs.existsSync(path.join(dir, exe('psql')))) return dir
  }
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['initdb'], { encoding: 'utf8' })
  if (which.status === 0 && which.stdout.trim()) return path.dirname(which.stdout.trim().split(/\r?\n/)[0])
  return null
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

const results = []
function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const bin = findPgBin()
  if (!bin) {
    console.error('BLOCKED: PostgreSQL binaries (initdb/pg_ctl/psql) not found. Set PG_BIN.')
    process.exit(2)
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tracknow-pg-'))
  const data = path.join(tmp, 'data')
  const log = path.join(tmp, 'server.log')
  const port = await freePort()
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: tmp, TMP: tmp, PGTZ: 'UTC' }
  const run = (cmd, args, opts = {}) =>
    spawnSync(path.join(bin, exe(cmd)), args, { encoding: 'utf8', env, timeout: 120000, ...opts })

  const psqlArgs = (db) => ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', db]
  const psqlFile = (db, file) => run('psql', [...psqlArgs(db), '-f', file])
  const psqlCmd = (db, sql) => run('psql', [...psqlArgs(db), '-At', '-c', sql])
  const out = (r) => `${r.stdout || ''}${r.stderr || ''}`

  let started = false
  try {
    console.log(`Using PostgreSQL binaries in ${bin}`)
    console.log(`Disposable cluster: ${data} (127.0.0.1:${port})`)
    let r = run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-locale'])
    if (r.status !== 0) throw new Error(`initdb failed:\n${out(r)}`)
    // stdio 'ignore': the postmaster inherits pg_ctl's handles, so piped output would
    // never close and spawnSync would wait forever (observed on Windows).
    r = run('pg_ctl', ['-D', data, '-l', log, '-w', '-o', `-p ${port} -c listen_addresses=127.0.0.1`, 'start'], { stdio: 'ignore' })
    if (r.status !== 0) throw new Error(`pg_ctl start failed:\n${out(r)}\n${fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : ''}`)
    started = true

    const createDb = (name) => {
      const c = psqlCmd('postgres', `CREATE DATABASE ${name}`)
      if (c.status !== 0) throw new Error(`create database ${name} failed:\n${out(c)}`)
    }
    const apply = (db, file, label) => {
      const a = psqlFile(db, file)
      if (a.status !== 0) throw new Error(`${label} failed:\n${out(a)}`)
      return out(a)
    }
    const scalar = (db, sql) => {
      const s = psqlCmd(db, sql)
      if (s.status !== 0) throw new Error(`query failed: ${sql}\n${out(s)}`)
      return s.stdout.trim()
    }

    const DB = 'tracknow_verify'
    createDb(DB)
    apply(DB, path.join(VER, 'local', 'supabase_stub.sql'), 'supabase stub')
    apply(DB, MIGRATIONS.init, 'init migration')
    apply(DB, MIGRATIONS.harden, 'hardening migration')

    // 1. Reproduce the original vulnerability (proves the checks can detect it).
    r = psqlFile(DB, path.join(VER, 'local', 'reproduce_vulnerable_rpc.sql'))
    record('original RPC is exploitable by anon and by another user (pre-fix reproduction)', r.status === 0 && /REPRODUCED/.test(out(r)), (out(r).match(/REPRODUCED[^\n]*/) || [''])[0])

    // 2. Plant an extra hand-made overload that also trusts a caller-supplied user id.
    apply(DB, writeTemp(tmp, 'plant.sql', `
      CREATE FUNCTION public.track_now_increment_item_count(p_item_id uuid, p_delta integer, p_user_id uuid)
      RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$ SELECT NULL::jsonb $$;`), 'plant obsolete overload')
    record('two vulnerable overloads present before the fix', scalar(DB, `SELECT count(*) FROM pg_proc WHERE proname = 'track_now_increment_item_count'`) === '2')

    // 3. Legacy rows for the count_date backfill check (kept: this database is disposable).
    apply(DB, writeTemp(tmp, 'legacy.sql', `
      INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000d1', 'legacy@example.invalid');
      INSERT INTO public.track_now_tracks (id, user_id, name) VALUES ('10000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d1', 'Legacy');
      INSERT INTO public.track_now_plans (id, user_id, track_id, name) VALUES ('20000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-0000000000d1', 'Legacy');
      INSERT INTO public.track_now_execution_items (id, user_id, plan_id, track_id, type, name, status, target_count, current_count) VALUES
        ('30000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-0000000000d1', 'habit', 'Legacy done habit', 'done', 1, 1),
        ('30000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-0000000000d1', 'habit', 'Legacy partial habit', 'todo', 3, 2),
        ('30000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-0000000000d1', 'habit', 'Recent partial habit', 'todo', 3, 1);
      INSERT INTO public.track_now_item_completions (item_id, user_id, completed_date) VALUES
        ('30000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d1', CURRENT_DATE - 3);
      ALTER TABLE public.track_now_execution_items DISABLE TRIGGER tr_track_now_items_updated_at;
      UPDATE public.track_now_execution_items SET updated_at = now() - interval '2 days' WHERE user_id = '00000000-0000-4000-8000-0000000000d1' AND name <> 'Recent partial habit';
      UPDATE public.track_now_execution_items SET updated_at = now() - interval '2 hours' WHERE name = 'Recent partial habit';
      ALTER TABLE public.track_now_execution_items ENABLE TRIGGER tr_track_now_items_updated_at;`), 'legacy fixtures')

    // 4. Ordering guard: the habit migration must refuse to run before the security fix.
    const ORDER_DB = 'tracknow_order'
    createDb(ORDER_DB)
    apply(ORDER_DB, path.join(VER, 'local', 'supabase_stub.sql'), 'stub (order db)')
    apply(ORDER_DB, MIGRATIONS.init, 'init (order db)')
    apply(ORDER_DB, MIGRATIONS.harden, 'harden (order db)')
    r = psqlFile(ORDER_DB, MIGRATIONS.habit)
    record('habit migration refuses to run before the security migration', r.status !== 0 && /Apply 20261012000000/.test(out(r)))

    // 5. Security migration.
    apply(DB, MIGRATIONS.secure, 'security migration')
    record('every overload was replaced by exactly one safe signature',
      scalar(DB, `SELECT string_agg(oid::regprocedure::text, ',') FROM pg_proc WHERE proname = 'track_now_increment_item_count'`) ===
        'track_now_increment_item_count(uuid,integer,date,boolean)')
    r = psqlFile(DB, path.join(VER, 'local', 'reproduce_vulnerable_rpc.sql'))
    record('reproduction no longer works after the fix', r.status !== 0 && /vulnerable signature is not present/.test(out(r)))
    r = psqlFile(DB, path.join(VER, 'verify_increment_rpc_security.sql'))
    record('verify_increment_rpc_security.sql (after security migration)', r.status === 0 && /ALL \d+ CHECKS PASSED/.test(out(r)), (out(r).match(/ALL \d+ CHECKS PASSED/) || [''])[0])
    if (r.status !== 0) console.log(out(r))

    // 6. Habit counter migration + backfill.
    const beforeUpdatedAt = scalar(DB, `SELECT string_agg(updated_at::text, ',' ORDER BY id) FROM public.track_now_execution_items`)
    apply(DB, MIGRATIONS.habit, 'habit counter migration')
    const backfill = scalar(DB, `SELECT string_agg(name || '=' || COALESCE((count_date - CURRENT_DATE)::text, 'null'), ',' ORDER BY id) FROM public.track_now_execution_items`)
    record('backfill: done habit -> latest completion day, old partial -> updated_at day, recent (<36h) -> NULL',
      backfill === 'Legacy done habit=-3,Legacy partial habit=-2,Recent partial habit=null', backfill)
    record('backfill does not bump updated_at',
      scalar(DB, `SELECT string_agg(updated_at::text, ',' ORDER BY id) FROM public.track_now_execution_items`) === beforeUpdatedAt)
    r = psqlFile(DB, path.join(VER, 'verify_habit_daily_counter.sql'))
    record('verify_habit_daily_counter.sql', r.status === 0 && /ALL \d+ HABIT COUNTER CHECKS PASSED/.test(out(r)), (out(r).match(/ALL \d+ HABIT COUNTER CHECKS PASSED/) || [''])[0])
    if (r.status !== 0) console.log(out(r))
    r = psqlFile(DB, path.join(VER, 'verify_increment_rpc_security.sql'))
    record('verify_increment_rpc_security.sql (after habit migration)', r.status === 0 && /ALL \d+ CHECKS PASSED/.test(out(r)))
    if (r.status !== 0) console.log(out(r))

    // 7. Re-applying migrations is safe and always ends in the secure state.
    let reapplyOk = true
    let reapplyErr = ''
    for (const file of [...ALL_IN_ORDER, MIGRATIONS.secure, MIGRATIONS.habit]) {
      const a = psqlFile(DB, file)
      if (a.status !== 0) {
        reapplyOk = false
        reapplyErr = `${path.basename(file)}: ${out(a).slice(0, 400)}`
        break
      }
    }
    record('all migrations re-apply cleanly in order (and a second time for the fixes)', reapplyOk, reapplyErr)
    r = psqlFile(DB, path.join(VER, 'verify_increment_rpc_security.sql'))
    const r2 = psqlFile(DB, path.join(VER, 'verify_habit_daily_counter.sql'))
    record('both verification scripts pass after re-application', r.status === 0 && r2.status === 0)

    // 8. Real concurrency: parallel sessions stepping the same habit.
    apply(DB, writeTemp(tmp, 'concurrency_fixture.sql', `
      INSERT INTO public.track_now_execution_items (id, user_id, plan_id, track_id, type, name, status, target_count, current_count, count_date)
      VALUES ('30000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000d1',
              '10000000-0000-4000-8000-0000000000d1', 'habit', 'Concurrent habit', 'todo', 100, 0, CURRENT_DATE);`), 'concurrency fixture')
    const workerSql = writeTemp(tmp, 'concurrency_worker.sql', `
      SET request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}';
      SET ROLE authenticated;
      ${Array.from({ length: 25 }, () => `SELECT public.track_now_increment_item_count('30000000-0000-4000-8000-0000000000e1', 1, CURRENT_DATE, false);`).join('\n')}
    `)
    const workers = await Promise.all(
      Array.from({ length: 8 }, () =>
        new Promise((resolve) => {
          const p = spawn(path.join(bin, exe('psql')), [...psqlArgs(DB), '-o', process.platform === 'win32' ? 'NUL' : '/dev/null', '-f', workerSql], { env })
          let err = ''
          p.stderr.on('data', (d) => (err += d))
          p.on('close', (code) => resolve({ code, err }))
        }),
      ),
    )
    const finalState = scalar(DB, `SELECT current_count || '/' || status || '/' ||
        (SELECT count(*) FROM public.track_now_item_completions WHERE item_id = '30000000-0000-4000-8000-0000000000e1')
      FROM public.track_now_execution_items WHERE id = '30000000-0000-4000-8000-0000000000e1'`)
    record('8 parallel sessions x 25 increments = 200, done, exactly one completion',
      workers.every((w) => w.code === 0) && finalState === '200/done/1', finalState + (workers.find((w) => w.code !== 0)?.err || ''))

    // 9. The unrelated shared table is untouched.
    record('tracked_profiles untouched',
      scalar(DB, `SELECT count(*) || ':' || min(label) FROM public.tracked_profiles`) === '1:sentinel row that must survive' &&
        scalar(DB, `SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.tracked_profiles'::regclass`) === '0' &&
        scalar(DB, `SELECT count(*) FROM pg_policies WHERE tablename = 'tracked_profiles'`) === '0')

    // 10. Read-only inventory (what the owner runs before/after on production).
    r = psqlFile(DB, path.join(VER, 'preflight_function_inventory.sql'))
    record('preflight_function_inventory.sql runs (read-only)', r.status === 0)
    console.log(out(r).trim())
  } catch (err) {
    record('harness', false, err instanceof Error ? err.message : String(err))
  } finally {
    if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      console.warn(`Could not delete ${tmp}; remove it manually.`)
    }
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length ? 1 : 0)
}

function writeTemp(dir, name, content) {
  const file = path.join(dir, name)
  fs.writeFileSync(file, content)
  return file
}

main()

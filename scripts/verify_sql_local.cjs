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
  revokeTrigger: path.join(MIG, '20261014000000_revoke_trigger_function_execute.sql'),
  plansArcs: path.join(MIG, '20261108000000_plans_arcs_and_flexible_items.sql'),
  arcName: path.join(MIG, '20261108010000_plans_arc_name.sql'),
  sharing: path.join(MIG, '20261109000000_account_deletion_and_plan_sharing.sql'),
  clientEvents: path.join(MIG, '20261110000000_client_events.sql'),
  syncedState: path.join(MIG, '20261111000000_synced_state.sql'),
  hardening: path.join(MIG, '20261112000000_security_hardening.sql'),
}
const ALL_IN_ORDER = [MIGRATIONS.init, MIGRATIONS.harden, MIGRATIONS.secure, MIGRATIONS.habit, MIGRATIONS.revokeTrigger, MIGRATIONS.plansArcs, MIGRATIONS.arcName, MIGRATIONS.sharing, MIGRATIONS.clientEvents, MIGRATIONS.syncedState, MIGRATIONS.hardening]

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
    r = run('pg_ctl', ['-D', data, '-l', log, '-w', '-o', `-p ${port} -c listen_addresses=127.0.0.1${process.platform === 'win32' ? '' : ` -c unix_socket_directories=${tmp}`}`, 'start'], { stdio: 'ignore' })
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

    // 6b. Trigger function no longer callable over the API; sign-up provisioning still works.
    apply(DB, MIGRATIONS.revokeTrigger, 'revoke trigger function execute')
    record('handle_new_track_now_user not executable by anon/authenticated',
      scalar(DB, `SELECT has_function_privilege('anon', 'public.handle_new_track_now_user()', 'EXECUTE')::text || ',' ||
                         has_function_privilege('authenticated', 'public.handle_new_track_now_user()', 'EXECUTE')::text`) === 'false,false')
    apply(DB, writeTemp(tmp, 'signup_after_revoke.sql', `
      INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('00000000-0000-4000-8000-0000000000f1', 'after-revoke@example.invalid', '{"display_name":"After Revoke"}');`), 'sign-up after revoke')
    record('profile provisioning trigger still fires after the revoke',
      scalar(DB, `SELECT full_name FROM public.track_now_profiles WHERE id = '00000000-0000-4000-8000-0000000000f1'`) === 'After Revoke')

    // 6c. Plans/Arcs + flexible items (additive): legacy rows untouched, constraints enforced, RLS still isolates.
    const legacyPlanBefore = scalar(DB, `SELECT status || '/' || updated_at::text FROM public.track_now_plans WHERE id = '20000000-0000-4000-8000-0000000000d1'`)
    apply(DB, MIGRATIONS.plansArcs, 'plans/arcs migration')
    apply(DB, MIGRATIONS.arcName, 'arc name migration')
    record('plans/arcs: legacy plan row unchanged (status + updated_at)',
      scalar(DB, `SELECT status || '/' || updated_at::text FROM public.track_now_plans WHERE id = '20000000-0000-4000-8000-0000000000d1'`) === legacyPlanBefore)
    const rejects = (sql) => psqlCmd(DB, sql).status !== 0
    record('plans/arcs: constraints reject bad values (status, kind, end<start, times_per_week, >50 checklist entries, arc_name > 80)',
      rejects(`UPDATE public.track_now_plans SET status = 'cancelled' WHERE id = '20000000-0000-4000-8000-0000000000d1'`) &&
      rejects(`UPDATE public.track_now_plans SET plan_kind = 'forever' WHERE id = '20000000-0000-4000-8000-0000000000d1'`) &&
      rejects(`UPDATE public.track_now_plans SET start_date = '2026-11-09', end_date = '2026-11-01' WHERE id = '20000000-0000-4000-8000-0000000000d1'`) &&
      rejects(`INSERT INTO public.track_now_item_schedules (item_id, frequency, times_per_week) VALUES ('30000000-0000-4000-8000-0000000000d2', 'weekly', 8)`) &&
      rejects(`UPDATE public.track_now_execution_items SET checklist_entries = (SELECT jsonb_agg(jsonb_build_object('id', g::text, 'label', 'x', 'done', false)) FROM generate_series(1, 51) g) WHERE id = '30000000-0000-4000-8000-0000000000d3'`) &&
      rejects(`UPDATE public.track_now_execution_items SET checklist_entries = '{"not":"an array"}' WHERE id = '30000000-0000-4000-8000-0000000000d3'`) &&
      rejects(`UPDATE public.track_now_plans SET arc_name = repeat('x', 81) WHERE id = '20000000-0000-4000-8000-0000000000d1'`))
    apply(DB, writeTemp(tmp, 'arcs_rls.sql', `
      INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000a2', 'other@example.invalid');
      SET request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}';
      SET ROLE authenticated;
      UPDATE public.track_now_plans SET status = 'paused', plan_kind = 'time_bound', outcome = 'Fit routine', arc_name = 'Winter Arc',
        start_date = '2026-11-09', end_date = '2027-02-06' WHERE id = '20000000-0000-4000-8000-0000000000d1';
      UPDATE public.track_now_execution_items SET start_date = '2026-11-16',
        checklist_entries = '[{"id":"a","label":"Sort","done":true},{"id":"b","label":"Load","done":false}]'
        WHERE id = '30000000-0000-4000-8000-0000000000d3';
      INSERT INTO public.track_now_item_schedules (item_id, frequency, times_per_week) VALUES ('30000000-0000-4000-8000-0000000000d2', 'weekly', 3);
      RESET ROLE;
      SET request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
      SET ROLE authenticated;
      UPDATE public.track_now_plans SET outcome = 'hijacked', arc_name = 'hijacked' WHERE id = '20000000-0000-4000-8000-0000000000d1';
      CREATE TEMP TABLE IF NOT EXISTS arcs_probe AS
        SELECT (SELECT count(*) FROM public.track_now_plans WHERE id = '20000000-0000-4000-8000-0000000000d1') AS seen;
      RESET ROLE;`), 'arcs owner/other-user writes')
    record('plans/arcs: owner can pause + set new fields; another user can neither see nor change them',
      scalar(DB, `SELECT status || '/' || plan_kind || '/' || outcome || '/' || arc_name FROM public.track_now_plans WHERE id = '20000000-0000-4000-8000-0000000000d1'`) === 'paused/time_bound/Fit routine/Winter Arc' &&
      scalar(DB, `SELECT start_date::text || '/' || jsonb_array_length(checklist_entries) FROM public.track_now_execution_items WHERE id = '30000000-0000-4000-8000-0000000000d3'`) === '2026-11-16/2' &&
      scalar(DB, `SELECT times_per_week FROM public.track_now_item_schedules WHERE item_id = '30000000-0000-4000-8000-0000000000d2'`) === '3')
    r = psqlFile(DB, path.join(VER, 'verify_increment_rpc_security.sql'))
    record('verify_increment_rpc_security.sql (after plans/arcs migration)', r.status === 0 && /ALL \d+ CHECKS PASSED/.test(out(r)))
    if (r.status !== 0) console.log(out(r))

    // 6d. Account deletion + Plan sharing.
    apply(DB, MIGRATIONS.sharing, 'account deletion + sharing migration')
    record('sharing: anon cannot execute delete_my_account; authenticated can; shared-plan RPC is public',
      scalar(DB, `SELECT has_function_privilege('anon', 'public.track_now_delete_my_account()', 'EXECUTE')::text || ',' ||
                         has_function_privilege('authenticated', 'public.track_now_delete_my_account()', 'EXECUTE')::text || ',' ||
                         has_function_privilege('anon', 'public.track_now_get_shared_plan(text)', 'EXECUTE')::text`) === 'false,true,true')
    apply(DB, writeTemp(tmp, 'share_fixture.sql', `
      SET request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}';
      SET ROLE authenticated;
      INSERT INTO public.track_now_plan_shares (user_id, plan_id, token) VALUES
        ('00000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000d1', 'tok_valid_0123456789abcdef0123456789abcdef'),
        ('00000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000d1', 'tok_revoked_123456789abcdef0123456789abcdef');
      UPDATE public.track_now_plan_shares SET revoked_at = now() WHERE token LIKE 'tok_revoked%';
      RESET ROLE;
      RESET ROLE;`), 'share fixture')
    record('sharing: another user sees none of the owner\'s share rows',
      scalar(DB, `SET request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}'; SET ROLE authenticated; SELECT count(*) FROM public.track_now_plan_shares; RESET ROLE;`) === '0')
    record('sharing: a valid token returns the plan (anon), a revoked one returns NULL, and the user id is never exposed',
      scalar(DB, `SET ROLE anon; SELECT (public.track_now_get_shared_plan('tok_valid_0123456789abcdef0123456789abcdef')->'plan'->>'name') IS NOT NULL
        AND public.track_now_get_shared_plan('tok_revoked_123456789abcdef0123456789abcdef') IS NULL
        AND (public.track_now_get_shared_plan('tok_valid_0123456789abcdef0123456789abcdef')::text NOT LIKE '%00000000-0000-4000-8000-0000000000d1%'); RESET ROLE;`).includes('t'))
    apply(DB, writeTemp(tmp, 'delete_account.sql', `
      INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000a3', 'gone@example.invalid');
      INSERT INTO public.track_now_tracks (id, user_id, name, status) VALUES ('10000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a3', 'Gone track', 'active');
      SET request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
      SET ROLE authenticated;
      SELECT public.track_now_delete_my_account();
      RESET ROLE;`), 'delete account')
    record('delete_my_account removes the user and their rows, and only theirs',
      scalar(DB, `SELECT (SELECT count(*) FROM auth.users WHERE id = '00000000-0000-4000-8000-0000000000a3')::text || ',' ||
                         (SELECT count(*) FROM public.track_now_tracks WHERE user_id = '00000000-0000-4000-8000-0000000000a3')::text || ',' ||
                         (SELECT count(*) FROM public.track_now_plans WHERE id = '20000000-0000-4000-8000-0000000000d1')::text`) === '0,0,1')

    // 6e. Client events (usage + error reports): insert-only for the signed-in user.
    apply(DB, MIGRATIONS.clientEvents, 'client events migration')
    const OWNER = '00000000-0000-4000-8000-0000000000d1'
    const OTHER = '00000000-0000-4000-8000-0000000000a2'
    const EVENTS = 'public.track_now_client_events'
    const asUser = (id, sql) => `SET request.jwt.claims = '{"sub":"${id}","role":"authenticated"}'; SET ROLE authenticated; ${sql}`
    const accepts = (sql) => psqlCmd(DB, sql).status === 0
    record('client events: one INSERT-only policy; anon has no privileges, authenticated only INSERT',
      scalar(DB, `SELECT count(*) || ':' || min(cmd) || ':' || min(roles::text) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'track_now_client_events'`) === '1:INSERT:{authenticated}' &&
      scalar(DB, `SELECT string_agg(r || '.' || p || '=' || has_table_privilege(r, '${EVENTS}', p)::text, ',' ORDER BY r, p)
                  FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['DELETE', 'INSERT', 'SELECT', 'UPDATE']) p`) ===
        'anon.DELETE=false,anon.INSERT=false,anon.SELECT=false,anon.UPDATE=false,authenticated.DELETE=false,authenticated.INSERT=true,authenticated.SELECT=false,authenticated.UPDATE=false')
    record('client events: a signed-in user can insert their own rows (user_id defaults to auth.uid(); batch; full-size error props)',
      accepts(asUser(OWNER, `INSERT INTO ${EVENTS} (kind, name, app) VALUES ('event', 'session_start', 'web')`)) &&
      accepts(asUser(OWNER, `INSERT INTO ${EVENTS} (user_id, kind, name, props, app, app_version, session_id) VALUES
        ('${OWNER}', 'event', 'template_used', '{"template":"get-fit"}', 'mobile', '1.0.0', 'abcdef0123456789'),
        ('${OWNER}', 'error', 'TypeError', jsonb_build_object('message', repeat('m', 300), 'stack', repeat('s', 1500), 'where', repeat('w', 200)), 'mobile', '1.0.0', 'abcdef0123456789'),
        ('${OWNER}', 'event', 'big', jsonb_build_object('x', repeat('x', 3900)), 'web', NULL, NULL)`)) &&
      scalar(DB, `SELECT count(*) || ':' || count(*) FILTER (WHERE user_id = '${OWNER}') FROM ${EVENTS}`) === '4:4')
    record('client events: a user cannot insert a row for another user',
      rejects(asUser(OTHER, `INSERT INTO ${EVENTS} (user_id, kind, name, app) VALUES ('${OWNER}', 'event', 'forged', 'web')`)))
    record('client events: app users cannot select, update or delete any row (their own included)',
      rejects(asUser(OWNER, `SELECT count(*) FROM ${EVENTS}`)) &&
      rejects(asUser(OWNER, `INSERT INTO ${EVENTS} (kind, name, app) VALUES ('event', 'peek', 'web') RETURNING id`)) &&
      rejects(asUser(OWNER, `UPDATE ${EVENTS} SET name = 'changed'`)) &&
      rejects(asUser(OWNER, `DELETE FROM ${EVENTS}`)) &&
      rejects(asUser(OTHER, `SELECT count(*) FROM ${EVENTS}`)))
    record('client events: anon cannot insert (with or without a user id)',
      rejects(`SET ROLE anon; INSERT INTO ${EVENTS} (kind, name, app) VALUES ('event', 'anon', 'web')`) &&
      rejects(`SET ROLE anon; INSERT INTO ${EVENTS} (user_id, kind, name, app) VALUES ('${OWNER}', 'event', 'anon', 'web')`))
    record('client events: oversized props and bad kind / name / app / version / session are rejected',
      rejects(asUser(OWNER, `INSERT INTO ${EVENTS} (kind, name, props, app) VALUES ('event', 'big', jsonb_build_object('x', repeat('x', 5000)), 'web')`)) &&
      rejects(asUser(OWNER, `INSERT INTO ${EVENTS} (kind, name, app) VALUES ('page_view', 'x', 'web')`)) &&
      rejects(asUser(OWNER, `INSERT INTO ${EVENTS} (kind, name, app) VALUES ('event', '', 'web')`)) &&
      rejects(asUser(OWNER, `INSERT INTO ${EVENTS} (kind, name, app) VALUES ('event', repeat('n', 81), 'web')`)) &&
      rejects(asUser(OWNER, `INSERT INTO ${EVENTS} (kind, name, app) VALUES ('event', 'x', 'desktop')`)) &&
      rejects(asUser(OWNER, `INSERT INTO ${EVENTS} (kind, name, app, app_version) VALUES ('event', 'x', 'web', repeat('v', 41))`)) &&
      rejects(asUser(OWNER, `INSERT INTO ${EVENTS} (kind, name, app, session_id) VALUES ('event', 'x', 'web', repeat('s', 41))`)) &&
      scalar(DB, `SELECT count(*) FROM ${EVENTS}`) === '4')
    r = psqlFile(DB, path.join(ROOT, 'supabase', 'analytics', 'funnel.sql'))
    record('analytics/funnel.sql runs and changes nothing (read-only)', r.status === 0 && scalar(DB, `SELECT count(*) FROM ${EVENTS}`) === '4')
    if (r.status !== 0) console.log(out(r))

    // 6f. Synced state (review notes, today's focus): each user reads and writes only their own rows.
    apply(DB, MIGRATIONS.syncedState, 'synced state migration')
    const STATE = 'public.track_now_synced_state'
    const upsert = (userClause, scope, key, value, at) =>
      `INSERT INTO ${STATE} (${userClause ? 'user_id, ' : ''}scope, key, value, updated_at) VALUES (${userClause ? `'${userClause}', ` : ''}'${scope}', '${key}', ${value}, '${at}')
       ON CONFLICT (user_id, scope, key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`
    record('synced state: four own-row policies; anon has no privileges, authenticated has all four',
      scalar(DB, `SELECT string_agg(cmd || ':' || roles::text, ',' ORDER BY cmd) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'track_now_synced_state'`) ===
        'DELETE:{authenticated},INSERT:{authenticated},SELECT:{authenticated},UPDATE:{authenticated}' &&
      scalar(DB, `SELECT string_agg(r || '.' || p || '=' || has_table_privilege(r, '${STATE}', p)::text, ',' ORDER BY r, p)
                  FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['DELETE', 'INSERT', 'SELECT', 'UPDATE']) p`) ===
        'anon.DELETE=false,anon.INSERT=false,anon.SELECT=false,anon.UPDATE=false,authenticated.DELETE=true,authenticated.INSERT=true,authenticated.SELECT=true,authenticated.UPDATE=true')
    record('synced state: a user saves a note, overwrites it (the app\'s upsert), marks it deleted, and saves focus',
      accepts(asUser(OWNER, upsert(OWNER, 'review_note', 'weekly:2026-11-09', `'{"periodKey":"weekly:2026-11-09","kind":"weekly","answers":{"friction":"v1"},"priorities":[],"updatedAt":"2026-11-10T08:00:00.000Z"}'::jsonb`, '2026-11-10T08:00:00Z'))) &&
      accepts(asUser(OWNER, upsert(OWNER, 'review_note', 'weekly:2026-11-09', `'{"periodKey":"weekly:2026-11-09","kind":"weekly","answers":{"friction":"v2"},"priorities":["Ship"],"updatedAt":"2026-11-10T09:00:00.000Z"}'::jsonb`, '2026-11-10T09:00:00Z'))) &&
      accepts(asUser(OWNER, upsert('', 'review_note', 'monthly:2026-10', 'NULL', '2026-11-10T09:30:00Z'))) &&
      accepts(asUser(OWNER, upsert(OWNER, 'focus', 'today', `'{"date":"2026-11-10","ids":["a","b"],"updatedAt":"2026-11-10T07:00:00.000Z"}'::jsonb`, '2026-11-10T07:00:00Z'))) &&
      scalar(DB, `SELECT count(*) || ':' || (SELECT value #>> '{answers,friction}' FROM ${STATE} WHERE key = 'weekly:2026-11-09') || ':' ||
                         (SELECT (value IS NULL)::text FROM ${STATE} WHERE key = 'monthly:2026-10') FROM ${STATE} WHERE user_id = '${OWNER}'`) === '3:v2:true')
    record('synced state: a user sees only their own rows',
      scalar(DB, asUser(OWNER, `SELECT count(*) FROM ${STATE}`)) === '3' &&
      scalar(DB, asUser(OTHER, `SELECT count(*) FROM ${STATE}`)) === '0')
    record('synced state: a user cannot write, overwrite, update or delete another user\'s rows',
      rejects(asUser(OTHER, `INSERT INTO ${STATE} (user_id, scope, key, value) VALUES ('${OWNER}', 'review_note', 'weekly:2026-11-02', '{}'::jsonb)`)) &&
      rejects(asUser(OTHER, upsert(OWNER, 'focus', 'today', `'{"date":"2026-11-10","ids":["forged"]}'::jsonb`, '2026-11-10T23:00:00Z'))) &&
      accepts(asUser(OTHER, `UPDATE ${STATE} SET value = '{"forged":true}'::jsonb`)) &&
      accepts(asUser(OTHER, `DELETE FROM ${STATE}`)) &&
      scalar(DB, `SELECT count(*) || ':' || count(*) FILTER (WHERE value::text LIKE '%forged%') FROM ${STATE} WHERE user_id = '${OWNER}'`) === '3:0')
    record('synced state: a user cannot hand one of their rows to another user',
      rejects(asUser(OWNER, `UPDATE ${STATE} SET user_id = '${OTHER}' WHERE scope = 'focus'`)))
    record('synced state: anon cannot read or write',
      rejects(`SET ROLE anon; SELECT count(*) FROM ${STATE}`) &&
      rejects(`SET ROLE anon; INSERT INTO ${STATE} (user_id, scope, key, value) VALUES ('${OWNER}', 'focus', 'today', '{}'::jsonb)`))
    record('synced state: unknown scope, bad key and oversized value are rejected',
      rejects(asUser(OWNER, `INSERT INTO ${STATE} (scope, key, value) VALUES ('settings', 'x', '{}'::jsonb)`)) &&
      rejects(asUser(OWNER, `INSERT INTO ${STATE} (scope, key, value) VALUES ('focus', '', '{}'::jsonb)`)) &&
      rejects(asUser(OWNER, `INSERT INTO ${STATE} (scope, key, value) VALUES ('focus', 'has space', '{}'::jsonb)`)) &&
      rejects(asUser(OWNER, `INSERT INTO ${STATE} (scope, key, value) VALUES ('focus', repeat('k', 65), '{}'::jsonb)`)) &&
      rejects(asUser(OWNER, `INSERT INTO ${STATE} (scope, key, value) VALUES ('review_note', 'weekly:2026-01-05', jsonb_build_object('x', (SELECT string_agg(md5(i::text), '') FROM generate_series(1, 4000) i)))`)) &&
      scalar(DB, `SELECT count(*) FROM ${STATE}`) === '3')
    apply(DB, writeTemp(tmp, 'synced_state_account.sql', `
      INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000b7', 'sync-delete@example.test');
      INSERT INTO public.track_now_synced_state (user_id, scope, key, value) VALUES ('00000000-0000-4000-8000-0000000000b7', 'focus', 'today', '{"date":"2026-11-10","ids":[]}'::jsonb);
      SET request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000b7","role":"authenticated"}';
      SET ROLE authenticated;
      SELECT public.track_now_delete_my_account();
      RESET ROLE;`), 'delete an account that has synced state')
    record('synced state: deleting the account removes its rows, and only its rows',
      scalar(DB, `SELECT count(*) FILTER (WHERE user_id = '00000000-0000-4000-8000-0000000000b7') || ':' || count(*) FROM ${STATE}`) === '0:3')

    // 6g. Audit hardening: server-generated share tokens; anon loses table privileges it never needed.
    const anonPrivs = () => scalar(DB, `SELECT coalesce(string_agg(table_name || '.' || privilege_type, ',' ORDER BY table_name, privilege_type), '')
      FROM information_schema.role_table_grants WHERE grantee = 'anon' AND table_schema = 'public' AND table_name LIKE 'track\\_now\\_%'`)
    record('before hardening: anon still holds table privileges on the core tables (finding S-35 reproduced)', /track_now_tracks\.SELECT/.test(anonPrivs()))
    apply(DB, MIGRATIONS.hardening, 'security hardening migration')
    record('hardening: the only table privilege anon keeps is reading the template catalogue', anonPrivs() === 'track_now_track_templates.SELECT', anonPrivs())
    record('hardening: signed-in users can read but not write the template catalogue',
      scalar(DB, `SELECT string_agg(p || '=' || has_table_privilege('authenticated', 'public.track_now_track_templates', p)::text, ',' ORDER BY p) FROM unnest(ARRAY['DELETE', 'INSERT', 'SELECT', 'UPDATE']) p`) ===
        'DELETE=false,INSERT=false,SELECT=true,UPDATE=false')
    record('hardening: a share created without a token gets a 64-character random one, different every time',
      accepts(asUser(OWNER, `INSERT INTO public.track_now_plan_shares (user_id, plan_id) VALUES ('${OWNER}', '20000000-0000-4000-8000-0000000000d1'), ('${OWNER}', '20000000-0000-4000-8000-0000000000d1')`)) &&
      scalar(DB, `SELECT count(DISTINCT token) || ':' || bool_and(token ~ '^[0-9a-f]{64}$')::text FROM public.track_now_plan_shares WHERE user_id = '${OWNER}' AND length(token) = 64`) === '2:true')
    const serverToken = scalar(DB, `SELECT token FROM public.track_now_plan_shares WHERE user_id = '${OWNER}' AND length(token) = 64 LIMIT 1`)
    record('hardening: the public shared-plan page still works for anon through the function',
      scalar(DB, `SET ROLE anon; SELECT (public.track_now_get_shared_plan('${serverToken}') IS NOT NULL)::text`).split(/\r?\n/).pop() === 'true')

    // 7. Re-applying migrations is safe and always ends in the secure state.
    let reapplyOk = true
    let reapplyErr = ''
    for (const file of [...ALL_IN_ORDER, MIGRATIONS.secure, MIGRATIONS.habit, MIGRATIONS.revokeTrigger, MIGRATIONS.plansArcs, MIGRATIONS.arcName, MIGRATIONS.sharing, MIGRATIONS.clientEvents, MIGRATIONS.syncedState, MIGRATIONS.hardening]) {
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

    // 8b. ACCESS MATRIX, generated from the catalog: every track_now_* table x {another signed-in
    //     user, anon} x {read, forge-insert, update, delete}. A table nobody listed here fails
    //     the run, so a table added later cannot be forgotten. Evidence is written to
    //     AUDIT_EVIDENCE_DIR when set.
    {
      const V = '00000000-0000-4000-8000-0000000000c1' // victim: owns one row in every table
      const X = '00000000-0000-4000-8000-0000000000c2' // attacker: signed in, owns nothing
      const vid = (n) => `c${n}000000-0000-4000-8000-0000000000c1`
      apply(DB, writeTemp(tmp, 'matrix_fixture.sql', `
        INSERT INTO auth.users (id, email) VALUES ('${V}', 'matrix-victim@example.invalid'), ('${X}', 'matrix-attacker@example.invalid');
        INSERT INTO public.track_now_tracks (id, user_id, name) VALUES ('${vid(1)}', '${V}', 'Victim track');
        INSERT INTO public.track_now_plans (id, user_id, track_id, name) VALUES ('${vid(2)}', '${V}', '${vid(1)}', 'Victim plan');
        INSERT INTO public.track_now_execution_items (id, user_id, plan_id, track_id, type, name) VALUES ('${vid(3)}', '${V}', '${vid(2)}', '${vid(1)}', 'habit', 'Victim habit');
        INSERT INTO public.track_now_item_schedules (id, item_id, frequency) VALUES ('${vid(4)}', '${vid(3)}', 'daily');
        INSERT INTO public.track_now_item_completions (id, item_id, user_id, completed_date) VALUES ('${vid(5)}', '${vid(3)}', '${V}', CURRENT_DATE);
        INSERT INTO public.track_now_plan_shares (id, user_id, plan_id, token) VALUES ('${vid(6)}', '${V}', '${vid(2)}', repeat('v', 40));
        INSERT INTO public.track_now_synced_state (user_id, scope, key, value) VALUES ('${V}', 'focus', 'today', '{"date":"2026-11-10","ids":[]}'::jsonb);
        INSERT INTO public.track_now_client_events (user_id, kind, name, app) VALUES ('${V}', 'event', 'matrix', 'web');
        DELETE FROM public.track_now_profiles WHERE id = '${X}';`), 'access matrix fixture')

      // How to recognise the victim's rows in each table (superuser only). Unknown table = failure.
      const VICTIM_ROWS = {
        track_now_profiles: `id = '${V}'`,
        track_now_tracks: `user_id = '${V}'`,
        track_now_plans: `user_id = '${V}'`,
        track_now_execution_items: `user_id = '${V}'`,
        track_now_item_schedules: `item_id = '${vid(3)}'`,
        track_now_item_completions: `user_id = '${V}'`,
        track_now_plan_shares: `user_id = '${V}'`,
        track_now_synced_state: `user_id = '${V}'`,
        track_now_client_events: `user_id = '${V}'`,
      }
      // Reference data everyone may read; nobody may write it through the API.
      const PUBLIC_READ = new Set(['track_now_track_templates'])

      const tables = scalar(DB, `SELECT string_agg(tablename, ',' ORDER BY tablename) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'track\\_now\\_%'`).split(',')
      const unknown = tables.filter((t) => !(t in VICTIM_ROWS) && !PUBLIC_READ.has(t))
      record('access matrix: every track_now_* table in the catalog is covered', unknown.length === 0, unknown.join(','))

      const actors = {
        'other user': `SET request.jwt.claims = '{"sub":"${X}","role":"authenticated"}'; SET ROLE authenticated; `,
        anon: `SET ROLE anon; `,
      }
      // Runs one statement as an actor; returns 'denied:<sqlstate>' or 'rows:<n>'.
      const attempt = (prefix, sql) => {
        const res = run('psql', [...psqlArgs(DB), '-v', 'VERBOSITY=sqlstate', '-At', '-c', `${prefix}${sql}`])
        if (res.status !== 0) return `denied:${(out(res).match(/ERROR:\s+(\w{5})/) || [, 'unknown'])[1]}`
        return `rows:${res.stdout.trim().split(/\r?\n/).pop()}`
      }
      const fingerprint = (t) => scalar(DB, `SELECT count(*) || ':' || coalesce(md5(string_agg(x::text, '|' ORDER BY x::text)), '-') FROM public.${t} x`)

      psqlCmd(DB, `DROP SCHEMA IF EXISTS audit_stage CASCADE; CREATE SCHEMA audit_stage; GRANT USAGE ON SCHEMA audit_stage TO anon, authenticated`)
      const lines = ['| Table | Actor | Read | Forged insert | Update | Delete | Rows unchanged | Verdict |', '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |']
      for (const t of tables.filter((x) => x in VICTIM_ROWS || PUBLIC_READ.has(x))) {
        const isPublic = PUBLIC_READ.has(t)
        // A copy of real rows for the attacker to try to re-insert under the victim's identity.
        // Identity columns and defaulted "id" keys are left out so a refusal can only come from access rules.
        const cols = scalar(DB, `SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${t}' AND is_identity = 'NO' AND is_generated = 'NEVER' AND NOT (column_name = 'id' AND column_default IS NOT NULL)`)
        const firstCol = cols.split(', ')[0]
        psqlCmd(DB, `CREATE TABLE audit_stage.${t} AS SELECT ${cols} FROM public.${t} WHERE ${isPublic ? 'true' : VICTIM_ROWS[t]} LIMIT 1; GRANT SELECT ON audit_stage.${t} TO anon, authenticated`)
        const staged = scalar(DB, `SELECT count(*) FROM audit_stage.${t}`)
        if (staged !== '1') {
          record(`access matrix: ${t}`, false, 'no victim row to attack (fixture missing)')
          continue
        }
        for (const [actor, prefix] of Object.entries(actors)) {
          const before = fingerprint(t)
          const read = attempt(prefix, `SELECT count(*) FROM public.${t}`)
          const insert = attempt(prefix, `WITH i AS (INSERT INTO public.${t} (${cols}) SELECT ${cols} FROM audit_stage.${t} RETURNING 1) SELECT count(*) FROM i`)
          const insertBlind = attempt(prefix, `INSERT INTO public.${t} (${cols}) SELECT ${cols} FROM audit_stage.${t}`)
          const update = attempt(prefix, `WITH u AS (UPDATE public.${t} SET ${firstCol} = ${firstCol} RETURNING 1) SELECT count(*) FROM u`)
          const updateBlind = attempt(prefix, `UPDATE public.${t} SET ${firstCol} = ${firstCol}`)
          const del = attempt(prefix, `WITH d AS (DELETE FROM public.${t} RETURNING 1) SELECT count(*) FROM d`)
          const delBlind = attempt(prefix, `DELETE FROM public.${t}`)
          const unchanged = fingerprint(t) === before
          const readOk = isPublic ? true : read === 'rows:0' || read.startsWith('denied:')
          const insertOk = insert.startsWith('denied:') && insertBlind.startsWith('denied:')
          const writeOk = (v) => v === 'rows:0' || v.startsWith('denied:')
          const ok = readOk && insertOk && writeOk(update) && writeOk(del) && unchanged
          lines.push(`| ${t} | ${actor} | ${read}${isPublic ? ' (public catalog)' : ''} | ${insert} / blind ${insertBlind} | ${update} / blind ${updateBlind.replace(/^rows:.*/, 'no error')} | ${del} / blind ${delBlind.replace(/^rows:.*/, 'no error')} | ${unchanged ? 'yes' : 'NO'} | ${ok ? 'PASS' : 'FAIL'} |`)
          record(`access matrix: ${t} is closed to ${actor === 'anon' ? 'anon' : 'another signed-in user'} (read ${read}, insert ${insert}, update ${update}, delete ${del})`, ok)
        }
      }
      psqlCmd(DB, `DROP SCHEMA audit_stage CASCADE`)

      // Functions: every SECURITY DEFINER function pins search_path; anon can call only the allowlist.
      const fnRows = scalar(DB, `SELECT coalesce(string_agg(p.oid::regprocedure::text || '|' || p.prosecdef::text || '|' || coalesce(array_to_string(p.proconfig, ';'), '') || '|' ||
          has_function_privilege('anon', p.oid, 'EXECUTE')::text || '|' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '|' || (p.prorettype = 'trigger'::regtype)::text, E'\n' ORDER BY p.oid::regprocedure::text), '')
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'`).split(/\r?\n/).filter(Boolean).map((l) => {
        const [sig, secdef, config, anon, auth, trig] = l.split('|')
        return { sig, secdef: secdef === 'true', config, anon: anon === 'true', auth: auth === 'true', trigger: trig === 'true' }
      })
      const ANON_ALLOWED = new Set(['track_now_get_shared_plan(text)'])
      const unpinned = fnRows.filter((f) => f.secdef && !/search_path=/.test(f.config))
      const anonCallable = fnRows.filter((f) => f.anon && f.secdef && !ANON_ALLOWED.has(f.sig))
      const anonAny = fnRows.filter((f) => f.anon && !f.trigger && !ANON_ALLOWED.has(f.sig))
      record('functions: every SECURITY DEFINER function pins search_path', unpinned.length === 0, unpinned.map((f) => f.sig).join(', '))
      record('functions: anon can execute no SECURITY DEFINER function outside the allowlist', anonCallable.length === 0, anonCallable.map((f) => f.sig).join(', '))
      record('functions: anon can execute no non-trigger function outside the allowlist', anonAny.length === 0, anonAny.map((f) => f.sig).join(', '))

      // Shared-plan link: unguessable-length tokens only, no oracle for near misses, revocation works.
      const asAnon = (sql) => attempt(`SET ROLE anon; `, sql)
      record('share link: short, wrong and NULL tokens return NULL; the right token returns the plan without the owner id',
        asAnon(`SELECT (public.track_now_get_shared_plan(repeat('v', 31)) IS NULL)::text`) === 'rows:true' &&
        asAnon(`SELECT (public.track_now_get_shared_plan(repeat('v', 39) || 'w') IS NULL)::text`) === 'rows:true' &&
        asAnon(`SELECT (public.track_now_get_shared_plan(NULL) IS NULL)::text`) === 'rows:true' &&
        asAnon(`SELECT (public.track_now_get_shared_plan(repeat('v', 40)) #>> '{plan,name}')`) === 'rows:Victim plan' &&
        asAnon(`SELECT (public.track_now_get_shared_plan(repeat('v', 40))::text LIKE '%${V}%')::text`) === 'rows:false')
      record('share link: anon cannot list tokens',
        ['rows:0'].includes(asAnon(`SELECT count(*) FROM public.track_now_plan_shares`)) || asAnon(`SELECT count(*) FROM public.track_now_plan_shares`).startsWith('denied:'))

      // Confused parent: the attacker owns the new row but points it at the victim's parent row.
      // If any of these worked, the attacker could plant content in the victim's Plan (and in
      // the victim's public share page) or log completions against the victim's items.
      const xid = (n) => `c${n}000000-0000-4000-8000-0000000000c2`
      const asX = actors['other user']
      apply(DB, writeTemp(tmp, 'matrix_attacker_rows.sql', `
        ${asX}
        INSERT INTO public.track_now_tracks (id, user_id, name) VALUES ('${xid(1)}', '${X}', 'Attacker track');
        INSERT INTO public.track_now_plans (id, user_id, track_id, name) VALUES ('${xid(2)}', '${X}', '${xid(1)}', 'Attacker plan');
        INSERT INTO public.track_now_execution_items (id, user_id, plan_id, track_id, type, name) VALUES ('${xid(3)}', '${X}', '${xid(2)}', '${xid(1)}', 'task', 'Attacker task');
        RESET ROLE;`), 'attacker creates their own rows (must be allowed)')
      const parentAttacks = {
        'plan under the victim\'s track': `INSERT INTO public.track_now_plans (user_id, track_id, name) VALUES ('${X}', '${vid(1)}', 'planted')`,
        'item under the victim\'s plan': `INSERT INTO public.track_now_execution_items (user_id, plan_id, track_id, type, name) VALUES ('${X}', '${vid(2)}', '${xid(1)}', 'task', 'planted')`,
        'item in own plan but the victim\'s track': `INSERT INTO public.track_now_execution_items (user_id, plan_id, track_id, type, name) VALUES ('${X}', '${xid(2)}', '${vid(1)}', 'task', 'planted')`,
        'move own item into the victim\'s plan': `UPDATE public.track_now_execution_items SET plan_id = '${vid(2)}' WHERE id = '${xid(3)}'`,
        'move own plan into the victim\'s track': `UPDATE public.track_now_plans SET track_id = '${vid(1)}' WHERE id = '${xid(2)}'`,
        'completion on the victim\'s item': `INSERT INTO public.track_now_item_completions (item_id, user_id, completed_date) VALUES ('${vid(3)}', '${X}', CURRENT_DATE - 1)`,
        'schedule on the victim\'s item': `INSERT INTO public.track_now_item_schedules (item_id, frequency) VALUES ('${vid(3)}', 'daily')`,
        'share link for the victim\'s plan': `INSERT INTO public.track_now_plan_shares (user_id, plan_id, token) VALUES ('${X}', '${vid(2)}', repeat('x', 40))`,
        'counter RPC on the victim\'s item': `SELECT public.track_now_increment_item_count('${vid(3)}', 1, CURRENT_DATE, false)`,
      }
      const parentLines = ['| Attempt by another signed-in user | Result | Verdict |', '| :--- | :--- | :--- |']
      for (const [what, sql] of Object.entries(parentAttacks)) {
        const res = attempt(asX, sql)
        const ok = res.startsWith('denied:')
        parentLines.push(`| ${what} | ${res} | ${ok ? 'PASS' : 'FAIL'} |`)
        record(`confused parent: ${what} is refused (${res})`, ok)
      }
      record('confused parent: the victim\'s shared plan still shows only the victim\'s item',
        attempt(`SET ROLE anon; `, `SELECT jsonb_array_length(public.track_now_get_shared_plan(repeat('v', 40)) -> 'items')`) === 'rows:1')
      lines.push('', '## Rows pointed at another user\'s parent', '', ...parentLines)

      // Account deletion: every foreign key to auth.users cascades, and the victim leaves no row anywhere.
      const nonCascade = scalar(DB, `SELECT coalesce(string_agg(conrelid::regclass::text, ','), '') FROM pg_constraint c
        WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass AND c.confdeltype <> 'c' AND conrelid::regclass::text LIKE '%track_now%'`)
      record('account deletion: every track_now foreign key to auth.users is ON DELETE CASCADE', nonCascade === '', nonCascade)
      apply(DB, writeTemp(tmp, 'matrix_delete.sql', `
        SET request.jwt.claims = '{"sub":"${V}","role":"authenticated"}';
        SET ROLE authenticated;
        SELECT public.track_now_delete_my_account();
        RESET ROLE;`), 'delete the matrix victim')
      const leftovers = Object.entries(VICTIM_ROWS).map(([t, where]) => `${t}=${scalar(DB, `SELECT count(*) FROM public.${t} WHERE ${where}`)}`).filter((x) => !x.endsWith('=0'))
      record('account deletion: the deleted user has no row left in any track_now_* table', leftovers.length === 0, leftovers.join(', '))

      if (process.env.AUDIT_EVIDENCE_DIR) {
        fs.mkdirSync(process.env.AUDIT_EVIDENCE_DIR, { recursive: true })
        const fnTable = ['| Function | SECURITY DEFINER | Settings | anon may execute | signed-in may execute |', '| :--- | :--- | :--- | :--- | :--- |',
          ...fnRows.map((f) => `| \`${f.sig}\`${f.trigger ? ' (trigger)' : ''} | ${f.secdef ? 'yes' : 'no'} | ${f.config || '-'} | ${f.anon ? 'YES' : 'no'} | ${f.auth ? 'yes' : 'no'} |`)]
        fs.writeFileSync(path.join(process.env.AUDIT_EVIDENCE_DIR, 'db-access-matrix.md'), [
          '# Database access matrix', '',
          'Generated by `node scripts/verify_sql_local.cjs` on a throw-away local PostgreSQL with every migration applied. No hosted project was contacted.', '',
          '`denied:42501` = refused by privileges or row level security. `rows:0` = the statement ran and touched or saw nothing. "blind" = the same write without RETURNING (needs no read access).', '',
          ...lines, '', '## Functions in schema public', '', ...fnTable, ''].join('\n'))
      }
    }

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

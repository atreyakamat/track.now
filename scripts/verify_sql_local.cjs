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
}
const ALL_IN_ORDER = [MIGRATIONS.init, MIGRATIONS.harden, MIGRATIONS.secure, MIGRATIONS.habit, MIGRATIONS.revokeTrigger, MIGRATIONS.plansArcs, MIGRATIONS.arcName, MIGRATIONS.sharing, MIGRATIONS.clientEvents, MIGRATIONS.syncedState]

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

    // 7. Re-applying migrations is safe and always ends in the secure state.
    let reapplyOk = true
    let reapplyErr = ''
    for (const file of [...ALL_IN_ORDER, MIGRATIONS.secure, MIGRATIONS.habit, MIGRATIONS.revokeTrigger, MIGRATIONS.plansArcs, MIGRATIONS.arcName, MIGRATIONS.sharing, MIGRATIONS.clientEvents, MIGRATIONS.syncedState]) {
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

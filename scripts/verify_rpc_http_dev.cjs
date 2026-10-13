#!/usr/bin/env node
/**
 * HTTP smoke test for the counter RPC on a DISPOSABLE DEVELOPMENT Supabase project,
 * after `20261012000000_secure_increment_item_count_rpc.sql` (and optionally
 * `20261013000000_habit_daily_counter.sql`) have been applied there.
 *
 * It exercises the real PostgREST HTTP layer (which the local SQL harness cannot):
 *   1. anon key only            -> RPC refused, victim item unchanged
 *   2. user B on user A's item  -> refused (42501), item unchanged
 *   3. old payload with p_user_id -> PGRST202 (function not found)
 *   4. user A on own item       -> increment / reach target (completion logged) / decrement
 *   5. RLS: user B cannot read user A's items
 *   6. (if count_date exists) habit renamed on a new day restarts at 1; stale-day request rejected
 *
 * SAFETY (fail closed, see scripts/lib/liveGuard.cjs):
 *   - reads ONLY explicitly exported variables, never .env files (the repo .env points at production);
 *   - refuses to start unless SUPABASE_SERVICE_ROLE_KEY is set, ALLOW_LIVE_SUPABASE equals the
 *     target project ref, and the ref is not listed in PRODUCTION_SUPABASE_REFS;
 *   - creates two throw-away users with the admin API (email_confirm: true -> no email is sent)
 *     on the non-routable .invalid domain and deletes them (cascading all their rows) at the end,
 *     also on failure.
 *
 * Usage (development project only):
 *   SUPABASE_URL=https://<dev-ref>.supabase.co SUPABASE_ANON_KEY=<dev anon key> \
 *   SUPABASE_SERVICE_ROLE_KEY=<dev service key> ALLOW_LIVE_SUPABASE=<dev-ref> \
 *   PRODUCTION_SUPABASE_REFS=<prod-ref> node scripts/verify_rpc_http_dev.cjs
 * Exit codes: 0 all passed, 1 a check failed, 2 refused to start.
 */
const { createClient } = require('@supabase/supabase-js')

const env = process.env
const url = env.SUPABASE_URL
const anonKey = env.SUPABASE_ANON_KEY
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

// Fail closed: explicit per-project opt-in, never production (see scripts/lib/liveGuard.cjs).
require('./lib/liveGuard.cjs').assertLiveTargetAllowed({ url, serviceKey, env, scriptName: 'verify_rpc_http_dev.cjs' })
if (!anonKey) {
  console.error('REFUSED: SUPABASE_ANON_KEY is not set.')
  process.exit(2)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const RPC = `${url}/rest/v1/rpc/track_now_increment_item_count`

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail && !ok ? ` — ${detail}` : ''}`)
}

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = localDate()
const yesterday = localDate(new Date(Date.now() - 24 * 60 * 60 * 1000))

/** Raw PostgREST request; returns { status, body }. */
async function rest(path, { method = 'GET', token, body, prefer } = {}) {
  const headers = { apikey: anonKey, Authorization: `Bearer ${token || anonKey}`, 'Content-Type': 'application/json' }
  if (prefer) headers.Prefer = prefer
  const res = await fetch(path.startsWith('http') ? path : `${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  return { status: res.status, body: parsed }
}

const createdUserIds = []

async function makeUser(label) {
  const email = `rpc-http-${label}-${Date.now()}@tracknow.invalid`
  const password = `RpcHttp!${Date.now()}-${Math.random().toString(36).slice(2)}`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser ${label} failed: ${error?.message}`)
  createdUserIds.push(data.user.id)
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password })
  if (signErr || !signIn.session) throw new Error(`signIn ${label} failed: ${signErr?.message}`)
  return { id: data.user.id, token: signIn.session.access_token }
}

async function itemOf(token, id) {
  const r = await rest(`track_now_execution_items?id=eq.${id}&select=*`, { token })
  return Array.isArray(r.body) ? r.body[0] : undefined
}

async function main() {
  const host = new URL(url).hostname
  console.log(`Target (development, opted in): ${host}`)

  const A = await makeUser('a')
  const B = await makeUser('b')

  // Fixtures owned by A (created through the normal RLS-protected REST path).
  const track = (await rest('track_now_tracks', { method: 'POST', token: A.token, prefer: 'return=representation', body: { user_id: A.id, name: 'RPC HTTP check' } })).body?.[0]
  const plan = (await rest('track_now_plans', { method: 'POST', token: A.token, prefer: 'return=representation', body: { user_id: A.id, track_id: track?.id, name: 'RPC HTTP plan' } })).body?.[0]
  const items = (
    await rest('track_now_execution_items', {
      method: 'POST',
      token: A.token,
      prefer: 'return=representation',
      body: [
        { user_id: A.id, plan_id: plan?.id, track_id: track?.id, type: 'task', name: 'HTTP task', target_count: 3, current_count: 0 },
        { user_id: A.id, plan_id: plan?.id, track_id: track?.id, type: 'habit', name: 'HTTP habit', target_count: 3, current_count: 0 },
      ],
    })
  ).body
  const task = Array.isArray(items) ? items.find((i) => i.type === 'task') : undefined
  const habit = Array.isArray(items) ? items.find((i) => i.type === 'habit') : undefined
  if (!task || !habit) throw new Error('Could not create fixtures as user A (check RLS / schema).')

  const step = (token, itemId, delta, date = today, reset = false) =>
    rest(RPC, { method: 'POST', token, body: { p_item_id: itemId, p_delta: delta, p_completed_date: date, p_reset_count: reset } })

  // 1. Anonymous caller.
  let r = await step(undefined, task.id, 1)
  check('anon key only: RPC refused', r.status >= 400 && r.status < 500, `HTTP ${r.status} ${JSON.stringify(r.body)}`)
  check('anon attempt left the item unchanged', (await itemOf(A.token, task.id))?.current_count === 0)

  // 2. Cross-tenant caller.
  r = await step(B.token, task.id, 1)
  check('user B on user A item: refused with 42501', r.status >= 400 && r.body?.code === '42501', `HTTP ${r.status} ${JSON.stringify(r.body)}`)
  check('cross-tenant attempt left the item unchanged', (await itemOf(A.token, task.id))?.current_count === 0)

  // 3. Old vulnerable signature.
  r = await rest(RPC, { method: 'POST', token: B.token, body: { p_item_id: task.id, p_delta: 1, p_user_id: A.id, p_completed_date: today } })
  check('old payload with p_user_id: PGRST202 (function not found)', r.body?.code === 'PGRST202', `HTTP ${r.status} ${JSON.stringify(r.body)}`)

  // 4. Owner operations.
  r = await step(A.token, task.id, 1)
  check('owner increment works', r.status === 200 && r.body?.current_count === 1, `HTTP ${r.status} ${JSON.stringify(r.body)}`)
  await step(A.token, task.id, 1)
  r = await step(A.token, task.id, 1)
  const completions = (await rest(`track_now_item_completions?item_id=eq.${task.id}&select=completed_date`, { token: A.token })).body
  check('reaching target marks done and logs one completion', r.body?.status === 'done' && Array.isArray(completions) && completions.length === 1)
  r = await step(A.token, task.id, -1)
  const after = (await rest(`track_now_item_completions?item_id=eq.${task.id}&select=completed_date`, { token: A.token })).body
  check('decrement below target reverts status and removes the completion', r.body?.status === 'todo' && Array.isArray(after) && after.length === 0)
  r = await step(A.token, task.id, -50)
  check('counter floors at zero', r.body?.current_count === 0)
  r = await step(A.token, task.id, 0)
  check('zero delta rejected', r.status >= 400)

  // 5. RLS read isolation.
  r = await rest(`track_now_execution_items?user_id=eq.${A.id}&select=id`, { token: B.token })
  check('user B cannot read user A items (RLS)', Array.isArray(r.body) && r.body.length === 0)

  // 6. Habit daily counter (only when 20261013000000 is applied).
  const habitRow = await itemOf(A.token, habit.id)
  if (habitRow && Object.prototype.hasOwnProperty.call(habitRow, 'count_date')) {
    // Simulate: 2/3 yesterday, then renamed today (updated_at = today).
    await rest(`track_now_execution_items?id=eq.${habit.id}`, { method: 'PATCH', token: A.token, body: { current_count: 2, count_date: yesterday } })
    await rest(`track_now_execution_items?id=eq.${habit.id}`, { method: 'PATCH', token: A.token, body: { name: 'HTTP habit renamed' } })
    r = await step(A.token, habit.id, 1, today, false)
    check('habit renamed on a new day restarts its counter (1/3)', r.body?.current_count === 1 && r.body?.count_date === today, JSON.stringify(r.body))
    r = await step(A.token, habit.id, 1, yesterday, false)
    check('request for an older day is rejected (22023)', r.status >= 400 && r.body?.code === '22023', `HTTP ${r.status} ${JSON.stringify(r.body)}`)
    check('stale-day request left today unchanged', (await itemOf(A.token, habit.id))?.current_count === 1)
  } else {
    console.log('SKIP: count_date column not present (20261013000000 not applied on this project).')
  }
}

main()
  .catch((err) => {
    check('harness', false, err instanceof Error ? err.message : String(err))
  })
  .finally(async () => {
    // Deleting the auth users cascades to every track_now_* row they own.
    for (const id of createdUserIds) {
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) console.error(`Cleanup failed for test user ${id}: ${error.message}`)
    }
    const failed = results.filter((r) => !r.ok).length
    console.log(`\n${results.length - failed}/${results.length} checks passed; ${createdUserIds.length} test user(s) removed.`)
    process.exit(failed ? 1 : 0)
  })

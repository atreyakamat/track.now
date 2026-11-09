#!/usr/bin/env node
/**
 * Instant ticks in the PHONE app (apps/mobile), checked without a phone:
 *
 *   1. exports the Expo app for the web with a FAKE Supabase project (scripts/lib/e2eMock.cjs)
 *      and refuses to continue if the bundle references any other project;
 *   2. serves that export locally and opens it in headless Chrome at a phone viewport,
 *      in a throw-away profile;
 *   3. answers every Supabase request itself, deliberately slowly (WRITE_LATENCY_MS per write).
 *
 * It proves the phone app's own code path (its hook, memoised cards and press feedback
 * component) shows a tick before the save finishes, survives rapid taps, and rolls back a
 * failed save. It runs the React Native code through react-native-web, so it does NOT prove
 * frame rate, haptics or touch handling on a real device.
 *
 * Usage: node scripts/verify_phone_ticks_e2e.cjs
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { spawn, spawnSync } = require('node:child_process')
const { MOCK_REF, MOCK_URL, MOCK_ANON_KEY, AUTH_STORAGE_KEY } = require('./lib/e2eMock.cjs')

const ROOT = path.resolve(__dirname, '..')
const MOBILE = path.join(ROOT, 'apps', 'mobile')
const PORT = 5198
const CDP_PORT = 9335
const WRITE_LATENCY_MS = 900
const CHROME =
  process.env.CHROME_PATH ||
  ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p))
if (!CHROME) {
  console.error('Chrome not found; set CHROME_PATH.')
  process.exit(1)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function assert(cond, message) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`)
  console.log(`  ✓ ${message}`)
}

// --------------------------------------------------------------------------- made-up data
const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString()
const USER = '0a000000-0000-4000-8000-000000000001'
const TRACK = '10000000-0000-4000-8000-000000000001'
const PLAN = '20000000-0000-4000-8000-000000000001'
const ids = { stretch: '30000000-0000-4000-8000-000000000001', read: '30000000-0000-4000-8000-000000000002', water: '30000000-0000-4000-8000-000000000003', flaky: '30000000-0000-4000-8000-000000000004' }
const habit = (id, name, extra = {}) => ({
  id, plan_id: PLAN, track_id: TRACK, user_id: USER, type: 'habit', name, description: null, status: 'todo', priority: 'medium',
  due_date: null, start_date: null, target_count: 1, current_count: 0, count_date: null, unit: null, checklist_entries: null,
  position: 0, metadata: {}, created_at: iso(-7), updated_at: iso(-1),
  track_now_item_schedules: [{ id: id.replace(/^3/, '4'), item_id: id, user_id: USER, frequency: 'daily', days_of_week: [0, 1, 2, 3, 4, 5, 6], time_of_day: 'anytime', reminder_time: null, times_per_week: null, created_at: iso(-7) }],
  ...extra,
})
const profile = { id: USER, email: 'alex@example.test', full_name: 'Alex Rivera', display_name: 'Alex', avatar_url: null, theme_preference: 'dark', created_at: iso(-30), updated_at: iso(-1) }
const DB = {
  track_now_profiles: [profile],
  track_now_tracks: [{ id: TRACK, user_id: USER, name: 'Health', icon: 'Dumbbell', color: '#22c55e', description: null, status: 'active', created_at: iso(-30), updated_at: iso(-1) }],
  track_now_plans: [{ id: PLAN, user_id: USER, track_id: TRACK, name: 'Daily basics', description: null, status: 'active', plan_kind: 'ongoing', start_date: null, end_date: null, arc_name: null, outcome: null, success_criteria: null, created_at: iso(-30), updated_at: iso(-1) }],
  track_now_execution_items: [habit(ids.stretch, 'Morning Stretch'), habit(ids.read, 'Read ten pages'), habit(ids.water, 'Drink water', { target_count: 5, unit: 'glasses' }), habit(ids.flaky, 'Flaky habit')],
  track_now_item_completions: [],
}
const authUser = { id: USER, aud: 'authenticated', role: 'authenticated', email: profile.email, email_confirmed_at: iso(-30), app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Alex', full_name: 'Alex Rivera' }, created_at: iso(-30), updated_at: iso(-1) }
const session = { access_token: 'phone-ticks-mock-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'phone-ticks-mock-refresh', user: authUser }
const state = { writesStarted: 0, writesFinished: 0, failItemId: null }
const completedToday = (id) => DB.track_now_item_completions.some((c) => c.item_id === id && c.completed_date === TODAY)
const setCompleted = (id, done) => {
  DB.track_now_item_completions = DB.track_now_item_completions.filter((c) => !(c.item_id === id && c.completed_date === TODAY))
  if (done) DB.track_now_item_completions.push({ id: `c-${id}`, item_id: id, user_id: USER, completed_date: TODAY, notes: null, created_at: new Date().toISOString() })
}

// --------------------------------------------------------------------------- PostgREST stand-in
function applyFilters(rows, params) {
  let out = rows
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue
    const m = /^(eq|neq|gte|lte|gt|lt|in|is)\.(.*)$/s.exec(raw)
    if (!m) continue
    const [, op, value] = m
    const val = (r) => (r[key] === null || r[key] === undefined ? null : String(r[key]))
    if (op === 'eq') out = out.filter((r) => val(r) === value)
    else if (op === 'neq') out = out.filter((r) => val(r) !== value)
    else if (op === 'gte') out = out.filter((r) => val(r) !== null && val(r) >= value)
    else if (op === 'lte') out = out.filter((r) => val(r) !== null && val(r) <= value)
    else if (op === 'gt') out = out.filter((r) => val(r) !== null && val(r) > value)
    else if (op === 'lt') out = out.filter((r) => val(r) !== null && val(r) < value)
    else if (op === 'is') out = out.filter((r) => (value === 'null' ? r[key] === null || r[key] === undefined : String(r[key]) === value))
    else if (op === 'in') {
      const set = new Set(value.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, '')))
      out = out.filter((r) => set.has(val(r)))
    }
  }
  return out
}

async function answer(request) {
  const url = new URL(request.url)
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS,HEAD', 'Access-Control-Expose-Headers': 'Content-Range' }
  const json = (body, status = 200, extra = {}) => ({ status, headers: { ...cors, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) })
  if (request.method === 'OPTIONS') return { status: 204, headers: cors, body: '' }
  if (url.pathname.startsWith('/auth/v1/user')) return json(authUser)
  if (url.pathname.startsWith('/auth/v1/token')) return json(session)
  if (url.pathname.startsWith('/auth/v1/')) return json({})
  if (!url.pathname.startsWith('/rest/v1/')) return json({})

  const accept = String(request.headers.Accept || request.headers.accept || '')
  const single = accept.includes('vnd.pgrst.object')
  const payload = request.postData ? JSON.parse(request.postData) : {}
  const isWrite = request.method !== 'GET' && request.method !== 'HEAD'
  if (isWrite) {
    state.writesStarted += 1
    await sleep(WRITE_LATENCY_MS)
  }
  try {
    if (url.pathname === '/rest/v1/rpc/track_now_increment_item_count') {
      const row = DB.track_now_execution_items.find((i) => i.id === payload.p_item_id)
      if (!row) return json({ message: 'Item not found' }, 404)
      const stale = row.count_date !== payload.p_completed_date && !completedToday(row.id)
      row.current_count = Math.max(0, (stale ? 0 : row.current_count) + payload.p_delta)
      row.count_date = payload.p_completed_date
      row.status = row.current_count >= row.target_count ? 'done' : 'todo'
      row.updated_at = new Date().toISOString()
      setCompleted(row.id, row.status === 'done')
      return json(row)
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json({ code: 'PGRST202', message: 'Could not find the function' }, 404)

    const table = url.pathname.slice('/rest/v1/'.length)
    if (!(table in DB)) {
      // Tables this check does not model (telemetry, synced state…): behave as "not created".
      return isWrite ? json({ code: 'PGRST205', message: 'Could not find the table in the schema cache' }, 404) : json([])
    }
    if (table === 'track_now_item_completions' && request.method === 'POST') {
      // The app sends a duplicate-safe upsert on (item_id, completed_date).
      if (!DB[table].some((c) => c.item_id === payload.item_id && c.completed_date === payload.completed_date)) {
        DB[table].push({ id: `c-${payload.item_id}-${payload.completed_date}`, user_id: USER, notes: null, created_at: new Date().toISOString(), ...payload })
      }
      return json([], 201)
    }
    const rows = applyFilters(DB[table], url.searchParams)
    if (request.method === 'DELETE') {
      DB[table] = DB[table].filter((r) => !rows.includes(r))
      return json(single ? (rows[0] ?? {}) : [])
    }
    if (request.method === 'PATCH') {
      if (table === 'track_now_execution_items' && rows.some((r) => r.id === state.failItemId)) return json({ message: 'simulated outage', code: 'XX000' }, 500)
      rows.forEach((r) => Object.assign(r, payload, { updated_at: new Date().toISOString() }))
      if (single) return rows.length ? json(rows[0]) : json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406)
      return json(rows)
    }
    if (single) return rows.length ? json(rows[0]) : json({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406)
    return json(rows, 200, { 'Content-Range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` })
  } finally {
    if (isWrite) state.writesFinished += 1
  }
}

// --------------------------------------------------------------------------- build, serve, drive
class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 1
    this.pending = new Map()
    this.handlers = new Map()
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve()
      this.ws.onerror = (e) => reject(e)
      this.ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data)
        if (m.id && this.pending.has(m.id)) {
          const { resolve: res, reject: rej } = this.pending.get(m.id)
          this.pending.delete(m.id)
          m.error ? rej(new Error(m.error.message)) : res(m.result)
        } else if (m.method && this.handlers.has(m.method)) this.handlers.get(m.method)(m.params)
      }
    })
  }
  on(method, fn) {
    this.handlers.set(method, fn)
  }
  send(method, params = {}) {
    const id = this.id++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(`Eval exception: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`)
    return r.result ? r.result.value : undefined
  }
}

function exportWeb(dist) {
  console.log('Exporting the phone app for the web with the mock project (takes a minute or two)…')
  const env = { ...process.env, EXPO_PUBLIC_SUPABASE_URL: MOCK_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: MOCK_ANON_KEY, CI: '1' }
  delete env.SUPABASE_SERVICE_ROLE_KEY
  const r = spawnSync('npx', ['expo', 'export', '-p', 'web', '--output-dir', dist], { cwd: MOBILE, env, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' })
  if (r.status !== 0) throw new Error('expo export failed')
  // Structural guard: the bundle must reference the mock project and no other.
  let bundle = ''
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name)
      if (f.isDirectory()) walk(p)
      else if (f.name.endsWith('.js')) bundle += fs.readFileSync(p, 'utf8')
    }
  }
  walk(dist)
  const refs = new Set(Array.from(bundle.matchAll(/https:\/\/([a-z0-9]{20})\.supabase\.(?:co|in)/g), (m) => m[1]))
  if (!bundle.includes(MOCK_URL) || [...refs].some((r2) => r2 !== MOCK_REF)) throw new Error('REFUSED: the export references a real Supabase project.')
}

function serve(dist) {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
  const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = path.join(dist, clean)
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)))
}

async function main() {
  console.log('================================================================')
  console.log('TRACK.NOW PHONE APP: INSTANT TICKS ON A SLOW NETWORK (mocked, in a browser)')
  console.log('================================================================')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tracknow-phone-ticks-'))
  const dist = path.join(tmp, 'dist')
  exportWeb(dist)
  const server = await serve(dist)
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(tmp, 'chrome')}`,
    // DNS block: even if interception failed, the mock host resolves nowhere useful.
    '--host-resolver-rules=MAP *.supabase.co 127.0.0.1, MAP *.supabase.in 127.0.0.1', '--window-size=500,1000', 'about:blank'], { stdio: 'ignore' })
  let cdp
  try {
    let target
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(250)
      try {
        target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()).find((t) => t.type === 'page')
      } catch {
        /* not up yet */
      }
    }
    if (!target) throw new Error('Chrome did not start')
    cdp = new Cdp(target.webSocketDebuggerUrl)
    await cdp.connect()
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    const errors = []
    cdp.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'exception'))
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*supabase.co*' }, { urlPattern: '*supabase.in*' }] })
    cdp.on('Fetch.requestPaused', (evt) => {
      answer(evt.request)
        .then((res) =>
          cdp.send('Fetch.fulfillRequest', {
            requestId: evt.requestId,
            responseCode: res.status,
            responseHeaders: Object.entries(res.headers).map(([name, value]) => ({ name, value: String(value) })),
            body: Buffer.from(res.body).toString('base64'),
          }),
        )
        // Fail closed: an intercepted Supabase request must never reach the network.
        .catch(() => cdp.send('Fetch.failRequest', { requestId: evt.requestId, errorReason: 'BlockedByClient' }).catch(() => undefined))
    })
    // Signed-in made-up account, onboarding already seen.
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => { try {
        localStorage.setItem(${JSON.stringify(AUTH_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(session))});
        localStorage.setItem('tracknow_onboarded', '1');
        localStorage.setItem('tracknow_onboarding_tour_${USER}', '1');
        localStorage.setItem('tracknow_onboarding_focus_${USER}', '1');
        localStorage.setItem('tracknow_onboarding_quests_dismissed_${USER}', '1');
        localStorage.setItem('tracknow_onboarding_level_${USER}', '9');
      } catch (e) {} })()`,
    })
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 2, mobile: true })

    const tick = (name) => `document.querySelector('[role="checkbox"][aria-label="Mark ${name} done"], [role="checkbox"][aria-label="Mark ${name} incomplete"]')`
    // The control's label says which way the next tap goes ("Mark X done" / "Mark X incomplete");
    // the web build of the phone app does not emit aria-checked, so the label is the signal.
    const checked = (name) => cdp.eval(`(() => { const b = ${tick(name)}; return b ? b.getAttribute('aria-label') === 'Mark ${name} incomplete' : null })()`)
    const tap = (selector, times = 1) => cdp.eval(`(async () => {
      const t0 = performance.now();
      for (let i = 0; i < ${times}; i++) ${selector}.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return Math.round(performance.now() - t0);
    })()`)
    const waitForWrites = async () => {
      for (let i = 0; i < 200; i++) {
        if (state.writesStarted === state.writesFinished) {
          await sleep(350)
          if (state.writesStarted === state.writesFinished) return
        }
        await sleep(100)
      }
      throw new Error('writes never settled')
    }
    const open = async () => {
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` })
      let seen = null
      for (let i = 0; i < 80 && seen === null; i++) {
        await sleep(250)
        seen = await checked('Morning Stretch').catch(() => null)
      }
      return seen
    }

    console.log('\n[1/5] Opening Today in the phone app…')
    const first = await open()
    if (first === null) console.log(`    page text: ${JSON.stringify(String(await cdp.eval('document.body.innerText')).slice(0, 300))}`)
    assert(first === false, 'Today shows "Morning Stretch", un-ticked')
    await sleep(800)
    await waitForWrites()

    console.log(`\n[2/5] One tap, while every write takes ${WRITE_LATENCY_MS} ms…`)
    let finished = state.writesFinished
    let ms = await tap(tick('Morning Stretch'))
    assert((await checked('Morning Stretch')) === true, `the tick is on screen ${ms} ms after the tap`)
    assert(ms < 300, `that is under the 300 ms limit`)
    assert(state.writesFinished === finished, 'no write had finished yet: the screen did not wait for the server')
    assert((await cdp.eval(`${tick('Morning Stretch')}.getAttribute('aria-disabled')`)) !== 'true', 'the tick stays enabled while saving')
    await waitForWrites()
    assert(completedToday(ids.stretch) && DB.track_now_item_completions.filter((c) => c.item_id === ids.stretch).length === 1, 'the backend recorded exactly one completion')
    await sleep(900)
    assert((await checked('Morning Stretch')) === true, 'still ticked after the save and after it moved to Completed')

    console.log('\n[3/5] Tick, un-tick, tick in one burst…')
    ms = await tap(tick('Read ten pages'), 3)
    assert((await checked('Read ten pages')) === true, `three taps end ticked (shown after ${ms} ms)`)
    await waitForWrites()
    await sleep(900)
    assert((await checked('Read ten pages')) === true, 'still ticked after all three saves finished')
    assert(completedToday(ids.read) && DB.track_now_item_completions.filter((c) => c.item_id === ids.read).length === 1, 'the backend ends completed, with one row')

    console.log('\n[4/5] Three quick +1 taps on a counter…')
    const plus = `document.querySelector('[aria-label="Increase Drink water count"]')`
    ms = await tap(plus, 3)
    const counterText = () => cdp.eval(`${plus}.parentElement.innerText.replace(/\\s+/g, ' ').trim()`)
    const shown = await counterText()
    console.log(`    after ${ms} ms: "${shown}"`)
    assert(/3\s*\/\s*5/.test(shown), 'the counter shows 3/5 at once')
    await waitForWrites()
    assert(DB.track_now_execution_items.find((i) => i.id === ids.water).current_count === 3, 'the backend counted exactly 3')
    assert(/3\s*\/\s*5/.test(await counterText()), 'and the screen still shows 3/5 after the saves')

    console.log('\n[5/5] A save that fails…')
    state.failItemId = ids.flaky
    await tap(tick('Flaky habit'))
    assert((await checked('Flaky habit')) === true, 'the tick shows at once, as always')
    await waitForWrites()
    await sleep(1500)
    await waitForWrites()
    const body = String(await cdp.eval('document.body.innerText'))
    assert(/Could not update/i.test(body), 'the user is told the save failed')
    assert((await checked('Flaky habit')) === false, 'the tick is rolled back to what the server has')
    assert(!completedToday(ids.flaky), 'the backend has no completion for it')
    state.failItemId = null

    const fatal = errors.filter((e) => !/ResizeObserver/.test(e))
    if (fatal.length) console.log(`    note: ${fatal.length} page exception(s), first: ${String(fatal[0]).split('\n')[0]}`)
    assert(fatal.length === 0, 'no uncaught exceptions on the page')
    console.log('\nALL PHONE APP INSTANT TICK CHECKS PASSED')
  } finally {
    try {
      if (cdp) cdp.ws.close()
    } catch {
      /* ignore */
    }
    chrome.kill()
    server.close()
    await sleep(400)
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      /* the temp directory is cleaned up by the OS later */
    }
  }
}

main().catch((err) => {
  console.error('\nPHONE APP INSTANT TICK CHECK FAILED:', err.message)
  process.exit(1)
})

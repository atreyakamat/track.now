#!/usr/bin/env node
/**
 * Captures Play Store screenshots of the PHONE app (apps/mobile), safely:
 *
 *   1. exports the Expo app for the web with a FAKE Supabase project (scripts/lib/e2eMock.cjs),
 *      and refuses to continue if the bundle references any other project;
 *   2. serves that export locally and opens it in headless Chrome at a phone viewport;
 *   3. answers every Supabase request itself from made-up demo data (nothing leaves the machine);
 *   4. saves raw captures and composes captioned 1080×1920 store screenshots, plus the
 *      1024×500 feature graphic.
 *
 * Output: "Playstore readiness/screenshots/{raw,phone}" and "Playstore readiness/graphics".
 * Usage:  node scripts/render_store_screenshots.cjs
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { spawn, spawnSync } = require('node:child_process')
const { MOCK_REF, MOCK_URL, MOCK_ANON_KEY, AUTH_STORAGE_KEY } = require('./lib/e2eMock.cjs')

const ROOT = path.resolve(__dirname, '..')
const MOBILE = path.join(ROOT, 'apps', 'mobile')
const OUT = path.join(ROOT, 'Playstore readiness')
const RAW = path.join(OUT, 'screenshots', 'raw')
const PHONE = path.join(OUT, 'screenshots', 'phone')
const GRAPHICS = path.join(OUT, 'graphics')
const PORT = 5197
const CDP_PORT = 9334
const VIEW = { width: 390, height: 780, dpr: 2 }
const CHROME =
  process.env.CHROME_PATH ||
  ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p))
if (!CHROME) {
  console.error('Chrome not found; set CHROME_PATH.')
  process.exit(1)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Demo data (made up; dates are relative to today so the screens always look current)
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const day = (offset) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return fmt(d)
}
const iso = (offset) => new Date(Date.now() + offset * 86400000).toISOString()
const USER = '0a000000-0000-4000-8000-000000000001'
const uid = (kind, n) => `${kind}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ARC = 'Winter Arc'
const START = -20 // the Arc began 20 days ago
const END = 69

const tracks = [
  { id: uid('1', 1), name: 'Health', icon: 'Dumbbell', color: '#22c55e', description: 'Gym, cardio, sleep and routines.' },
  { id: uid('1', 2), name: 'Growth', icon: 'BookOpen', color: '#8b5cf6', description: 'Learning and projects.' },
  { id: uid('1', 3), name: 'Money', icon: 'Wallet', color: '#f59e0b', description: 'Income, spending, savings.' },
  { id: uid('1', 4), name: 'Home', icon: 'Home', color: '#14b8a6', description: 'Laundry, room and shopping.' },
].map((t) => ({ ...t, user_id: USER, status: 'active', template_type: 'custom', position: 0, created_at: iso(START - 2), updated_at: iso(-1) }))

const plan = (n, track, name, extra = {}) => ({
  id: uid('2', n), track_id: tracks[track].id, user_id: USER, name, description: null, status: 'active',
  start_date: day(START), end_date: day(END), plan_kind: 'time_bound', arc_name: ARC, outcome: null, success_criteria: null,
  completed_at: null, result_notes: null, lessons_learned: null, next_decision: null, position: 0, created_at: iso(START - 1), updated_at: iso(-1), ...extra,
})
const plans = [
  plan(1, 0, 'Winter Arc · Fitness', { outcome: 'Four gym days a week plus weekend cardio.', success_criteria: '4 gym sessions in most weeks\nOne cardio session at the weekend' }),
  plan(2, 0, 'Morning & night routines', { plan_kind: 'ongoing', end_date: null, arc_name: null }),
  plan(3, 1, 'Winter Arc · Learning', { outcome: 'Finish one practical project.' }),
  plan(4, 2, 'Winter Arc · Finances', { outcome: 'Weekly reviews and tracked spending.' }),
  plan(5, 3, 'Household routine', { plan_kind: 'ongoing', end_date: null, arc_name: null }),
]

let itemSeq = 0
const items = []
const schedules = []
function item(planIdx, type, name, extra = {}, sched = null) {
  const id = uid('3', ++itemSeq)
  const p = plans[planIdx]
  const row = {
    id, plan_id: p.id, track_id: p.track_id, user_id: USER, type, name, description: null, status: 'todo', priority: 'medium',
    due_date: null, start_date: null, target_count: 1, current_count: 0, count_date: null, unit: null, checklist_entries: null,
    position: itemSeq, metadata: {}, created_at: iso(START - 1), updated_at: iso(-1), ...extra,
  }
  const s = type === 'habit' ? { id: uid('4', itemSeq), item_id: id, user_id: USER, frequency: 'daily', days_of_week: [0, 1, 2, 3, 4, 5, 6], time_of_day: 'anytime', reminder_time: null, times_per_week: null, created_at: iso(START - 1), ...(sched || {}) } : null
  if (s) schedules.push(s)
  row.track_now_item_schedules = s ? [s] : []
  items.push(row)
  return row
}
const steps = (labels, doneCount = 0) => labels.map((label, i) => ({ id: `s${i}`, label, done: i < doneCount }))

const gym = item(0, 'habit', 'Gym session', { priority: 'high' }, { frequency: 'weekly', days_of_week: [1, 2, 4, 5], time_of_day: 'morning', reminder_time: '06:30' })
const cardio = item(0, 'habit', 'Weekend cardio', {}, { frequency: 'weekly', days_of_week: [6, 0], time_of_day: 'morning' })
item(0, 'milestone', 'Four steady weeks', { due_date: day(8) })
item(0, 'milestone', 'Gym routine started', { due_date: day(START + 7), status: 'done', current_count: 1 })
const morning = item(1, 'habit', 'Morning routine', { priority: 'high', target_count: 5, current_count: 3, count_date: day(0), checklist_entries: steps(['Drink water', 'Brush teeth', 'Stretch for 5 minutes', 'Make the bed', 'Look at Today'], 3) }, { time_of_day: 'morning', reminder_time: '06:00' })
const night = item(1, 'habit', 'Night routine', { target_count: 4, checklist_entries: steps(['Tidy the room', 'Prepare tomorrow’s clothes', 'Check tomorrow’s plan', 'Phone away, wind down']) }, { time_of_day: 'evening', reminder_time: '21:00' })
const learn = item(2, 'habit', 'Learning session (45 min)', {}, { frequency: 'weekly', days_of_week: [1, 3], time_of_day: 'evening', reminder_time: '19:00' })
const practice = item(2, 'habit', 'Practice project', {}, { frequency: 'weekly', days_of_week: null, times_per_week: 3 })
item(2, 'task', 'Choose the project', { due_date: day(-6), status: 'done', current_count: 1, priority: 'high' })
item(2, 'checklist', 'Project plan', { due_date: day(4), checklist_entries: steps(['Define the result to show', 'Set up the tools', 'First working version', 'Improve', 'Write it up'], 2) })
item(2, 'milestone', 'Project working', { due_date: day(30) })
const spend = item(3, 'habit', 'Log today’s spending', {}, { time_of_day: 'evening', reminder_time: '20:30' })
item(3, 'habit', 'Weekly finance review', {}, { frequency: 'weekly', days_of_week: [0], time_of_day: 'evening' })
item(3, 'task', 'Automate a savings transfer', { due_date: day(0), priority: 'high' })
item(3, 'task', 'Cancel unused subscriptions', { due_date: day(-1) })
const laundry = item(4, 'habit', 'Laundry', {}, { frequency: 'weekly', days_of_week: [2, 5], time_of_day: 'evening' })
item(4, 'habit', 'Weekly shop', {}, { frequency: 'weekly', days_of_week: [6], time_of_day: 'afternoon' })
item(4, 'task', 'Book the plumber', { due_date: day(2) })

// Completions: a believable three weeks, deterministic (no Math.random).
const completions = []
let cSeq = 0
const complete = (it, offset) => completions.push({ id: uid('5', ++cSeq), item_id: it.id, user_id: USER, completed_date: day(offset), completed_at: iso(offset), created_at: iso(offset) })
const scheduled = (it, offset) => {
  const s = it.track_now_item_schedules[0]
  if (!s || s.times_per_week) return false
  const dow = new Date(`${day(offset)}T12:00:00`).getDay()
  return !s.days_of_week || s.days_of_week.includes(dow)
}
const adherence = new Map([[gym, 6], [cardio, 4], [morning, 9], [night, 5], [learn, 5], [spend, 7], [laundry, 9]])
for (const [it, keepOutOf10] of adherence) {
  let n = 0
  for (let o = START + 1; o <= -1; o++) {
    if (!scheduled(it, o)) continue
    n++
    // Miss a deterministic share of days; the most recent week is the strongest.
    if ((n * 7 + itemSeq) % 10 < keepOutOf10 || o >= -4) complete(it, o)
  }
}
for (const o of [-13, -11, -9, -6, -4, -2]) complete(practice, o)
complete(gym, 0)
complete(spend, 0)
gym.current_count = 1
gym.count_date = day(0)
spend.current_count = 1
spend.count_date = day(0)
for (const it of items) if (it.status === 'done' && it.type !== 'habit') complete(it, it.type === 'milestone' ? START + 7 : -6)

const profile = { id: USER, email: 'alex@example.com', full_name: 'Alex Rivera', display_name: 'Alex', avatar_url: null, timezone: 'UTC', created_at: iso(START - 3), updated_at: iso(-1) }
const DB = {
  track_now_profiles: [profile],
  track_now_tracks: tracks,
  track_now_plans: plans,
  track_now_execution_items: items,
  track_now_item_schedules: schedules,
  track_now_item_completions: completions,
  track_now_track_templates: [],
  track_now_plan_shares: [],
}
const authUser = { id: USER, aud: 'authenticated', role: 'authenticated', email: profile.email, email_confirmed_at: iso(-30), app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Alex', full_name: 'Alex Rivera' }, created_at: iso(-30), updated_at: iso(-1) }
const session = { access_token: 'store-shots-mock-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'store-shots-mock-refresh', user: authUser }

// ---------------------------------------------------------------------------
// A small PostgREST stand-in: filters, single-object responses, CORS.
// ---------------------------------------------------------------------------
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
  const order = params.get('order')
  if (order) {
    const [col, dir] = order.split(',')[0].split('.')
    out = [...out].sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (dir === 'desc' ? -1 : 1))
  }
  return out
}

function answer(request) {
  const url = new URL(request.url)
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS,HEAD', 'Access-Control-Expose-Headers': 'Content-Range' }
  const json = (body, status = 200, extra = {}) => ({ status, headers: { ...cors, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) })
  if (request.method === 'OPTIONS') return { status: 204, headers: cors, body: '' }
  if (url.pathname.startsWith('/auth/v1/user')) return json(authUser)
  if (url.pathname.startsWith('/auth/v1/token')) return json(session)
  if (url.pathname.startsWith('/auth/v1/')) return json({})
  if (url.pathname.startsWith('/rest/v1/rpc/')) return json(null)
  if (url.pathname.startsWith('/rest/v1/')) {
    const table = url.pathname.slice('/rest/v1/'.length)
    const rows = applyFilters(DB[table] ?? [], url.searchParams)
    const accept = String(request.headers.Accept || request.headers.accept || '')
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(accept.includes('vnd.pgrst.object') ? (rows[0] ?? {}) : [], 200)
    if (accept.includes('vnd.pgrst.object')) return rows.length ? json(rows[0]) : json({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406)
    return json(rows, 200, { 'Content-Range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` })
  }
  return json({})
}

// ---------------------------------------------------------------------------
// Build, serve, drive
// ---------------------------------------------------------------------------
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
    return r.result ? r.result.value : undefined
  }
}

function exportWeb(dist) {
  console.log('Exporting the phone app for the web with the mock project…')
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
  if (!bundle.includes(MOCK_URL) || [...refs].some((r2) => r2 !== MOCK_REF)) {
    throw new Error('REFUSED: the export references a real Supabase project.')
  }
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

const SHOTS = [
  { file: '01-today', path: '/', caption: 'Everything due today, across your whole life', sub: 'Focus, routines with steps, and honest progress', scheme: 'dark' },
  { file: '02-arc', path: `/arc/${encodeURIComponent(ARC.toLowerCase())}`, caption: '90-day Arcs with a purpose', sub: 'Day 21 of 90. Plans from every area, one push', scheme: 'dark' },
  { file: '03-insights', path: '/analytics', caption: 'Honest numbers. No fake streaks', sub: 'Levels and points come only from what you complete', scheme: 'light' },
  { file: '04-retention', path: '/analytics', caption: 'See what you are sticking with', sub: 'Kept, slipping or dropped, week by week', scheme: 'dark', scrollTo: 'Retention' },
  { file: '05-plan', path: `/plan/${plans[0].id}`, caption: 'Plans that know where they are going', sub: 'Outcome, milestones, habits and a review at the end', scheme: 'light' },
  { file: '06-calendar', path: '/calendar', caption: 'Plan my week in one tap', sub: 'Move a task to tomorrow or next week', scheme: 'dark' },
  { file: '07-library', path: '/library', caption: 'Start from a ready-made setup', sub: 'Winter Arc, routines, a first half-marathon and more', scheme: 'light' },
  { file: '08-tracks', path: '/tracks', caption: 'Your life in Tracks', sub: 'Health, Growth, Money, Home. Anything you care about', scheme: 'dark' },
]

const markSvg = fs.readFileSync(path.join(ROOT, 'brand', 'tracknow-mark.svg'), 'utf8')
const markData = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString('base64')}`
const framePage = (shot, pngBase64) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;overflow:hidden;font-family:"Segoe UI",Inter,system-ui,sans-serif}
.c{position:absolute;left:0;top:0;width:1080px;height:1920px;background:linear-gradient(160deg,#232220,#0c0c0b);overflow:hidden;color:#f4efe6}
.glow{position:absolute;width:1100px;height:1100px;left:-300px;top:-520px;border-radius:50%;background:radial-gradient(closest-side,rgba(200,241,105,0.20),transparent)}
.head{position:absolute;left:72px;right:72px;top:70px}
.brand{display:flex;align-items:center;gap:14px;font-size:30px;font-weight:700;letter-spacing:-0.01em;color:#c8f169}
.brand img{width:44px;height:44px;border-radius:11px}
h1{margin:26px 0 0;font-size:66px;line-height:1.06;letter-spacing:-0.03em;font-weight:800}
p{margin:16px 0 0;font-size:32px;line-height:1.3;color:#b9b4a8}
.phone{position:absolute;left:50%;transform:translateX(-50%);top:430px;width:780px;height:1560px;border-radius:64px;padding:14px;box-sizing:border-box;background:#0a0a09;border:2px solid #3a3936;box-shadow:0 40px 120px rgba(0,0,0,0.6)}
.phone img{width:100%;height:100%;border-radius:50px;display:block;object-fit:cover;object-position:top}
</style></head><body><div class="c"><div class="glow"></div><div class="head"><div class="brand"><img src="${markData}" alt="">Track.now</div><h1>${shot.caption}</h1><p>${shot.sub}</p></div>
<div class="phone"><img src="data:image/png;base64,${pngBase64}" alt=""></div></div></body></html>`

const featurePage = () => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;overflow:hidden;font-family:"Segoe UI",Inter,system-ui,sans-serif;color:#f4efe6}
.c{position:absolute;left:0;top:0;width:1024px;height:500px;background:linear-gradient(135deg,#232220,#0c0c0b);overflow:hidden}
.glow{position:absolute;width:800px;height:800px;left:-220px;top:-380px;border-radius:50%;background:radial-gradient(closest-side,rgba(200,241,105,0.2),transparent)}
.wrap{position:absolute;inset:0;display:flex;align-items:center;gap:52px;padding:0 72px}
img{width:200px;height:200px;filter:drop-shadow(0 20px 50px rgba(0,0,0,0.6))}
h1{margin:0;font-size:72px;letter-spacing:-0.035em;font-weight:800;line-height:1}
p{margin:14px 0 0;font-size:28px;color:#b9b4a8;line-height:1.3;max-width:560px}
.pill{display:inline-flex;align-items:center;gap:10px;margin-top:26px;padding:8px 16px;border:1px solid #3a3936;border-radius:999px;font-size:17px;letter-spacing:0.14em;color:#c8f169}
.dot{width:9px;height:9px;border-radius:50%;background:#c8f169}
</style></head><body><div class="c"><div class="glow"></div><div class="wrap"><img src="${markData}" alt=""><div><h1>Track.now</h1><p>Plan your life in 90-day Arcs. Honest habit tracking, no fake streaks.</p><div class="pill"><span class="dot"></span>HABITS · ARCS · GOALS</div></div></div></div></body></html>`

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tracknow-store-'))
  const dist = path.join(tmp, 'dist')
  const profileDir = path.join(tmp, 'chrome')
  for (const d of [RAW, PHONE, GRAPHICS]) fs.mkdirSync(d, { recursive: true })
  exportWeb(dist)
  const server = await serve(dist)
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`,
    // DNS block: even if interception failed, the mock host resolves nowhere.
    `--host-resolver-rules=MAP *.supabase.co 127.0.0.1, MAP *.supabase.in 127.0.0.1`, '--window-size=1200,2100', 'about:blank'], { stdio: 'ignore' })
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
      const res = answer(evt.request)
      cdp.send('Fetch.fulfillRequest', {
        requestId: evt.requestId,
        responseCode: res.status,
        responseHeaders: Object.entries(res.headers).map(([name, value]) => ({ name, value: String(value) })),
        body: Buffer.from(res.body).toString('base64'),
      }).catch(() => undefined)
    })
    // Signed-in demo account, onboarding already seen, tour done, quests tucked away.
    const boot = `(() => { try {
      localStorage.setItem(${JSON.stringify(AUTH_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(session))});
      localStorage.setItem('tracknow_onboarded', '1');
      localStorage.setItem('tracknow_onboarding_tour_${USER}', '1');
      localStorage.setItem('tracknow_onboarding_focus_${USER}', '1');
      localStorage.setItem('tracknow_onboarding_quests_dismissed_${USER}', '1');
      localStorage.setItem('tracknow_onboarding_level_${USER}', '9');
      localStorage.setItem('tracknow_focus_${USER}', ${JSON.stringify(JSON.stringify({ date: day(0), ids: [morning.id, items.find((i) => i.name === 'Automate a savings transfer').id] }))});
    } catch (e) {} })()`
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: boot })

    const capture = async (width, height, scale = 1) =>
      (await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale }, captureBeyondViewport: false })).data

    for (const shot of SHOTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.dpr, mobile: true })
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: shot.scheme }] })
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}${shot.path}` })
      // Wait until the screen has real content and has stopped changing.
      let last = -1
      let stable = 0
      for (let i = 0; i < 60 && stable < 3; i++) {
        await sleep(350)
        const len = await cdp.eval(`(() => { const t = document.body ? document.body.innerText : ''; return /Loading|Preparing|Crunching|Starting/.test(t) ? -2 : t.length })()`)
        stable = len > 80 && len === last ? stable + 1 : 0
        last = len
      }
      if (shot.scrollTo) {
        await cdp.eval(`(() => { const el = Array.from(document.querySelectorAll('div')).find((d) => d.children.length === 0 && d.textContent.trim() === ${JSON.stringify(shot.scrollTo)}); if (el) el.scrollIntoView({ block: 'start' }); })()`)
        await sleep(500)
      }
      await sleep(700) // let entrance animations finish
      const raw = await capture(VIEW.width, VIEW.height)
      fs.writeFileSync(path.join(RAW, `${shot.file}.png`), Buffer.from(raw, 'base64'))
      console.log(`captured ${shot.file} (${shot.path})`)
      shot.png = raw
    }
    if (errors.length) console.log(`note: ${errors.length} page exception(s), first: ${String(errors[0]).split('\n')[0]}`)

    // Compose the store screenshots and the feature graphic.
    await cdp.send('Fetch.disable')
    await cdp.send('Emulation.setEmulatedMedia', { features: [] })
    const compose = async (html, width, height, out) => {
      const page = path.join(tmp, `${path.basename(out, '.png')}.html`)
      fs.writeFileSync(page, html)
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      await cdp.send('Page.navigate', { url: `file:///${page.replace(/\\/g, '/')}` })
      await sleep(500)
      fs.writeFileSync(out, Buffer.from(await capture(width, height), 'base64'))
      console.log(`wrote ${path.relative(ROOT, out)}`)
    }
    for (const shot of SHOTS) await compose(framePage(shot, shot.png), 1080, 1920, path.join(PHONE, `${shot.file}.png`))
    await compose(featurePage(), 1024, 500, path.join(GRAPHICS, 'feature-graphic-1024x500.png'))
    console.log('done')
  } finally {
    try {
      cdp?.ws.close()
    } catch {
      /* ignore */
    }
    chrome.kill()
    server.close()
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      /* Chrome may still hold its profile for a moment; leftovers in the temp folder are harmless */
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

// Fail closed: only runs against a bundle built with a fake Supabase project (see scripts/lib/e2eMock.cjs).
const E2E_MOCK = require('./lib/e2eMock.cjs');
E2E_MOCK.assertMockBuild();
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Instant ticks on Today, against a deliberately SLOW mocked backend (every write takes
 * WRITE_LATENCY_MS). Proves that:
 *   1. a tick is on screen within a couple of frames, long before any write has finished;
 *   2. the ticked item stays in its section for a moment, then moves to Completed;
 *   3. tick / un-tick / tick in quick succession ends ticked, and the backend agrees;
 *   4. three quick +1 taps show 3 at once and the backend ends at 3;
 *   5. a failed save is reported and the tick is rolled back to what the server has.
 * Nothing here contacts Supabase: every request is answered by this script.
 */
const WRITE_LATENCY_MS = 900;

function createSpaServer(distDir) {
  return http.createServer((req, res) => {
    const reqPath = req.url.split('?')[0];
    let filePath = path.join(distDir, reqPath);
    if (!path.resolve(filePath).startsWith(path.resolve(distDir) + path.sep)) filePath = path.join(distDir, 'index.html');
    if (filePath.endsWith(path.sep) || reqPath === '/') filePath = path.join(distDir, 'index.html');
    if (!(fs.existsSync(filePath) && fs.statSync(filePath).isFile())) filePath = path.join(distDir, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: ok, reject: bad } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) bad(new Error(msg.error.message));
          else ok(msg.result);
        } else if (msg.method) {
          const handler = this.listeners.get(msg.method);
          if (handler) handler(msg.params);
        }
      };
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, handler) {
    this.listeners.set(method, handler);
  }
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    return res.result ? res.result.value : null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, message) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function run() {
  console.log('================================================================');
  console.log('TRACK.NOW: INSTANT TICKS ON A SLOW NETWORK (mocked browser check)');
  console.log('================================================================');

  const appDist = path.resolve(__dirname, '../apps/app/dist');
  const port = 5179;
  const server = createSpaServer(appDist);
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

  const cdpPort = 9231;
  const tempDir = path.join(os.tmpdir(), `tracknow_ticks_cdp_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    `--user-data-dir=${tempDir}`,
    '--host-resolver-rules=MAP *.supabase.co ~NOTFOUND, MAP *.supabase.in ~NOTFOUND',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,1400',
  ]);

  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const iso = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const USER = 'usr-athlete-1';
  const sched = (itemId) => [{ id: `s-${itemId}`, item_id: itemId, frequency: 'daily', days_of_week: null, time_of_day: 'anytime', created_at: iso }];
  const item = (id, name, over = {}) => ({
    id, plan_id: 'plan-1', user_id: USER, track_id: 'track-1', name, description: null, type: 'habit', status: 'todo', priority: 'medium',
    due_date: null, target_count: 1, current_count: 0, count_date: null, unit: null, created_at: weekAgo, updated_at: weekAgo,
    track_now_item_schedules: sched(id), ...over,
  });

  const state = {
    user: { id: USER, email: 'athlete@tracknow.com', user_metadata: { full_name: 'Marathon Athlete', display_name: 'Marathon Athlete' } },
    track: { id: 'track-1', user_id: USER, name: 'Athletic Excellence', description: null, status: 'active', icon: 'Activity', color: '#c8f169', created_at: iso, updated_at: iso },
    plan: { id: 'plan-1', track_id: 'track-1', user_id: USER, name: 'Half Marathon Arc', description: null, status: 'active', created_at: iso, updated_at: iso },
    items: [
      item('item-stretch', 'Morning Stretch'),
      item('item-read', 'Read ten pages'),
      item('item-water', 'Drink water', { target_count: 5, unit: 'glasses' }),
      item('item-flaky', 'Flaky habit'),
    ],
    completions: [],
    writesStarted: 0,
    writesFinished: 0,
    failItemId: null,
  };
  const completedToday = (id) => state.completions.some((c) => c.item_id === id && c.completed_date === today);
  const setCompleted = (id, done) => {
    state.completions = state.completions.filter((c) => !(c.item_id === id && c.completed_date === today));
    if (done) state.completions.push({ id: `c-${id}-${today}`, item_id: id, user_id: USER, completed_date: today });
  };

  let cdp;
  try {
    let wsUrl = null;
    for (let i = 0; i < 40 && !wsUrl; i++) {
      try {
        const json = await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${cdpPort}/json`, (res) => {
            let data = '';
            res.on('data', (d) => (data += d));
            res.on('end', () => resolve(data));
          }).on('error', reject);
        });
        const page = JSON.parse(json).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) wsUrl = page.webSocketDebuggerUrl;
      } catch {
        /* Chrome is still starting */
      }
      if (!wsUrl) await sleep(200);
    }
    if (!wsUrl) throw new Error('Failed to connect to Chrome debugging endpoint');

    cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*supabase.co/*' }, { urlPattern: '*supabase.in/*' }] });

    const cors = [
      { name: 'Access-Control-Allow-Origin', value: '*' },
      { name: 'Access-Control-Allow-Headers', value: '*' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
    ];

    cdp.on('Fetch.requestPaused', async (evt) => {
      const { requestId, request } = evt;
      try {
        const url = new URL(request.url);
        const p = url.pathname;
        const method = request.method;
        const accept = request.headers['Accept'] || request.headers['accept'] || '';
        const single = accept.includes('application/vnd.pgrst.object+json');
        if (method === 'OPTIONS') {
          return await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: cors, body: Buffer.from('{}').toString('base64') });
        }
        const isWrite = p.includes('/rest/v1/') && method !== 'GET' && method !== 'HEAD';
        if (isWrite) {
          state.writesStarted += 1;
          await sleep(WRITE_LATENCY_MS);
        }

        let status = 200;
        let body = [];
        const eq = (key) => (url.searchParams.get(key) || '').replace(/^eq\./, '');
        const payload = request.postData ? JSON.parse(request.postData) : {};

        if (p.includes('/auth/v1/')) {
          body = { access_token: 'valid-test-jwt-token', token_type: 'bearer', expires_in: 3600, refresh_token: 'valid-test-refresh', user: state.user };
        } else if (p.includes('/rest/v1/track_now_profiles')) {
          const profile = { id: USER, display_name: 'Marathon Athlete', full_name: 'Marathon Athlete', email: state.user.email, avatar_url: null, theme_preference: 'dark', created_at: iso, updated_at: iso };
          body = single ? profile : [profile];
        } else if (p.includes('/rest/v1/track_now_tracks')) {
          body = single ? state.track : [state.track];
        } else if (p.includes('/rest/v1/track_now_plans')) {
          body = single ? state.plan : [state.plan];
        } else if (p.includes('/rest/v1/rpc/track_now_increment_item_count')) {
          // Same rules as the real function: restart on a new day, floor at zero, keep the day's
          // completion row in step with "count reached target".
          const row = state.items.find((i) => i.id === payload.p_item_id);
          if (!row) {
            status = 404;
            body = { message: 'Item not found' };
          } else {
            const stale = row.count_date !== payload.p_completed_date && !completedToday(row.id);
            const base = stale ? 0 : row.current_count;
            row.current_count = Math.max(0, base + payload.p_delta);
            row.count_date = payload.p_completed_date;
            row.status = row.current_count >= row.target_count ? 'done' : 'todo';
            row.updated_at = new Date().toISOString();
            setCompleted(row.id, row.status === 'done');
            body = row;
          }
        } else if (p.includes('/rest/v1/track_now_execution_items')) {
          const id = eq('id');
          if (method === 'GET') {
            if (id) {
              const row = state.items.find((i) => i.id === id);
              body = single ? row : row ? [row] : [];
            } else body = state.items;
          } else if (method === 'PATCH') {
            const row = state.items.find((i) => i.id === id);
            if (state.failItemId === id) {
              status = 500;
              body = { message: 'simulated outage', code: 'XX000' };
            } else if (row) {
              Object.assign(row, payload, { updated_at: new Date().toISOString() });
              body = single ? row : [row];
            } else {
              status = 404;
              body = { message: 'Item not found' };
            }
          }
        } else if (p.includes('/rest/v1/track_now_item_completions')) {
          if (method === 'POST') {
            // The app sends a duplicate-safe upsert on (item_id, completed_date).
            if (!state.completions.some((c) => c.item_id === payload.item_id && c.completed_date === payload.completed_date)) {
              state.completions.push({ id: `c-${payload.item_id}-${payload.completed_date}`, item_id: payload.item_id, user_id: USER, completed_date: payload.completed_date });
            }
            status = 201;
            body = [];
          } else if (method === 'DELETE') {
            const itemId = eq('item_id');
            const date = eq('completed_date');
            state.completions = state.completions.filter((c) => !(c.item_id === itemId && (!date || c.completed_date === date)));
          } else {
            let rows = state.completions;
            for (const [key, raw] of url.searchParams.entries()) {
              if (key === 'select' || key === 'order' || key === 'limit' || key === 'offset') continue;
              if (raw.startsWith('eq.')) rows = rows.filter((c) => String(c[key]) === raw.slice(3));
              else if (raw.startsWith('gte.')) rows = rows.filter((c) => String(c[key]) >= raw.slice(4));
              else if (raw.startsWith('lte.')) rows = rows.filter((c) => String(c[key]) <= raw.slice(4));
              else if (raw.startsWith('in.(')) {
                const set = new Set(raw.slice(4, -1).split(',').map((v) => v.replace(/"/g, '')));
                rows = rows.filter((c) => set.has(String(c[key])));
              }
            }
            body = single ? (rows[0] ?? null) : rows;
          }
        } else if (p.includes('/rest/v1/')) {
          // Tables this check does not model (telemetry, synced state…): behave as "not created".
          if (method !== 'GET') {
            status = 404;
            body = { code: 'PGRST205', message: 'Could not find the table in the schema cache' };
          }
        }

        if (isWrite) state.writesFinished += 1;
        await cdp.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: status,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, ...cors],
          body: Buffer.from(JSON.stringify(body)).toString('base64'),
        });
      } catch (err) {
        console.error('Fetch intercept error:', err);
        // Fail closed: an intercepted Supabase request must never reach the live network.
        await cdp.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => undefined);
      }
    });

    // Page-side helpers.
    const tickButton = (name) => `document.querySelector('button[aria-label="Mark ${name} as done"], button[aria-label="Mark ${name} as incomplete"]')`;
    const snapshot = (name) => cdp.eval(`(() => {
      const b = ${tickButton(name)};
      if (!b) return null;
      return {
        pressed: b.getAttribute('aria-pressed') === 'true',
        disabled: b.disabled,
        section: b.closest('section')?.getAttribute('aria-label') ?? null,
        card: b.closest('.card')?.innerText.replace(/\\s+/g, ' ').trim() ?? null,
      };
    })()`);
    /** Clicks the tick `times` times in one task and reports the state two frames later. */
    const clickTick = (name, times = 1) => cdp.eval(`(async () => {
      const t0 = performance.now();
      for (let i = 0; i < ${times}; i++) ${tickButton(name)}.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const b = ${tickButton(name)};
      return { pressed: b.getAttribute('aria-pressed') === 'true', ms: Math.round(performance.now() - t0), section: b.closest('section')?.getAttribute('aria-label') ?? null };
    })()`);
    const waitForWrites = async () => {
      for (let i = 0; i < 200; i++) {
        if (state.writesStarted === state.writesFinished) {
          await sleep(350); // let the app chain its next request, if any
          if (state.writesStarted === state.writesFinished) return;
        }
        await sleep(100);
      }
      throw new Error('writes never settled');
    };

    console.log('\n[1/6] Signing in (injected session) and opening Today...');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/login` });
    await sleep(1000);
    await cdp.eval(`localStorage.setItem('${E2E_MOCK.AUTH_STORAGE_KEY}', JSON.stringify({
      access_token: 'valid-test-jwt-token', refresh_token: 'valid-test-refresh', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: ${JSON.stringify(state.user)}
    }))`);
    // Skip first-run overlays so they cannot cover the list.
    await cdp.eval(`localStorage.setItem('tracknow_onboarding_done', '1')`).catch(() => undefined);
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/today` });
    let first = null;
    for (let i = 0; i < 50 && !first; i++) {
      await sleep(200);
      first = await snapshot('Morning Stretch');
    }
    assert(first, 'Today shows the habit "Morning Stretch"');
    // Close a first-run dialog if one is open.
    await cdp.eval(`(() => { const d = document.querySelector('[role="dialog"]'); if (d) { const b = [...d.querySelectorAll('button')].find((x) => /skip|close|not now|later/i.test(x.textContent || x.getAttribute('aria-label') || '')); if (b) b.click(); } })()`);
    await waitForWrites();
    assert(first.pressed === false && first.disabled === false, 'it starts un-ticked and enabled');
    const startSection = first.section;
    console.log(`    section before: ${startSection}`);

    console.log(`\n[2/6] One tap, while every write takes ${WRITE_LATENCY_MS} ms...`);
    const finishedBefore = state.writesFinished;
    const one = await clickTick('Morning Stretch');
    console.log(`    after ${one.ms} ms: pressed=${one.pressed}, writes finished since tap=${state.writesFinished - finishedBefore}`);
    assert(one.pressed === true, 'the tick is on screen two frames after the tap');
    assert(one.ms < 250, `that took ${one.ms} ms (limit 250 ms)`);
    assert(state.writesFinished === finishedBefore, 'no write had finished yet: the screen did not wait for the server');
    assert(one.section === startSection, 'the item is still in the section where it was tapped');
    const during = await snapshot('Morning Stretch');
    assert(during.disabled === false, 'the tick stays enabled while saving (a second tap is never dropped)');
    await sleep(1100);
    const moved = await snapshot('Morning Stretch');
    console.log(`    section after the hold: ${moved.section}`);
    assert(moved.pressed === true && moved.section !== startSection && /Completed/i.test(moved.section || ''), 'a moment later it has moved to Completed');
    await waitForWrites();
    assert(completedToday('item-stretch'), 'the backend recorded today\'s completion');
    assert(state.completions.filter((c) => c.item_id === 'item-stretch').length === 1, 'exactly one completion row');

    console.log('\n[3/6] Tick, un-tick, tick in one burst...');
    const burst = await clickTick('Read ten pages', 3);
    assert(burst.pressed === true, `three taps end ticked (shown after ${burst.ms} ms)`);
    await waitForWrites();
    const afterBurst = await snapshot('Read ten pages');
    assert(afterBurst.pressed === true, 'still ticked after all three saves finished (no flicker back)');
    assert(completedToday('item-read') && state.completions.filter((c) => c.item_id === 'item-read').length === 1, 'the backend ends completed, with one row');
    assert(state.items.find((i) => i.id === 'item-read').status === 'done', 'the stored item is done');

    console.log('\n[4/6] Three quick +1 taps on a counter...');
    const plus = `document.querySelector('button[aria-label="Increase Drink water count"]')`;
    const counted = await cdp.eval(`(async () => {
      const t0 = performance.now();
      for (let i = 0; i < 3; i++) ${plus}.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { text: ${plus}.parentElement.innerText.replace(/\\s+/g, ' ').trim(), ms: Math.round(performance.now() - t0) };
    })()`);
    console.log(`    after ${counted.ms} ms: "${counted.text}"`);
    assert(/3 \/ 5 glasses/.test(counted.text), 'the counter shows 3 / 5 at once');
    await waitForWrites();
    assert(state.items.find((i) => i.id === 'item-water').current_count === 3, 'the backend counted exactly 3');
    const countAfter = await cdp.eval(`${plus}.parentElement.innerText.replace(/\\s+/g, ' ').trim()`);
    assert(/3 \/ 5 glasses/.test(countAfter), 'and the screen still shows 3 / 5 after the saves');

    console.log('\n[5/6] A save that fails...');
    state.failItemId = 'item-flaky';
    const flaky = await clickTick('Flaky habit');
    assert(flaky.pressed === true, 'the tick shows at once, as always');
    await waitForWrites();
    await sleep(1500); // failure toast + re-sync from the server
    await waitForWrites();
    const rolledBack = await snapshot('Flaky habit');
    const toasts = await cdp.eval(`document.querySelector('.toast-container')?.innerText ?? ''`);
    console.log(`    toast: ${JSON.stringify(toasts.replace(/\s+/g, ' ').slice(0, 160))}`);
    assert(/Could not update/i.test(toasts), 'the user is told the save failed');
    assert(rolledBack.pressed === false, 'the tick is rolled back to what the server has');
    assert(!completedToday('item-flaky'), 'the backend has no completion for it');
    state.failItemId = null;

    console.log('\n[6/6] Reload: what was saved is what comes back...');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/today` });
    let reloaded = null;
    for (let i = 0; i < 50 && !reloaded; i++) {
      await sleep(200);
      reloaded = await snapshot('Morning Stretch');
    }
    await sleep(600);
    const s1 = await snapshot('Morning Stretch');
    const s2 = await snapshot('Read ten pages');
    const s3 = await snapshot('Flaky habit');
    assert(s1.pressed === true && s2.pressed === true && s3.pressed === false, 'ticked items are ticked, the failed one is not');
    const dir = process.env.TRACKNOW_SCREENSHOT_DIR;
    if (dir) {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(dir, 'instant_ticks_today.png'), Buffer.from(shot.data, 'base64'));
    }

    console.log('\nALL INSTANT TICK CHECKS PASSED');
  } finally {
    try {
      if (cdp) cdp.ws.close();
    } catch {
      /* ignore */
    }
    chromeProc.kill();
    server.close();
    await sleep(300);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* the profile is in the OS temp directory; a locked file is cleaned up by the OS later */
    }
  }
}

run().catch((err) => {
  console.error('\nINSTANT TICK CHECK FAILED:', err.message);
  process.exit(1);
});

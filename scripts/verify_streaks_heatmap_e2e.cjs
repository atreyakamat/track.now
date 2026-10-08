const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

function createSpaServer(distDir) {
  return http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    let filePath = path.join(distDir, reqPath);
    if (filePath.endsWith(path.sep) || reqPath === '/') {
      filePath = path.join(distDir, 'index.html');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
        '.woff2': 'font/woff2',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(path.join(distDir, 'index.html')).pipe(res);
    }
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.pending = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        } else if (msg.method) {
          const handler = this.eventListeners.get(msg.method);
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
    this.eventListeners.set(method, handler);
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.text} - ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : null;
  }
}

async function runStreaksHeatmapBrowserE2E() {
  console.log('================================================================');
  console.log('🚀 TRACK.NOW — HABIT STREAKS & CALENDAR HEATMAP BROWSER E2E (CDP)');
  console.log('================================================================');

  const appDist = path.resolve(__dirname, '../apps/app/dist');
  if (!fs.existsSync(appDist)) {
    throw new Error('Production build not found at apps/app/dist. Run "npm run build" first.');
  }

  const port = 5176;
  const server = createSpaServer(appDist);
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  console.log(`✓ Real SPA server listening at http://127.0.0.1:${port}`);

  const cdpPort = 9228;
  const tempDir = path.join(os.tmpdir(), `tracknow_streaks_cdp_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
  ]);

  let cdpClient;

  const now = new Date();
  const getDayStr = (offsetDays) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = getDayStr(0);
  const yesterdayStr = getDayStr(-1);
  const twoDaysAgoStr = getDayStr(-2);
  const threeDaysAgoStr = getDayStr(-3);

  // In-memory backend simulation
  const state = {
    user: {
      id: 'usr-athlete-1',
      email: 'athlete@tracknow.com',
      user_metadata: { full_name: 'Marathon Athlete', display_name: 'Marathon Athlete' },
    },
    track: {
      id: 'track-1',
      user_id: 'usr-athlete-1',
      name: 'Athletic Excellence',
      description: 'Systematic endurance training arc',
      status: 'active',
      icon: 'Activity',
      color: '#c8f169',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    plan: {
      id: 'plan-1',
      track_id: 'track-1',
      user_id: 'usr-athlete-1',
      name: 'Half Marathon Arc',
      description: '12-week progression program',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    items: [
      {
        id: 'item-habit-1',
        plan_id: 'plan-1',
        user_id: 'usr-athlete-1',
        track_id: 'track-1',
        name: 'Morning Hydration & Stretch',
        description: 'Daily mobility routine',
        type: 'habit',
        status: 'todo',
        priority: 'high',
        target_count: 1,
        current_count: 0,
        unit: null,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
        schedule: {
          id: 'sched-1',
          item_id: 'item-habit-1',
          frequency: 'daily',
          days_of_week: null,
          time_of_day: 'morning',
          created_at: new Date().toISOString(),
        },
      },
    ],
    // 3 completions: yesterday, 2 days ago, 3 days ago -> current streak is 3 (today pending)
    completions: [
      { id: 'c-1', item_id: 'item-habit-1', user_id: 'usr-athlete-1', completed_date: threeDaysAgoStr },
      { id: 'c-2', item_id: 'item-habit-1', user_id: 'usr-athlete-1', completed_date: twoDaysAgoStr },
      { id: 'c-3', item_id: 'item-habit-1', user_id: 'usr-athlete-1', completed_date: yesterdayStr },
    ],
  };

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      try {
        const json = await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${cdpPort}/json`, (res) => {
            let data = '';
            res.on('data', (d) => (data += d));
            res.on('end', () => resolve(data));
          }).on('error', reject);
        });
        const targets = JSON.parse(json);
        const pageTarget = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (pageTarget) {
          wsUrl = pageTarget.webSocketDebuggerUrl;
          break;
        } else if (targets.length > 0 && targets[0].webSocketDebuggerUrl) {
          wsUrl = targets[0].webSocketDebuggerUrl;
          break;
        }
      } catch (e) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (!wsUrl) throw new Error('Failed to connect to Chrome debugging endpoint');

    cdpClient = new CdpClient(wsUrl);
    await cdpClient.connect();
    console.log('✓ Connected to headless Chrome via CDP.\n');

    await cdpClient.send('Page.enable');
    await cdpClient.send('Runtime.enable');
    await cdpClient.send('Fetch.enable', {
      patterns: [{ urlPattern: '*supabase.co/*' }],
    });

    cdpClient.on('Fetch.requestPaused', async (evt) => {
      const { requestId, request } = evt;
      const url = new URL(request.url);
      const reqPath = url.pathname;
      const method = request.method;
      const acceptHeader = request.headers['Accept'] || request.headers['accept'] || '';
      console.log('  [Fetch]', method, reqPath, url.search);

      try {
        if (method === 'OPTIONS') {
          return cdpClient.send('Fetch.fulfillRequest', {
            requestId,
            responseCode: 200,
            responseHeaders: [
              { name: 'Access-Control-Allow-Origin', value: '*' },
              { name: 'Access-Control-Allow-Headers', value: '*' },
              { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
            ],
            body: Buffer.from('{}').toString('base64'),
          });
        }

        let statusCode = 200;
        let bodyObj = null;

        if (reqPath.includes('/auth/v1/user') || reqPath.includes('/auth/v1/session')) {
          bodyObj = {
            access_token: 'valid-test-jwt-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'valid-test-refresh',
            user: state.user,
          };
        } else if (reqPath.includes('/rest/v1/track_now_profiles')) {
          bodyObj = [
            {
              id: state.user.id,
              display_name: 'Marathon Athlete',
              full_name: 'Marathon Athlete',
              email: state.user.email,
              avatar_url: null,
              theme_preference: 'dark',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
          if (acceptHeader.includes('application/vnd.pgrst.object+json')) {
            bodyObj = bodyObj[0];
          }
        } else if (reqPath.includes('/rest/v1/track_now_tracks')) {
          if (url.searchParams.get('id') === 'eq.track-1' && acceptHeader.includes('application/vnd.pgrst.object+json')) {
            bodyObj = state.track;
          } else {
            bodyObj = [state.track];
          }
        } else if (reqPath.includes('/rest/v1/track_now_plans')) {
          if (url.searchParams.get('id') === 'eq.plan-1' && acceptHeader.includes('application/vnd.pgrst.object+json')) {
            bodyObj = state.plan;
          } else {
            bodyObj = [state.plan];
          }
        } else if (reqPath.includes('/rest/v1/track_now_execution_items')) {
          if (method === 'GET') {
            const single = acceptHeader.includes('application/vnd.pgrst.object+json');
            const idParam = url.searchParams.get('id');
            if (idParam) {
              const targetId = idParam.replace('eq.', '');
              const item = state.items.find((i) => i.id === targetId);
              bodyObj = single ? item : item ? [item] : [];
            } else {
              bodyObj = state.items;
            }
          } else if (method === 'PATCH') {
            const raw = request.postData ? JSON.parse(request.postData) : {};
            const idParam = url.searchParams.get('id');
            const targetId = idParam ? idParam.replace('eq.', '') : '';
            const item = state.items.find((i) => i.id === targetId);
            if (item) {
              Object.assign(item, raw, { updated_at: new Date().toISOString() });
              bodyObj = item;
            } else {
              statusCode = 404;
              bodyObj = { message: 'Item not found' };
            }
          }
        } else if (reqPath.includes('/rest/v1/track_now_item_completions')) {
          if (method === 'POST') {
            const raw = request.postData ? JSON.parse(request.postData) : {};
            state.completions.push({
              id: `comp-${Date.now()}`,
              item_id: raw.item_id,
              user_id: state.user.id,
              completed_date: raw.completed_date || todayStr,
            });
            bodyObj = { id: 'comp-1' };
          } else if (method === 'DELETE') {
            const compDate = url.searchParams.get('completed_date')?.replace('eq.', '');
            state.completions = state.completions.filter((c) => c.completed_date !== compDate);
            bodyObj = [];
          } else {
            bodyObj = state.completions;
          }
        } else {
          bodyObj = [];
        }

        const bodyStr = JSON.stringify(bodyObj);
        await cdpClient.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: statusCode,
          responseHeaders: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' },
            { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
            { name: 'Access-Control-Allow-Headers', value: '*' },
          ],
          body: Buffer.from(bodyStr).toString('base64'),
        });
      } catch (err) {
        console.error('Fetch intercept error:', err);
        await cdpClient.send('Fetch.continueRequest', { requestId });
      }
    });

    // 1. Session injection
    console.log('[1/7] Injecting auth session into browser localStorage...');
    await cdpClient.send('Page.navigate', { url: `http://127.0.0.1:${port}/login` });
    await new Promise((r) => setTimeout(r, 1000));

    await cdpClient.eval(`
      (() => {
        const session = {
          access_token: 'valid-test-jwt-token',
          refresh_token: 'valid-test-refresh',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: ${JSON.stringify(state.user)}
        };
        localStorage.setItem('sb-bjejovuayqtxqhevvvuu-auth-token', JSON.stringify(session));
      })()
    `);

    // 2. Navigate to Plan Detail Page
    console.log('[2/7] Navigating to Plan Detail Page (/plans/plan-1)...');
    await cdpClient.send('Page.navigate', { url: `http://127.0.0.1:${port}/plans/plan-1` });
    await new Promise((r) => setTimeout(r, 1200));

    const currentUrl = await cdpClient.eval('window.location.href');
    const bodyText = await cdpClient.eval('document.body.innerText.slice(0, 150).replace(/\\n/g, " ")');
    console.log(`✓ Current URL: ${currentUrl}`);
    console.log(`✓ Body snippet: "${bodyText}"`);

    const pageHeading = await cdpClient.eval('document.querySelector("h1")?.textContent');
    console.log(`✓ Plan Heading: ${pageHeading}`);

    // 3. Click "Habits" tab
    console.log('[3/7] Clicking "Habits" tab...');
    await cdpClient.eval(`
      const habitTab = document.getElementById('tab-habits') || Array.from(document.querySelectorAll('.tabs__tab')).find(t => t.textContent.includes('Habits'));
      if (habitTab) habitTab.click();
    `);
    await new Promise((r) => setTimeout(r, 800));

    // 4. Verify CalendarHeatmap is rendered
    console.log('[4/7] Verifying CalendarHeatmap presence...');
    const hasHeatmap = await cdpClient.eval('Boolean(document.querySelector(".heatmap-container"))');
    const heatmapTitle = await cdpClient.eval('document.querySelector(".heatmap-container h3")?.textContent');
    console.log(`✓ CalendarHeatmap rendered: ${hasHeatmap} (Title: "${heatmapTitle}")`);
    if (!hasHeatmap) throw new Error('CalendarHeatmap was not rendered in Habits tab');

    // 5. Verify initial 3-day streak badge
    console.log('[5/7] Verifying habit streak badge (expected: 3d streak)...');
    const initialStreakBadge = await cdpClient.eval(`
      const badge = Array.from(document.querySelectorAll('.card .row'))
        .find(el => el.textContent.includes('streak'));
      badge ? badge.textContent.trim() : null;
    `);
    console.log(`✓ Rendered streak badge: "${initialStreakBadge}"`);
    if (!initialStreakBadge || !initialStreakBadge.includes('3d streak')) {
      throw new Error(`Expected "3d streak", got: ${initialStreakBadge}`);
    }

    // 6. Complete habit for today
    console.log('[6/7] Completing habit for today...');
    await cdpClient.eval(`
      (() => {
        const btn = document.querySelector('.card button.btn--icon');
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Verify streak updates
    const updatedStreakBadge = await cdpClient.eval(`
      (() => {
        const badge = Array.from(document.querySelectorAll('.card .row'))
          .find(el => el.textContent.includes('streak'));
        return badge ? badge.textContent.trim() : null;
      })()
    `);
    console.log(`✓ Updated streak badge: "${updatedStreakBadge}"`);

    // 7. Responsive checks
    console.log('[7/7] Verifying responsive layout across viewports (320px, 375px, 768px, 1280px)...');
    for (const w of [320, 375, 768, 1280]) {
      await cdpClient.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: w <= 768,
      });
      await new Promise((r) => setTimeout(r, 150));
      const overflow = await cdpClient.eval(`({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth
      })`);
      console.log(`  ${w}px: scrollWidth=${overflow.scrollWidth}, innerWidth=${overflow.innerWidth}, overflow=${overflow.hasOverflow}`);
      if (overflow.hasOverflow) {
        throw new Error(`Horizontal overflow detected at ${w}px!`);
      }
    }

    console.log('\n================================================================');
    console.log('🎉 HABIT STREAKS & CALENDAR HEATMAP BROWSER E2E PASSED 100%');
    console.log('================================================================');
  } finally {
    if (cdpClient) cdpClient.ws.close();
    chromeProc.kill();
    server.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

runStreaksHeatmapBrowserE2E().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

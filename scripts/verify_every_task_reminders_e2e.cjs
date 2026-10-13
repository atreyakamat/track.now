// Fail closed: only runs against a bundle built with a fake Supabase project (see scripts/lib/e2eMock.cjs).
const E2E_MOCK = require('./lib/e2eMock.cjs');
E2E_MOCK.assertMockBuild();
// Screenshots go to a temporary directory outside the repository (override with TRACKNOW_SCREENSHOT_DIR).
const __shotDir = process.env.TRACKNOW_SCREENSHOT_DIR || require('path').join(require('os').tmpdir(), 'tracknow-e2e-screenshots');
require('fs').mkdirSync(__shotDir, { recursive: true });
const shotPath = (name) => require('path').join(__shotDir, name);

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

function createSpaServer(distDir) {
  return http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    let filePath = path.join(distDir, reqPath);
    // Confine to the build directory (no ../ path traversal out of dist).
    if (!path.resolve(filePath).startsWith(path.resolve(distDir) + path.sep)) filePath = path.join(distDir, 'index.html');
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

  on(method, handler) {
    this.eventListeners.set(method, handler);
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }
}

async function findChrome() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function run() {
  console.log('--- TRACK.NOW EVERY TASK REMINDERS CDP VERIFICATION ---');

  const distDir = path.resolve(__dirname, '../apps/app/dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('apps/app/dist not found! Run npm run build first.');
  }

  const port = 4183;
  const server = createSpaServer(distDir);
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  console.log(`SPA server active at http://localhost:${port}`);

  const chromePath = await findChrome();
  if (!chromePath) {
    server.close();
    throw new Error('Chrome executable not found on Windows host');
  }

  const cdpPort = 9233;
  const userDataDir = path.join(os.tmpdir(), `tracknow-task-reminders-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    '--host-resolver-rules=MAP *.supabase.co ~NOTFOUND, MAP *.supabase.in ~NOTFOUND',
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    'about:blank',
  ]);

  await new Promise((resolve) => setTimeout(resolve, 1500));

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
      }
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (!wsUrl) throw new Error('Failed to connect to Chrome debugging endpoint');

  const cdp = new CdpClient(wsUrl);
  await cdp.connect();
  console.log('Connected to Chrome via CDP.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Fetch.enable', {
    patterns: [{ urlPattern: '*supabase.co/*' }],
  });

  const mockUserId = '88888888-9999-4444-aaaa-bbbbbbbbbbbb';
  const state = {
    user: {
      id: mockUserId,
      email: 'founder@tracknow.dev',
      user_metadata: { display_name: 'Founder' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id: mockUserId,
      full_name: 'Founder',
      display_name: 'Founder',
      timezone: 'UTC',
      theme_preference: 'dark',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    track: {
      id: 'track-alpha',
      user_id: mockUserId,
      name: 'Life Core Arc',
      description: 'Foundational mastery',
      status: 'active',
      icon: 'Activity',
      color: '#c8f169',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    plan: {
      id: 'plan-beta',
      track_id: 'track-alpha',
      user_id: mockUserId,
      name: 'Q4 Performance Sprint',
      description: 'Habits and tasks with smart execution reminders',
      status: 'active',
      start_date: '2026-10-01',
      end_date: '2026-12-31',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    items: [
      {
        id: 'item-task-1',
        plan_id: 'plan-beta',
        track_id: 'track-alpha',
        user_id: mockUserId,
        type: 'task',
        name: 'Review Investor Deck',
        description: 'Prepare final updates before presentation',
        priority: 'urgent',
        due_date: '2026-10-10',
        target_count: 1,
        current_count: 0,
        status: 'todo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'item-habit-1',
        plan_id: 'plan-beta',
        track_id: 'track-alpha',
        user_id: mockUserId,
        type: 'habit',
        name: '45-Minute Focus Deep Work',
        description: 'Morning uninterrupted coding block',
        priority: 'high',
        due_date: null,
        target_count: 1,
        current_count: 0,
        track_now_item_schedules: {
          id: 'sched-1',
          item_id: 'item-habit-1',
          frequency: 'daily',
          days_of_week: null,
          time_of_day: 'morning',
          reminder_time: '09:00',
          created_at: new Date().toISOString(),
        },
        status: 'todo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'item-check-1',
        plan_id: 'plan-beta',
        track_id: 'track-alpha',
        user_id: mockUserId,
        type: 'checklist',
        name: 'Verify Backup Integrity',
        description: 'Confirm encrypted storage snapshot',
        priority: 'medium',
        due_date: null,
        target_count: 1,
        current_count: 0,
        status: 'todo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    completions: [],
  };

  cdp.on('Fetch.requestPaused', async (evt) => {
    const { requestId, request } = evt;
    const url = new URL(request.url);
    const reqPath = url.pathname;
    const method = request.method;
    const acceptHeader = request.headers['Accept'] || request.headers['accept'] || '';

    try {
      if (method === 'OPTIONS') {
        return cdp.send('Fetch.fulfillRequest', {
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
          access_token: 'fake-valid-jwt',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'fake-valid-refresh',
          user: state.user,
        };
      } else if (reqPath.includes('/rest/v1/track_now_profiles')) {
        bodyObj = [state.profile];
        if (acceptHeader.includes('application/vnd.pgrst.object+json')) {
          bodyObj = bodyObj[0];
        }
      } else if (reqPath.includes('/rest/v1/track_now_tracks')) {
        bodyObj = [state.track];
        if (acceptHeader.includes('application/vnd.pgrst.object+json')) {
          bodyObj = bodyObj[0];
        }
      } else if (reqPath.includes('/rest/v1/track_now_plans')) {
        bodyObj = [state.plan];
        if (acceptHeader.includes('application/vnd.pgrst.object+json')) {
          bodyObj = bodyObj[0];
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
        } else if (method === 'POST') {
          const raw = request.postData ? JSON.parse(request.postData) : {};
          const created = {
            ...raw,
            id: `item-${Date.now()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          state.items.push(created);
          bodyObj = acceptHeader.includes('application/vnd.pgrst.object+json') ? created : [created];
        } else if (method === 'PATCH') {
          const raw = request.postData ? JSON.parse(request.postData) : {};
          const idParam = url.searchParams.get('id');
          const targetId = idParam ? idParam.replace('eq.', '') : '';
          const item = state.items.find((i) => i.id === targetId);
          if (item) {
            Object.assign(item, raw, { updated_at: new Date().toISOString() });
            bodyObj = acceptHeader.includes('application/vnd.pgrst.object+json') ? item : [item];
          } else {
            statusCode = 404;
            bodyObj = { message: 'Item not found' };
          }
        }
      } else if (reqPath.includes('/rest/v1/track_now_item_completions')) {
        bodyObj = state.completions;
      } else if (reqPath.includes('/rest/v1/track_now_item_schedules')) {
        bodyObj = [state.items[1].track_now_item_schedules];
      } else {
        bodyObj = [];
      }

      const bodyStr = JSON.stringify(bodyObj);
      return cdp.send('Fetch.fulfillRequest', {
        requestId,
        responseCode: statusCode,
        responseHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Access-Control-Allow-Origin', value: '*' },
          { name: 'Access-Control-Allow-Headers', value: '*' },
        ],
        body: Buffer.from(bodyStr).toString('base64'),
      });
    } catch (err) {
      console.error('Fetch fulfill error:', err);
      // Fail closed: an intercepted Supabase request must never reach the live network.
      return cdp.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    }
  });

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 850,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Navigate to /today first to initialize
  await cdp.send('Page.navigate', { url: `http://localhost:${port}/today` });
  await new Promise((r) => setTimeout(r, 1500));

  // Inject authenticated session and initial reminder
  await cdp.eval(`
    (() => {
      localStorage.setItem('${E2E_MOCK.AUTH_STORAGE_KEY}', JSON.stringify({
        access_token: 'fake-valid-jwt',
        refresh_token: 'fake-valid-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: '${mockUserId}',
          aud: 'authenticated',
          email: 'founder@tracknow.dev',
          user_metadata: { display_name: 'Founder' }
        }
      }));

      localStorage.setItem('tracknow_notification_prefs_${mockUserId}', JSON.stringify({
        masterEnabled: true,
        remindersEnabled: true,
        completionAcknowledgement: true,
        overdueRemindersEnabled: false,
        dailySummaryEnabled: false,
        dailySummaryTime: '09:00',
        defaultPreset: 'none',
        soundEnabled: false
      }));

      // Pre-set reminder on item-task-1
      localStorage.setItem('tracknow_reminders_${mockUserId}', JSON.stringify([
        {
          id: 'rem-task-1',
          itemId: 'item-task-1',
          userId: '${mockUserId}',
          itemName: 'Review Investor Deck',
          planId: 'plan-beta',
          trackId: 'track-alpha',
          preset: '1h_in',
          remindAt: new Date(Date.now() + 3600000).toISOString(),
          status: 'upcoming',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]));
    })()
  `);

  // Navigate to PlanDetailPage
  console.log('Navigating to PlanDetailPage (http://localhost:4183/plans/plan-beta)...');
  await cdp.send('Page.navigate', { url: `http://localhost:${port}/plans/plan-beta` });
  await new Promise((r) => setTimeout(r, 2000));

  // Check Plan Details & Execution Items rendered
  const planCheck = await cdp.eval(`
    (() => {
      const text = document.body.innerText;
      return {
        url: window.location.href,
        hasTitle: text.includes('Q4 Performance Sprint'),
        hasDeckItem: text.includes('Review Investor Deck'),
        hasHabitItem: text.includes('45-Minute Focus Deep Work'),
        cardCount: document.querySelectorAll('.card').length
      };
    })()
  `);
  console.log('Plan Detail Page Check:', planCheck);
  if (!planCheck.hasTitle || !planCheck.hasDeckItem) {
    throw new Error('PlanDetailPage did not render properly');
  }

  // 1. Verify that the task card shows the active reminder badge and formatted time
  console.log('Verifying reminder badge on task card...');
  const reminderBadgeCheck = await cdp.eval(`
    (() => {
      const cards = Array.from(document.querySelectorAll('.card'));
      const deckCard = cards.find(c => c.innerText.includes('Review Investor Deck'));
      if (!deckCard) return null;
      return {
        hasBell: Boolean(deckCard.querySelector('svg.lucide-bell')),
        cardText: deckCard.innerText,
        hasQuickSnooze: deckCard.innerText.includes('+10m'),
        hasRemoveBtn: deckCard.innerText.includes('×')
      };
    })()
  `);
  console.log('Task Card Reminder Badge:', reminderBadgeCheck);
  if (!reminderBadgeCheck || !reminderBadgeCheck.hasBell || !reminderBadgeCheck.hasQuickSnooze) {
    throw new Error('Task card does not display interactive reminder badge');
  }

  // 2. Test Quick Snooze (+10m) from card
  console.log('Testing Quick Snooze (+10m) action on task card...');
  const snoozeClicked = await cdp.eval(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const snoozeBtn = buttons.find(b => b.getAttribute('aria-label') && b.getAttribute('aria-label').includes('Snooze reminder for Review Investor Deck'));
      if (snoozeBtn) {
        snoozeBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log('Snooze button clicked:', snoozeClicked);
  if (!snoozeClicked) throw new Error('Could not find Quick Snooze button on card');
  await new Promise((r) => setTimeout(r, 500));

  // Verify reminder in localStorage is updated to snoozed
  const snoozedStorageCheck = await cdp.eval(`
    (() => {
      const raw = localStorage.getItem('tracknow_reminders_${mockUserId}');
      if (!raw) return null;
      const all = JSON.parse(raw);
      const rem = all.find(r => r.itemId === 'item-task-1');
      return rem ? { status: rem.status, hasSnoozeDate: Boolean(rem.snoozedUntil) } : null;
    })()
  `);
  console.log('Storage check after snooze:', snoozedStorageCheck);
  if (!snoozedStorageCheck || snoozedStorageCheck.status !== 'snoozed') {
    throw new Error('Reminder status did not update to snoozed in storage');
  }

  // 3. Test Quick Remove (×) from card
  console.log('Testing Quick Remove (×) action on task card...');
  const removeClicked = await cdp.eval(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const removeBtn = buttons.find(b => b.getAttribute('aria-label') && b.getAttribute('aria-label').includes('Remove reminder for Review Investor Deck'));
      if (removeBtn) {
        removeBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log('Remove reminder button clicked:', removeClicked);
  if (!removeClicked) throw new Error('Could not find Remove reminder button on card');
  await new Promise((r) => setTimeout(r, 500));

  // Verify reminder in localStorage is cancelled
  const removedStorageCheck = await cdp.eval(`
    (() => {
      const raw = localStorage.getItem('tracknow_reminders_${mockUserId}');
      if (!raw) return null;
      const all = JSON.parse(raw);
      const rem = all.find(r => r.itemId === 'item-task-1');
      return rem ? rem.status : null;
    })()
  `);
  console.log('Storage check after removal:', removedStorageCheck);
  if (removedStorageCheck !== 'cancelled') {
    throw new Error('Reminder was not cancelled after clicking remove');
  }

  // 4. Test opening Create Item Modal and selecting a reminder
  console.log('Testing Create Item Modal reminder configuration...');
  await cdp.eval(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const addBtn = buttons.find(b => b.innerText.includes('Add Item'));
      if (addBtn) addBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 600));

  const modalOptionsCheck = await cdp.eval(`
    (() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const timingLabel = labels.find(l => l.innerText.toLowerCase().includes('reminder timing'));
      if (!timingLabel) return null;
      const select = document.getElementById(timingLabel.getAttribute('for'));
      if (!select) return null;
      const options = Array.from(select.options).map(o => ({ value: o.value, text: o.text }));
      return {
        optionCount: options.length,
        has10mIn: options.some(o => o.value === '10m_in'),
        has1hBefore: options.some(o => o.value === '1h_before'),
        hasScheduled: options.some(o => o.value === 'scheduled_time'),
        hasExact: options.some(o => o.value === 'exact_time'),
      };
    })()
  `);
  console.log('Create Item Modal Reminder Options:', modalOptionsCheck);
  if (!modalOptionsCheck || !modalOptionsCheck.has10mIn || !modalOptionsCheck.has1hBefore) {
    throw new Error('Create Item Modal does not offer complete separated reminder options');
  }

  // Close create modal
  await cdp.eval(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const cancelBtn = buttons.find(b => b.innerText.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 500));

  // 5. Navigate to /today and verify reminder interactions on Today view
  console.log('Navigating to TodayPage (http://localhost:4183/today)...');
  // Re-add a reminder on item-task-1 for TodayPage testing
  await cdp.eval(`
    (() => {
      localStorage.setItem('tracknow_reminders_${mockUserId}', JSON.stringify([
        {
          id: 'rem-today-task',
          itemId: 'item-task-1',
          userId: '${mockUserId}',
          itemName: 'Review Investor Deck',
          planId: 'plan-beta',
          preset: '30m_in',
          remindAt: new Date(Date.now() + 1800000).toISOString(),
          status: 'upcoming',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]));
    })()
  `);

  await cdp.send('Page.navigate', { url: `http://localhost:${port}/today` });
  await new Promise((r) => setTimeout(r, 1500));

  const todayCardReminderCheck = await cdp.eval(`
    (() => {
      const cards = Array.from(document.querySelectorAll('.card'));
      const deckCard = cards.find(c => c.innerText.includes('Review Investor Deck'));
      if (!deckCard) return null;
      return {
        hasBell: Boolean(deckCard.querySelector('svg.lucide-bell')),
        hasQuickSnooze: deckCard.innerText.includes('+10m'),
        hasRemoveBtn: deckCard.innerText.includes('×')
      };
    })()
  `);
  console.log('Today View Task Reminder Controls:', todayCardReminderCheck);
  if (!todayCardReminderCheck || !todayCardReminderCheck.hasQuickSnooze) {
    throw new Error('Today view does not provide direct reminder controls on task card');
  }

  // Take screenshot
  const planScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const planImgPath = shotPath('screenshot_reminders_task_card.png');
  fs.writeFileSync(planImgPath, Buffer.from(planScreenshot.data, 'base64'));
  console.log(`Saved screenshot to ${planImgPath}`);

  // Cleanup
  cdp.ws.close();
  chromeProc.kill();
  server.close();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // Windows file lock delay
  }

  console.log('=====================================================================');
  console.log('ALL EVERY-TASK REMINDERS CDP VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('=====================================================================');
}

run().catch((err) => {
  console.error('CDP Verification failed:', err);
  process.exit(1);
});

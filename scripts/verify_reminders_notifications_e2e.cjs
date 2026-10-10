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
  console.log('--- TRACK.NOW SMART REMINDERS & NOTIFICATIONS CDP VERIFICATION ---');

  const distDir = path.resolve(__dirname, '../apps/app/dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('apps/app/dist not found! Run npm run build first.');
  }

  const port = 4182;
  const server = createSpaServer(distDir);
  await new Promise((resolve) => server.listen(port, resolve));
  console.log(`SPA server active at http://localhost:${port}`);

  const chromePath = await findChrome();
  if (!chromePath) {
    server.close();
    throw new Error('Chrome executable not found on Windows host');
  }

  const cdpPort = 9232;
  const userDataDir = path.join(os.tmpdir(), `tracknow-reminders-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
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
    } catch (e) {
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

  const mockUserId = '11111111-2222-3333-4444-555555555555';
  const state = {
    user: {
      id: mockUserId,
      email: 'lead.auditor@tracknow.dev',
      user_metadata: { display_name: 'Lead Auditor' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id: mockUserId,
      full_name: 'Lead Auditor',
      display_name: 'Lead Auditor',
      timezone: 'UTC',
      theme_preference: 'dark',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    track: {
      id: 'track-101',
      user_id: mockUserId,
      name: 'Executive Leadership',
      description: 'Strategic life planning and habits',
      status: 'active',
      icon: 'Target',
      color: '#c8f169',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    plan: {
      id: 'plan-201',
      track_id: 'track-101',
      user_id: mockUserId,
      name: 'Daily Execution System',
      description: 'Focus blocks and consistency habits',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    items: [
      {
        id: 'item-1',
        plan_id: 'plan-201',
        track_id: 'track-101',
        user_id: mockUserId,
        type: 'habit',
        name: 'Morning Hydration & Run',
        description: '5km mobility route',
        status: 'todo',
        priority: 'high',
        target_count: 1,
        current_count: 0,
        due_date: '2026-10-10',
        track_now_item_schedules: {
          id: 'sched-1',
          item_id: 'item-1',
          frequency: 'daily',
          time_of_day: 'morning',
          reminder_time: '08:00',
          days_of_week: null,
          created_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'item-2',
        plan_id: 'plan-201',
        track_id: 'track-101',
        user_id: mockUserId,
        type: 'task',
        name: 'Review Security Architecture',
        description: 'Verify forensic controls',
        status: 'todo',
        priority: 'urgent',
        target_count: 1,
        current_count: 0,
        due_date: '2026-10-10',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'item-3',
        plan_id: 'plan-201',
        track_id: 'track-101',
        user_id: mockUserId,
        type: 'task',
        name: 'Deploy Mobile Shell Widgets',
        description: 'Verify Android and iOS widgets',
        status: 'todo',
        priority: 'medium',
        target_count: 1,
        current_count: 0,
        due_date: '2026-10-10',
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
      } else if (reqPath.includes('/rest/v1/track_now_plans')) {
        bodyObj = [state.plan];
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
            bodyObj = acceptHeader.includes('application/vnd.pgrst.object+json') ? item : [item];
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
            completed_date: raw.completed_date || '2026-10-10',
          });
          bodyObj = { id: 'comp-1' };
        } else if (method === 'DELETE') {
          const compDate = url.searchParams.get('completed_date')?.replace('eq.', '');
          state.completions = state.completions.filter((c) => c.completed_date !== compDate);
          bodyObj = [];
        } else {
          bodyObj = state.completions;
        }
      } else if (reqPath.includes('/rest/v1/track_now_item_schedules')) {
        bodyObj = [state.items[0].track_now_item_schedules];
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
      return cdp.send('Fetch.continueRequest', { requestId });
    }
  });

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 850,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Navigate to /settings
  await cdp.send('Page.navigate', { url: `http://localhost:${port}/settings` });
  await new Promise((r) => setTimeout(r, 1500));

  // Inject session into localStorage and reload
  await cdp.eval(`
    localStorage.setItem('sb-bjejovuayqtxqhevvvuu-auth-token', JSON.stringify({
      access_token: 'fake-valid-jwt',
      refresh_token: 'fake-valid-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: '${mockUserId}',
        aud: 'authenticated',
        email: 'lead.auditor@tracknow.dev',
        user_metadata: { display_name: 'Lead Auditor' }
      }
    }));
    window.location.href = '/settings';
  `);

  await new Promise((r) => setTimeout(r, 2000));
  await cdp.send('Page.navigate', { url: `http://localhost:${port}/settings` });
  await new Promise((r) => setTimeout(r, 1500));

  // Verify Settings Sections
  console.log('Verifying SettingsPage notifications and widgets sections...');
  const settingsSections = await cdp.eval(`
    (() => {
      const text = document.body.innerText;
      return {
        url: window.location.href,
        hasNotificationSection: text.includes('Smart Reminders & Notifications'),
        hasPlatformTable: text.includes('Platform Delivery Capabilities'),
        hasWidgetSection: text.includes('Home Screen Widgets (Android & iOS)'),
      };
    })()
  `);

  console.log('Settings Sections Result:', settingsSections);
  if (!settingsSections.hasNotificationSection) {
    throw new Error('Smart Reminders & Notifications section missing from SettingsPage');
  }
  if (!settingsSections.hasPlatformTable) {
    throw new Error('Platform Delivery Capabilities table missing from SettingsPage');
  }
  if (!settingsSections.hasWidgetSection) {
    throw new Error('Home Screen Widgets section missing from SettingsPage');
  }

  // Click "Send Test Notification"
  console.log('Testing in-app celebratory toast notification...');
  const toastClicked = await cdp.eval(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const testBtn = buttons.find(b => b.innerText.includes('Send Test Notification'));
      if (testBtn) {
        testBtn.click();
        return true;
      }
      return false;
    })()
  `);

  if (!toastClicked) throw new Error('Could not find Send Test Notification button');
  await new Promise((r) => setTimeout(r, 500));

  const toastCard = await cdp.eval(`
    (() => {
      const card = document.querySelector('.toast-card');
      if (!card) return null;
      return {
        text: card.innerText,
        hasTitle: card.innerText.includes('Track.now Test Notification'),
        hasNextUp: card.innerText.includes("Today's Execution Queue"),
      };
    })()
  `);

  console.log('Toast Card Verification:', toastCard);
  if (!toastCard || !toastCard.hasTitle) {
    throw new Error('Toast card did not render properly on Send Test Notification');
  }

  // Capture screenshot of Settings page
  const settingsScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const settingsImgPath = path.resolve(__dirname, '../scripts/screenshot_settings_notifications.png');
  fs.writeFileSync(settingsImgPath, Buffer.from(settingsScreenshot.data, 'base64'));
  console.log(`Saved screenshot to ${settingsImgPath}`);

  // Test "Force Widget Sync"
  console.log('Testing Force Widget Sync button...');
  await cdp.eval(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const syncBtn = buttons.find(b => b.innerText.includes('Force Widget Sync'));
      if (syncBtn) syncBtn.click();
    })()
  `);

  await new Promise((r) => setTimeout(r, 1000));

  const widgetStorageCheck = await cdp.eval(`
    (() => {
      const raw = localStorage.getItem('tracknow_widget_data_${mockUserId}');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        version: parsed.version,
        hasProgress: Boolean(parsed.progress || parsed.today),
        total: parsed.today?.totalItems ?? parsed.progress?.total ?? 0,
        itemCount: parsed.items ? parsed.items.length : 0,
      };
    })()
  `);

  console.log('Widget Storage Payload:', widgetStorageCheck);
  if (!widgetStorageCheck || widgetStorageCheck.version !== 1) {
    throw new Error('Widget data payload was not properly synced or formatted');
  }

  // Navigate to /today and verify Today queue rendering with reminders
  console.log('Navigating to /today to verify queue and completion feedback...');
  await cdp.send('Page.navigate', { url: `http://localhost:${port}/today` });
  await new Promise((r) => setTimeout(r, 2000));

  const todayCheck = await cdp.eval(`
    (() => {
      const text = document.body.innerText;
      return {
        hasHeader: text.includes('Today'),
        hasItem: text.includes('Morning Hydration & Run') || text.includes('Review Security Architecture'),
        itemCount: document.querySelectorAll('.card').length,
      };
    })()
  `);

  console.log('Today Page Verification:', todayCheck);
  if (!todayCheck.hasHeader || !todayCheck.hasItem) {
    throw new Error('Today queue did not render scheduled items');
  }

  // Complete an item and verify celebration toast & reminder cancellation
  console.log('Completing item on /today to verify celebratory feedback...');
  const completeAction = await cdp.eval(`
    (() => {
      // Set preferences to have completionAcknowledgement: true and masterEnabled: true
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

      // Set a test reminder for item-2
      localStorage.setItem('tracknow_reminders_${mockUserId}', JSON.stringify([{
        id: 'rem-2',
        itemId: 'item-2',
        userId: '${mockUserId}',
        itemName: 'Review Security Architecture',
        planId: 'plan-201',
        preset: '10m',
        remindAt: new Date(Date.now() + 600000).toISOString(),
        status: 'upcoming',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]));

      // Click the check button for the task item
      const checkBtn = document.querySelector('button[aria-label*="Mark Review Security Architecture as done"]');
      if (checkBtn) {
        checkBtn.click();
        return true;
      }
      return false;
    })()
  `);

  console.log('Completed item clicked:', completeAction);
  await new Promise((r) => setTimeout(r, 800));

  // Check celebratory toast appeared
  const completionToast = await cdp.eval(`
    (() => {
      const card = document.querySelector('.toast-card');
      if (!card) return null;
      return {
        text: card.innerText,
        hasTitle: card.innerText.includes('Completed: Review Security Architecture'),
        hasNextUp: card.innerText.includes('Next up:'),
      };
    })()
  `);

  console.log('Completion Toast Verification:', completionToast);
  if (!completionToast || !completionToast.hasTitle) {
    throw new Error('Celebration toast feedback did not appear upon item completion');
  }

  // Check that the active reminder for item-2 was cancelled
  const reminderCheck = await cdp.eval(`
    (() => {
      const raw = localStorage.getItem('tracknow_reminders_${mockUserId}');
      if (!raw) return null;
      const all = JSON.parse(raw);
      const rem2 = all.find(r => r.itemId === 'item-2');
      return rem2 ? rem2.status : null;
    })()
  `);

  console.log('Reminder Status for completed item:', reminderCheck);
  if (reminderCheck !== 'cancelled') {
    throw new Error(`Expected reminder to be 'cancelled', got ${reminderCheck}`);
  }

  // Capture screenshot of Today page with completion toast
  const todayScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const todayImgPath = path.resolve(__dirname, '../scripts/screenshot_today_queue.png');
  fs.writeFileSync(todayImgPath, Buffer.from(todayScreenshot.data, 'base64'));
  console.log(`Saved screenshot to ${todayImgPath}`);

  // Clean up
  cdp.ws.close();
  chromeProc.kill();
  server.close();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // Windows file lock delay on temporary Chrome exit
  }

  console.log('=====================================================================');
  console.log('ALL SMART REMINDERS, NOTIFICATIONS & WIDGET CDP VERIFICATIONS PASSED!');
  console.log('=====================================================================');
}

run().catch((err) => {
  console.error('CDP Verification failed:', err);
  process.exit(1);
});

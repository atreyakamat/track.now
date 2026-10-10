const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

function createStaticServer(distDir, isSpa) {
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
    } else if (isSpa) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(path.join(distDir, 'index.html')).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
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

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
  }

  async captureScreenshot(outPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res && res.data) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
    }
  }

  close() {
    this.ws.close();
  }
}

async function runAudit() {
  console.log('=== TRACK.NOW FULL FRONTEND RESPONSIVENESS & UX AUDIT ===\n');

  const landingDist = path.resolve(__dirname, '../apps/landing/dist');
  const appDist = path.resolve(__dirname, '../apps/app/dist');
  if (!fs.existsSync(landingDist) || !fs.existsSync(appDist)) {
    throw new Error('Dist directories not found. Run npm run build first.');
  }

  const landingServer = createStaticServer(landingDist, false);
  const appServer = createStaticServer(appDist, true);

  await new Promise((r) => landingServer.listen(5183, '127.0.0.1', r));
  await new Promise((r) => appServer.listen(5184, '127.0.0.1', r));
  console.log('✓ Landing site static server: http://127.0.0.1:5183');
  console.log('✓ App site SPA server: http://127.0.0.1:5184\n');

  const cdpPort = 9230;
  const tempDir = path.join(os.tmpdir(), `tracknow_ux_audit_${Date.now()}`);
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

  let cdp;

  // In-memory backend simulation
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

  const mockUser = {
    id: 'usr-athlete-1',
    email: 'athlete@tracknow.com',
    user_metadata: { full_name: 'Marathon Athlete', display_name: 'Marathon Athlete' },
  };

  const mockTracks = [
    {
      id: 'track-1',
      user_id: 'usr-athlete-1',
      name: 'Athletic Excellence & Long Arc Endurance',
      description: 'Systematic endurance training, nutrition protocols, zone 2 baseline, recovery monitoring, and athletic performance.',
      status: 'active',
      icon: 'Activity',
      color: '#c8f169',
      template_key: 'fitness',
      template_type: 'fitness',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'track-2',
      user_id: 'usr-athlete-1',
      name: 'Deep Work & Systems Architecture',
      description: 'Mastery of distributed systems, high-leverage architectural patterns, and systematic deep work cadence.',
      status: 'active',
      icon: 'Briefcase',
      color: '#b9a7ff',
      template_key: 'career',
      template_type: 'career',
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'track-3',
      user_id: 'usr-athlete-1',
      name: 'Mind & Classical Philosophy Arc',
      description: 'Stoic philosophy readings, journal reflections, meditation.',
      status: 'archived',
      icon: 'BookOpen',
      color: '#ffb98f',
      template_key: 'learning',
      template_type: 'learning',
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockPlans = [
    {
      id: 'plan-1',
      track_id: 'track-1',
      user_id: 'usr-athlete-1',
      name: 'Half Marathon Arc',
      description: '12-week progression program targeting sub-1:45 finish with progressive weekly mileage buildup.',
      status: 'active',
      start_date: getDayStr(-21),
      end_date: getDayStr(63),
      created_at: new Date(Date.now() - 21 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'plan-2',
      track_id: 'track-2',
      user_id: 'usr-athlete-1',
      name: 'Q4 Systems Architecture Sprint',
      description: 'Complete architecture design documents and production review checklists.',
      status: 'active',
      start_date: getDayStr(-7),
      end_date: getDayStr(28),
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockItems = [
    {
      id: 'item-habit-1',
      plan_id: 'plan-1',
      track_id: 'track-1',
      user_id: 'usr-athlete-1',
      name: 'Morning Hydration & Dynamic Mobility Stretch',
      description: '20 minutes hip and ankle mobility before running',
      type: 'habit',
      status: 'todo',
      priority: 'high',
      target_count: 1,
      current_count: 0,
      unit: null,
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      schedule: {
        id: 'sched-1',
        item_id: 'item-habit-1',
        frequency: 'daily',
        days_of_week: null,
        time_of_day: 'morning',
        created_at: new Date().toISOString(),
      },
    },
    {
      id: 'item-habit-2',
      plan_id: 'plan-1',
      track_id: 'track-1',
      user_id: 'usr-athlete-1',
      name: 'Zone-2 Base Aerobic Run',
      description: 'Keep heart rate in zone 2 (135-145 bpm)',
      type: 'habit',
      status: 'todo',
      priority: 'urgent',
      target_count: 10,
      current_count: 6,
      unit: 'km',
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      schedule: {
        id: 'sched-2',
        item_id: 'item-habit-2',
        frequency: 'custom',
        days_of_week: [1, 3, 5], // Mon, Wed, Fri
        time_of_day: 'morning',
        created_at: new Date().toISOString(),
      },
    },
    {
      id: 'item-task-1',
      plan_id: 'plan-1',
      track_id: 'track-1',
      user_id: 'usr-athlete-1',
      name: 'Schedule Sports Physio Assessment',
      description: 'Biomechanical gait analysis and footwear recommendation',
      type: 'task',
      status: 'todo',
      priority: 'urgent',
      due_date: todayStr,
      target_count: 1,
      current_count: 0,
      unit: null,
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'item-task-2',
      plan_id: 'plan-1',
      track_id: 'track-1',
      user_id: 'usr-athlete-1',
      name: 'Order Electrolyte Replenishment Packets',
      description: 'High sodium formula for long weekend run',
      type: 'task',
      status: 'todo',
      priority: 'high',
      due_date: getDayStr(-2), // Overdue
      target_count: 1,
      current_count: 0,
      unit: null,
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'item-check-1',
      plan_id: 'plan-1',
      track_id: 'track-1',
      user_id: 'usr-athlete-1',
      name: 'Inspect Running Shoe Outsole Wear',
      description: 'Ensure tread has adequate traction',
      type: 'checklist',
      status: 'todo',
      priority: 'low',
      due_date: null,
      target_count: 1,
      current_count: 0,
      unit: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'item-proj-1',
      plan_id: 'plan-1',
      track_id: 'track-1',
      user_id: 'usr-athlete-1',
      name: 'Race Day Nutrition & Pacing Blueprint',
      description: 'Kilometer-by-kilometer gel timing and target heart rates',
      type: 'project',
      status: 'todo',
      priority: 'medium',
      due_date: getDayStr(14),
      target_count: 1,
      current_count: 0,
      unit: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'item-mile-1',
      plan_id: 'plan-1',
      track_id: 'track-1',
      user_id: 'usr-athlete-1',
      name: 'First 15km Continuous Long Run',
      description: 'Sub-90 minute benchmark without stopping',
      type: 'milestone',
      status: 'done',
      priority: 'high',
      due_date: getDayStr(-5),
      target_count: 1,
      current_count: 1,
      unit: null,
      created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  ];

  const mockCompletions = [
    { id: 'c-1', item_id: 'item-habit-1', user_id: 'usr-athlete-1', completed_date: threeDaysAgoStr },
    { id: 'c-2', item_id: 'item-habit-1', user_id: 'usr-athlete-1', completed_date: twoDaysAgoStr },
    { id: 'c-3', item_id: 'item-habit-1', user_id: 'usr-athlete-1', completed_date: yesterdayStr },
    { id: 'c-4', item_id: 'item-habit-2', user_id: 'usr-athlete-1', completed_date: getDayStr(-4) },
    { id: 'c-5', item_id: 'item-habit-2', user_id: 'usr-athlete-1', completed_date: getDayStr(-2) },
  ];

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

    cdp = new CdpClient(wsUrl);
    await cdp.connect();
    console.log('✓ Connected to headless Chrome via CDP.\n');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: '*supabase.co/*' }],
    });

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
            access_token: 'valid-test-jwt-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'valid-test-refresh',
            user: mockUser,
          };
        } else if (reqPath.includes('/rest/v1/track_now_profiles')) {
          bodyObj = [
            {
              id: mockUser.id,
              display_name: 'Marathon Athlete',
              full_name: 'Marathon Athlete',
              email: mockUser.email,
              avatar_url: null,
              theme_preference: 'light',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
          if (acceptHeader.includes('application/vnd.pgrst.object+json')) {
            bodyObj = bodyObj[0];
          }
        } else if (reqPath.includes('/rest/v1/track_now_tracks')) {
          if (url.searchParams.get('id') === 'eq.track-1' && acceptHeader.includes('application/vnd.pgrst.object+json')) {
            bodyObj = mockTracks[0];
          } else {
            bodyObj = mockTracks;
          }
        } else if (reqPath.includes('/rest/v1/track_now_track_templates')) {
          bodyObj = [
            {
              key: 'fitness',
              template_type: 'fitness',
              name: 'Fitness',
              description: 'Physical health, routines, workouts, sleep, and nutrition.',
              icon: 'Activity',
              color: '#c8f169',
              suggested_areas: ['Endurance', 'Strength', 'Mobility', 'Nutrition', 'Sleep'],
              default_items: [
                { title: 'Morning hydration & mobility', type: 'habit' },
                { title: 'Baseline physical assessment', type: 'milestone' },
              ],
            },
            {
              key: 'career',
              template_type: 'career',
              name: 'Career',
              description: 'Professional excellence, high-leverage output, and strategic growth.',
              icon: 'Briefcase',
              color: '#b9a7ff',
              suggested_areas: ['Output', 'Architecture', 'Strategy'],
              default_items: [],
            },
            {
              key: 'finance',
              template_type: 'finance',
              name: 'Finance',
              description: 'Capital allocation, budgeting, and financial runway.',
              icon: 'Wallet',
              color: '#9eeccd',
              suggested_areas: ['Budget', 'Savings', 'Investments'],
              default_items: [],
            },
          ];
        } else if (reqPath.includes('/rest/v1/track_now_plans')) {
          if (url.searchParams.get('id') === 'eq.plan-1' && acceptHeader.includes('application/vnd.pgrst.object+json')) {
            bodyObj = mockPlans[0];
          } else {
            bodyObj = mockPlans;
          }
        } else if (reqPath.includes('/rest/v1/track_now_execution_items')) {
          if (method === 'GET') {
            const single = acceptHeader.includes('application/vnd.pgrst.object+json');
            const idParam = url.searchParams.get('id');
            if (idParam) {
              const targetId = idParam.replace('eq.', '');
              const item = mockItems.find((i) => i.id === targetId);
              bodyObj = single ? item : [item];
            } else {
              bodyObj = mockItems;
            }
          }
        } else if (reqPath.includes('/rest/v1/track_now_item_completions')) {
          if (method === 'GET') {
            const dateParam = url.searchParams.get('completed_date');
            if (dateParam && dateParam.includes(todayStr)) {
              bodyObj = [];
            } else {
              bodyObj = mockCompletions;
            }
          }
        } else {
          bodyObj = [];
        }

        await cdp.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: statusCode,
          responseHeaders: [
            { name: 'Access-Control-Allow-Origin', value: '*' },
            { name: 'Content-Type', value: 'application/json' },
          ],
          body: Buffer.from(JSON.stringify(bodyObj)).toString('base64'),
        });
      } catch (err) {
        console.error('Fetch mock error:', err);
        await cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' });
      }
    });

    async function navigateAndWait(url) {
      await cdp.send('Page.navigate', { url });
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 150));
        const readyState = await cdp.eval('document.readyState');
        const hasRoot = await cdp.eval('Boolean(document.getElementById("root"))');
        if (readyState === 'complete' && hasRoot) return;
      }
    }

    // Helper: evaluate element bounds & responsive issues
    async function inspectDomIssues() {
      return await cdp.eval(`(() => {
        const issues = [];
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // Check document-level overflow
        const docScrollW = document.documentElement.scrollWidth;
        if (docScrollW > winW) {
          issues.push({
            type: 'HORIZONTAL_OVERFLOW',
            message: \`Document scrollWidth (\${docScrollW}px) exceeds window width (\${winW}px)\`
          });
        }

        // Check clipped / overflowing elements
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          const rect = el.getBoundingClientRect();
          
          // Check right edge overflow
          if (rect.right > winW + 1 && el.clientWidth > 0 && !['svg', 'path'].includes(el.tagName.toLowerCase())) {
            const style = window.getComputedStyle(el);
            const parentStyle = el.parentElement ? window.getComputedStyle(el.parentElement) : null;
            if (style.overflowX !== 'auto' && style.overflowX !== 'scroll' && (!parentStyle || (parentStyle.overflowX !== 'auto' && parentStyle.overflowX !== 'scroll'))) {
              issues.push({
                type: 'ELEMENT_OVERFLOW',
                tag: el.tagName,
                className: el.className,
                rectRight: rect.right,
                winW,
                message: \`Element \${el.tagName}.\${el.className} right edge (\${Math.round(rect.right)}px) overflows viewport (\${winW}px)\`
              });
            }
          }

          // Check interactive button touch target sizes (< 32px height or width)
          if (['button', 'a'].includes(el.tagName.toLowerCase()) || el.getAttribute('role') === 'button') {
            if (rect.width > 0 && rect.height > 0 && (rect.width < 28 || rect.height < 28)) {
              issues.push({
                type: 'SMALL_TOUCH_TARGET',
                tag: el.tagName,
                className: el.className,
                text: (el.textContent || '').slice(0, 30).trim(),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                message: \`Touch target too small: \${el.tagName}.\${el.className} is \${Math.round(rect.width)}x\${Math.round(rect.height)}px\`
              });
            }
          }
        }

        return issues;
      })()`);
    }

    const viewports = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920];
    const screenshotViewports = [320, 375, 768, 1280];

    const testSession = {
      access_token: 'valid-test-jwt-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'valid-test-refresh',
      user: mockUser,
    };

    // Audit Suite: List of routes and states
    const routesToTest = [
      { name: 'Landing', url: 'http://127.0.0.1:5183/' },
      { name: 'Login', url: 'http://127.0.0.1:5184/login' },
      { name: 'Signup', url: 'http://127.0.0.1:5184/signup' },
      { name: 'Dashboard', url: 'http://127.0.0.1:5184/dashboard' },
      { name: 'Tracks', url: 'http://127.0.0.1:5184/tracks' },
      { name: 'NewTrack', url: 'http://127.0.0.1:5184/tracks/new' },
      { name: 'TrackDetail', url: 'http://127.0.0.1:5184/tracks/track-1' },
      { name: 'NewPlan', url: 'http://127.0.0.1:5184/tracks/track-1/plans/new' },
      { name: 'PlanDetail_Overview', url: 'http://127.0.0.1:5184/plans/plan-1' },
      { name: 'Today', url: 'http://127.0.0.1:5184/today' },
      { name: 'Reviews', url: 'http://127.0.0.1:5184/reviews' },
      { name: 'Analytics', url: 'http://127.0.0.1:5184/analytics' },
      { name: 'Settings', url: 'http://127.0.0.1:5184/settings' },
      { name: 'NotFound', url: 'http://127.0.0.1:5184/some-invalid-route-404' },
    ];

    const report = {
      findings: [],
      inspected: [],
    };

    const outDir = path.resolve(__dirname, '../audit_screenshots/after');
    fs.mkdirSync(outDir, { recursive: true });

    for (const r of routesToTest) {
      console.log(`\n========================================`);
      console.log(`AUDITING ROUTE: ${r.name} (${r.url})`);
      console.log(`========================================`);

      if (r.name === 'Login' || r.name === 'Signup') {
        await cdp.eval(`(() => {
          localStorage.removeItem('sb-bjejovuayqtxqhevvvuu-auth-token');
          localStorage.setItem('tracknow-theme', 'light');
        })()`);
      } else if (r.name !== 'Landing') {
        await cdp.eval(`(() => {
          localStorage.setItem('sb-bjejovuayqtxqhevvvuu-auth-token', JSON.stringify(${JSON.stringify(testSession)}));
          localStorage.setItem('tracknow-theme', 'light');
        })()`);
      }

      await navigateAndWait(r.url);
      await new Promise((res) => setTimeout(res, 400));

      // Test each viewport width
      for (const w of viewports) {
        await cdp.setViewport(w, 850);
        await new Promise((res) => setTimeout(res, 150));

        const issues = await inspectDomIssues();
        const overflowIssue = issues.find((i) => i.type === 'HORIZONTAL_OVERFLOW');
        const elementOverflows = issues.filter((i) => i.type === 'ELEMENT_OVERFLOW');
        const touchIssues = issues.filter((i) => i.type === 'SMALL_TOUCH_TARGET');

        if (overflowIssue || elementOverflows.length > 0 || touchIssues.length > 0) {
          report.findings.push({
            route: r.name,
            viewport: w,
            overflowIssue,
            elementOverflows: elementOverflows.slice(0, 3),
            touchIssues: touchIssues.slice(0, 3),
          });
          console.log(`  [!] ${w}px issues: docOverflow=${Boolean(overflowIssue)}, elOverflows=${elementOverflows.length}, smallTouch=${touchIssues.length}`);
          if (elementOverflows.length > 0) {
            console.log(`      First elOverflow: ${elementOverflows[0].message}`);
          }
          if (touchIssues.length > 0) {
            console.log(`      First smallTouch: ${touchIssues[0].message}`);
          }
        } else {
          console.log(`  ✓ ${w}px: Clean layout, no overflow, good touch targets`);
        }

        // Capture screenshot at sample viewports
        if (screenshotViewports.includes(w)) {
          const imgName = `${r.name}_${w}px_light.png`;
          await cdp.captureScreenshot(path.join(outDir, imgName));
        }

        report.inspected.push({ route: r.name, viewport: w });
      }

      // Check dark mode at 375px and 1280px
      for (const w of [375, 1280]) {
        await cdp.setViewport(w, 850);
        await cdp.eval(`document.documentElement.setAttribute('data-theme', 'dark')`);
        await new Promise((res) => setTimeout(res, 150));
        await cdp.captureScreenshot(path.join(outDir, `${r.name}_${w}px_dark.png`));
        // Reset to light
        await cdp.eval(`document.documentElement.setAttribute('data-theme', 'light')`);
      }
    }

    // Now test special UI states:
    // 1. PlanDetail Habits tab (heatmap)
    console.log(`\n--- Auditing PlanDetail: Habits Tab ---`);
    await navigateAndWait('http://127.0.0.1:5184/plans/plan-1');
    await cdp.eval(`document.querySelector('#tab-habits')?.click()`);
    await new Promise((res) => setTimeout(res, 300));
    for (const w of screenshotViewports) {
      await cdp.setViewport(w, 850);
      await cdp.captureScreenshot(path.join(outDir, `PlanDetail_HabitsTab_${w}px_light.png`));
    }
    // Dark mode on Habits Tab
    await cdp.setViewport(375, 850);
    await cdp.eval(`document.documentElement.setAttribute('data-theme', 'dark')`);
    await cdp.captureScreenshot(path.join(outDir, `PlanDetail_HabitsTab_375px_dark.png`));
    await cdp.setViewport(1280, 850);
    await cdp.captureScreenshot(path.join(outDir, `PlanDetail_HabitsTab_1280px_dark.png`));

    // 2. Modals: CreateItemModal
    console.log(`\n--- Auditing CreateItemModal ---`);
    await cdp.eval(`document.documentElement.setAttribute('data-theme', 'light')`);
    await cdp.eval(`document.querySelector('button[title*="Add Item"]')?.click() || document.querySelectorAll('button').forEach(b => b.textContent.includes('Add Item') && b.click())`);
    await new Promise((res) => setTimeout(res, 300));
    for (const w of [320, 375, 768, 1280]) {
      await cdp.setViewport(w, 850);
      await cdp.captureScreenshot(path.join(outDir, `Modal_CreateItem_${w}px.png`));
    }

    console.log('\n========================================');
    console.log('AUDIT RUN COMPLETE. Total findings recorded:', report.findings.length);
    console.log('========================================');

    fs.writeFileSync(path.resolve(__dirname, '../audit_findings.json'), JSON.stringify(report, null, 2));

    cdp.close();
  } finally {
    chromeProc.kill();
    landingServer.close();
    appServer.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

runAudit().catch((err) => {
  console.error('\n❌ AUDIT SCRIPT FAILED:', err);
  process.exit(1);
});

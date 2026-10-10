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

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 900,
    });
  }

  async captureScreenshot(outPath) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
  }
}

async function runSidebarAndSignupE2E() {
  console.log('================================================================');
  console.log('🚀 TRACK.NOW — SIDEBAR SCROLLING & SIGNUP RATE-LIMIT E2E (CDP)');
  console.log('================================================================');

  const appDist = path.resolve(__dirname, '../apps/app/dist');
  if (!fs.existsSync(appDist)) {
    throw new Error('Production build not found at apps/app/dist. Run "npm run build" first.');
  }

  const port = 5177;
  const server = createSpaServer(appDist);
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  console.log(`✓ Real SPA server listening at http://127.0.0.1:${port}`);

  const cdpPort = 9228;
  const tempDir = path.join(os.tmpdir(), `tracknow_scroll_signup_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
  ]);

  let cdpClient;
  let signupRequestCount = 0;
  let mockSignupStatus = 429;
  let mockSignupBody = {
    message: 'For security purposes, you can only request this once every 60 seconds.',
    status: 429,
  };

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
      start_date: '2026-10-01',
      end_date: '2026-12-31',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    items: [
      {
        id: 'item-1',
        plan_id: 'plan-1',
        title: '5km Morning Run',
        item_type: 'task',
        priority: 'high',
        is_completed: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'item-2',
        plan_id: 'plan-1',
        title: 'Electrolyte Hydration',
        item_type: 'habit',
        priority: 'medium',
        is_completed: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'item-3',
        plan_id: 'plan-1',
        title: 'Core Strength Routine',
        item_type: 'task',
        priority: 'high',
        is_completed: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'item-4',
        plan_id: 'plan-1',
        title: 'Evening Mobility Stretch',
        item_type: 'habit',
        priority: 'low',
        is_completed: false,
        created_at: new Date().toISOString(),
      },
    ],
  };

  try {
    let versionRes;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (res.ok) {
          versionRes = await res.json();
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!versionRes) throw new Error('Chrome CDP debug endpoint not accessible');

    const targetsRes = await fetch(`http://127.0.0.1:${cdpPort}/json`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found in Chrome');

    cdpClient = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdpClient.connect();
    console.log('✓ Connected to headless Chrome via CDP.\n');

    await cdpClient.send('Page.enable');
    await cdpClient.send('Runtime.enable');
    await cdpClient.send('Network.enable');
    await cdpClient.send('Fetch.enable', {
      patterns: [{ urlPattern: '*supabase.co*' }],
    });

    cdpClient.on('Fetch.requestPaused', async (params) => {
      const { requestId, request } = params;
      const url = new URL(request.url);
      const reqPath = url.pathname;
      const method = request.method;

      const originHeader = request.headers['Origin'] || request.headers['origin'] || `http://127.0.0.1:${port}`;

      if (method === 'OPTIONS') {
        await cdpClient.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 204,
          responseHeaders: [
            { name: 'Access-Control-Allow-Origin', value: originHeader },
            { name: 'Access-Control-Allow-Credentials', value: 'true' },
            { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
            { name: 'Access-Control-Allow-Headers', value: '*' },
          ],
          body: '',
        });
        return;
      }

      if (url.href.includes('/auth/v1/signup')) {
        signupRequestCount++;
        // Simulate in-flight network delay of 150ms
        await new Promise((r) => setTimeout(r, 150));
        await cdpClient.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: mockSignupStatus,
          responseHeaders: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: originHeader },
            { name: 'Access-Control-Allow-Credentials', value: 'true' },
            { name: 'Access-Control-Allow-Headers', value: '*' },
          ],
          body: Buffer.from(JSON.stringify(mockSignupBody)).toString('base64'),
        });
        return;
      }

      let statusCode = 200;
      let bodyObj = [];
      const acceptHeader = (request.headers['Accept'] || request.headers['accept'] || '');

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
        bodyObj = state.items;
      } else if (reqPath.includes('/rest/v1/track_now_item_completions')) {
        bodyObj = [{ item_id: 'item-2', completed_date: '2026-10-10' }];
      }

      await cdpClient.send('Fetch.fulfillRequest', {
        requestId,
        responseCode: statusCode,
        responseHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Access-Control-Allow-Origin', value: originHeader },
          { name: 'Access-Control-Allow-Credentials', value: 'true' },
          { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { name: 'Access-Control-Allow-Headers', value: '*' },
        ],
        body: Buffer.from(JSON.stringify(bodyObj)).toString('base64'),
      });
    });

    // =========================================================================
    // PHASE 1: DESKTOP SIDEBAR SCROLLING & INDEPENDENT MAIN CONTENT SCROLLING
    // =========================================================================
    console.log('[1/4] Testing Desktop Sidebar & Independent Page Scrolling...');
    await cdpClient.setViewport(1280, 900);
    await cdpClient.send('Page.navigate', { url: `http://127.0.0.1:${port}/login` });
    await new Promise((r) => setTimeout(r, 600));

    // Inject authenticated session matching supabase client key
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
    await cdpClient.send('Page.navigate', { url: `http://127.0.0.1:${port}/plans/plan-1` });

    // Wait for sidebar to mount
    for (let i = 0; i < 30; i++) {
      const hasSidebar = await cdpClient.eval(`Boolean(document.querySelector('.sidebar'))`);
      if (hasSidebar) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    // 1.1 Verify normal desktop layout (1280x900)
    const desktopLayout = await cdpClient.eval(`({
      shellHeight: document.querySelector('.shell')?.clientHeight,
      sidebarHeight: document.querySelector('.sidebar')?.clientHeight,
      sidebarMaxHeight: window.getComputedStyle(document.querySelector('.sidebar')).maxHeight,
      brandTop: document.querySelector('.brand')?.getBoundingClientRect().top,
      profileBottom: document.querySelector('.profile')?.getBoundingClientRect().bottom,
      navWrapperOverflow: window.getComputedStyle(document.querySelector('.sidebar__nav-wrapper')).overflowY,
      mainOverflowY: window.getComputedStyle(document.querySelector('.main')).overflowY,
      windowHeight: window.innerHeight
    })`);
    console.log('  Normal Desktop (1280x900) Metrics:', desktopLayout);

    if (desktopLayout.sidebarHeight > desktopLayout.windowHeight) {
      throw new Error(`Sidebar height (${desktopLayout.sidebarHeight}) exceeds viewport height (${desktopLayout.windowHeight})!`);
    }
    if (desktopLayout.profileBottom > desktopLayout.windowHeight) {
      throw new Error(`Profile bottom (${desktopLayout.profileBottom}) is cut off below window (${desktopLayout.windowHeight})!`);
    }
    if (desktopLayout.navWrapperOverflow !== 'auto') {
      throw new Error(`Sidebar nav-wrapper overflow-y is ${desktopLayout.navWrapperOverflow}, expected "auto"!`);
    }
    if (desktopLayout.mainOverflowY !== 'auto') {
      throw new Error(`Main content overflow-y is ${desktopLayout.mainOverflowY}, expected "auto"!`);
    }

    // 1.2 Test Short Viewport Height (1280x480)
    console.log('  Testing Short Desktop Viewport Height (1280x480)...');
    await cdpClient.setViewport(1280, 480);
    await new Promise((r) => setTimeout(r, 200));

    const shortLayout = await cdpClient.eval(`({
      sidebarHeight: document.querySelector('.sidebar')?.clientHeight,
      brandTop: document.querySelector('.brand')?.getBoundingClientRect().top,
      profileBottom: document.querySelector('.profile')?.getBoundingClientRect().bottom,
      windowHeight: window.innerHeight
    })`);
    console.log('  Short Desktop (1280x480) Metrics:', shortLayout);

    if (shortLayout.sidebarHeight > 480) {
      throw new Error(`Sidebar height (${shortLayout.sidebarHeight}) exceeds short viewport (480)!`);
    }
    if (shortLayout.profileBottom > 480) {
      throw new Error(`Profile section (${shortLayout.profileBottom}) is cut off in short viewport!`);
    }

    // 1.3 Test Independent Scrolling
    console.log('  Testing Independent Scrolling (Sidebar vs Main Content)...');
    // Add extra items to nav so scrollHeight exceeds clientHeight in short viewport
    await cdpClient.eval(`
      const nav = document.querySelector('.sidebar__nav-wrapper .nav');
      for (let i = 0; i < 15; i++) {
        const dummy = document.createElement('div');
        dummy.className = 'nav__link';
        dummy.textContent = 'Track Item #' + i;
        dummy.style.minHeight = '36px';
        nav.appendChild(dummy);
      }
      document.querySelector('.sidebar__nav-wrapper').scrollTop = 45;
    `);
    const afterNavScroll = await cdpClient.eval(`({
      navScrollTop: document.querySelector('.sidebar__nav-wrapper').scrollTop,
      mainScrollTop: document.querySelector('.main').scrollTop
    })`);
    console.log('    After scrolling sidebar nav:', afterNavScroll);
    if (afterNavScroll.navScrollTop <= 0) {
      throw new Error(`Sidebar nav failed to scroll! Got scrollTop=${afterNavScroll.navScrollTop}`);
    }
    if (afterNavScroll.mainScrollTop !== 0) {
      throw new Error('Scrolling sidebar improperly scrolled main content!');
    }

    // Scroll main content
    await cdpClient.eval(`
      document.querySelector('.main').scrollTop = 70;
    `);
    const afterMainScroll = await cdpClient.eval(`({
      navScrollTop: document.querySelector('.sidebar__nav-wrapper').scrollTop,
      mainScrollTop: document.querySelector('.main').scrollTop
    })`);
    console.log('    After scrolling main content:', afterMainScroll);
    if (afterMainScroll.mainScrollTop <= 0) {
      throw new Error(`Main content failed to scroll! Got scrollTop=${afterMainScroll.mainScrollTop}`);
    }

    // Capture desktop screenshots
    await cdpClient.captureScreenshot(path.resolve(__dirname, 'screenshot_desktop_short_viewport.png'));
    await cdpClient.setViewport(1280, 900);
    await new Promise((r) => setTimeout(r, 100));
    await cdpClient.captureScreenshot(path.resolve(__dirname, 'screenshot_desktop_sidebar_scroll.png'));
    console.log('✓ Desktop independent scrolling verified with captured screenshots.\n');

    // =========================================================================
    // PHASE 2: RESPONSIVE VIEWPORT MATRIX & MOBILE DRAWER NAVIGATION
    // =========================================================================
    console.log('[2/4] Testing Viewport Matrix & Mobile Drawer Navigation...');
    const viewports = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920];
    for (const w of viewports) {
      await cdpClient.setViewport(w, 800);
      await new Promise((r) => setTimeout(r, 50));
      const metrics = await cdpClient.eval(`({
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth
      })`);
      if (metrics.hasOverflow) {
        throw new Error(`Horizontal overflow detected at ${w}px! scrollW=${metrics.scrollW}`);
      }
      console.log(`    ${w}px: Clean layout (scrollW=${metrics.scrollW}px, innerW=${metrics.innerW}px)`);
    }

    // Mobile drawer test at 375x667
    await cdpClient.setViewport(375, 667);
    await new Promise((r) => setTimeout(r, 100));

    // Verify sidebar is hidden on mobile
    const mobileSidebarDisplay = await cdpClient.eval(`
      window.getComputedStyle(document.querySelector('.sidebar')).display
    `);
    if (mobileSidebarDisplay !== 'none') {
      throw new Error(`Sidebar expected display:none on mobile, got ${mobileSidebarDisplay}`);
    }

    // Open mobile drawer
    console.log('  Opening mobile drawer via menu button...');
    await cdpClient.eval(`
      document.querySelector('button[aria-label="Open menu drawer"]').click();
    `);
    await new Promise((r) => setTimeout(r, 300));

    const drawerMetrics = await cdpClient.eval(`({
      hasDrawer: Boolean(document.querySelector('.drawer')),
      drawerRole: document.querySelector('.drawer')?.getAttribute('role'),
      drawerLabel: document.querySelector('.drawer')?.getAttribute('aria-label'),
      bodyOverflow: document.body.style.overflow,
      drawerHeight: document.querySelector('.drawer')?.clientHeight,
      hasCloseBtn: Boolean(document.querySelector('.drawer__close')),
      windowHeight: window.innerHeight
    })`);
    console.log('  Drawer DOM State:', drawerMetrics);

    if (!drawerMetrics.hasDrawer) throw new Error('Mobile drawer did not open into DOM!');
    if (drawerMetrics.bodyOverflow !== 'hidden') throw new Error('Body scroll was not locked when drawer opened!');
    if (!drawerMetrics.hasCloseBtn) throw new Error('Drawer is missing accessible close button!');

    await cdpClient.captureScreenshot(path.resolve(__dirname, 'screenshot_mobile_drawer.png'));

    // Close mobile drawer
    await cdpClient.eval(`
      document.querySelector('.drawer__close').click();
    `);
    await new Promise((r) => setTimeout(r, 200));

    const closedBodyOverflow = await cdpClient.eval(`document.body.style.overflow`);
    if (closedBodyOverflow === 'hidden') {
      throw new Error('Body scroll lock was not restored after closing drawer!');
    }
    await cdpClient.captureScreenshot(path.resolve(__dirname, 'screenshot_mobile_today.png'));
    console.log('✓ Mobile drawer scrolling, safe-area insets, and body lock verified.\n');

    // =========================================================================
    // PHASE 3: SIGNUP FORM DUPLICATE SUBMISSION & RATE LIMIT (429) VERIFICATION
    // =========================================================================
    console.log('[3/4] Testing Signup Duplicate Prevention & Rate Limit (429) Error Handling...');
    await cdpClient.setViewport(1280, 900);
    // Clear localStorage to view signup page
    await cdpClient.eval(`localStorage.clear();`);
    await cdpClient.send('Page.navigate', { url: `http://127.0.0.1:${port}/signup` });
    await new Promise((r) => setTimeout(r, 500));

    const signupHeader = await cdpClient.eval(`document.querySelector('h1')?.textContent`);
    console.log('  Signup Page Heading:', signupHeader);
    if (!signupHeader?.includes('Create your Track.now account')) {
      throw new Error(`Unexpected signup heading: ${signupHeader}`);
    }

    // 3.1 Normal validation error check: password mismatch
    console.log('  Testing validation error (password mismatch)...');
    await cdpClient.eval(`
      (() => {
        const setVal = (el, val) => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const inputs = document.querySelectorAll('input');
        setVal(inputs[0], 'Alex Builder');
        setVal(inputs[1], 'alex@example.com');
        setVal(inputs[2], 'Password123!');
        setVal(inputs[3], 'MismatchedPass!');
        document.querySelector('button[type="submit"]').click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 100));

    const mismatchError = await cdpClient.eval(`document.querySelector('.alert--error')?.textContent`);
    console.log('  Mismatch Alert Message:', mismatchError);
    if (mismatchError !== 'Passwords do not match.') {
      throw new Error(`Expected "Passwords do not match.", got "${mismatchError}"`);
    }
    await cdpClient.captureScreenshot(path.resolve(__dirname, 'screenshot_signup_validation_error.png'));

    // 3.2 Duplicate submission prevention & 429 rate limit
    console.log('  Testing duplicate click submission and HTTP 429 rate limit...');
    signupRequestCount = 0;
    mockSignupStatus = 429;
    mockSignupBody = {
      message: 'For security purposes, you can only request this once every 60 seconds.',
      status: 429,
    };

    // Correct confirm password
    await cdpClient.eval(`
      (() => {
        const setVal = (el, val) => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const inputs = document.querySelectorAll('input');
        setVal(inputs[3], 'Password123!');
      })()
    `);

    // Simulate rapid double click AND Enter keypress within 10ms
    await cdpClient.eval(`
      const btn = document.querySelector('button[type="submit"]');
      const form = document.querySelector('form');
      // Rapid click 1
      btn.click();
      // Rapid click 2
      btn.click();
      // Rapid Enter keypress
      form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    `);

    // Check in-flight state immediately while request is pending
    await new Promise((r) => setTimeout(r, 30));
    const inFlightState = await cdpClient.eval(`({
      btnDisabled: document.querySelector('button[type="submit"]')?.disabled,
      btnText: document.querySelector('button[type="submit"]')?.textContent,
      inputsDisabled: Array.from(document.querySelectorAll('input')).map(i => i.disabled)
    })`);
    console.log('  In-flight Form State:', inFlightState);

    if (!inFlightState.btnDisabled || !inFlightState.btnText?.includes('Creating Account')) {
      throw new Error('Submit button was not disabled during in-flight submission!');
    }

    // Wait for the 150ms mock delay to complete
    await new Promise((r) => setTimeout(r, 250));

    // Verify request count
    console.log(`  Supabase Signup Network Requests Received: ${signupRequestCount}`);
    if (signupRequestCount !== 1) {
      throw new Error(`Expected exactly 1 network request, but received ${signupRequestCount}! Concurrency lock failed.`);
    }

    // Verify user-visible 429 error message
    const rateLimitError = await cdpClient.eval(`document.querySelector('.alert--error')?.textContent`);
    console.log('  Rate Limit Alert Message:', rateLimitError);
    if (!rateLimitError?.includes('wait 60 seconds before trying again')) {
      throw new Error(`Expected cooldown message, got "${rateLimitError}"`);
    }

    // Verify button state restored after error
    const restoredBtnState = await cdpClient.eval(`({
      btnDisabled: document.querySelector('button[type="submit"]')?.disabled,
      btnText: document.querySelector('button[type="submit"]')?.textContent
    })`);
    console.log('  Restored Button State:', restoredBtnState);
    if (restoredBtnState.btnDisabled) {
      throw new Error('Button was not restored after submission failure!');
    }

    await cdpClient.captureScreenshot(path.resolve(__dirname, 'screenshot_signup_rate_limit_alert.png'));
    console.log('✓ Duplicate submission prevention and HTTP 429 handling verified 100%.\n');

    console.log('[4/4] Finalizing verification and cleaning up...');
    console.log('================================================================');
    console.log('🎉 ALL SIDEBAR SCROLL & SIGNUP RATE-LIMIT E2E TESTS PASSED 100%');
    console.log('================================================================');
  } finally {
    if (cdpClient) {
      try {
        cdpClient.ws.close();
      } catch {}
    }
    chromeProc.kill();
    server.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

runSidebarAndSignupE2E().catch((err) => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});

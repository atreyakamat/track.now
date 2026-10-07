const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Static server for landing & app
function createStaticServer(distDir, isSpa) {
  return http.createServer((req, res) => {
    let filePath = path.join(distDir, req.url.split('?')[0]);
    if (filePath.endsWith(path.sep) || req.url === '/') {
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

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
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

  close() {
    this.ws.close();
  }
}

async function getWsUrl(port) {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await res.json();
      if (list && list.length > 0) {
        const page = list.find((t) => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch (e) {
      // wait
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Chrome remote debugging did not become available.');
}

async function runAudit() {
  console.log('=== TRACK.NOW CHROME CDP MULTI-SITE VERIFICATION ===\n');

  // 1. Start servers
  const landingServer = createStaticServer(path.resolve(__dirname, '../apps/landing/dist'), false);
  const appServer = createStaticServer(path.resolve(__dirname, '../apps/app/dist'), true);

  await new Promise((r) => landingServer.listen(5173, '127.0.0.1', r));
  await new Promise((r) => appServer.listen(5174, '127.0.0.1', r));
  console.log('✓ Landing site static server listening at http://127.0.0.1:5173');
  console.log('✓ Application SPA server listening at http://127.0.0.1:5174\n');

  // 2. Launch headless Chrome
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    '--user-data-dir=' + path.resolve(__dirname, '../scratch_chrome_user_data'),
  ]);

  try {
    const wsUrl = await getWsUrl(9222);
    console.log('✓ Chrome CDP connected successfully.\n');
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    async function navigateAndWait(url) {
      await cdp.send('Page.navigate', { url });
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const readyState = await cdp.eval('document.readyState');
        const title = await cdp.eval('document.title');
        if (readyState === 'complete' && title) return;
      }
    }

    // ----------------------------------------------------
    // VERIFY LANDING SITE
    // ----------------------------------------------------
    console.log('--- 1. VERIFYING LANDING SITE (apps/landing) ---');
    await navigateAndWait('http://127.0.0.1:5173/');

    const landingTitle = await cdp.eval('document.title');
    console.log('  Page Title:', landingTitle);
    if (!landingTitle.includes('Track.now')) throw new Error('Invalid landing title');

    const heroHeading = await cdp.eval('document.querySelector(".landing__hero-title")?.textContent');
    console.log('  Hero Heading:', heroHeading);
    if (heroHeading !== 'Your life, organized to execute.') throw new Error('Invalid hero heading');

    // Verify CTAs
    const primaryCta = await cdp.eval('document.querySelector(".landing__btn-hero-primary")?.href');
    console.log('  Primary CTA Link:', primaryCta);
    if (!primaryCta.includes('trackapp.atreyakamat.dev/signup')) {
      throw new Error(`Expected CTA to link to trackapp.atreyakamat.dev/signup, got: ${primaryCta}`);
    }

    const signInCta = await cdp.eval('document.querySelector(".landing__nav-actions a[href*=\\"login\\"]")?.href');
    console.log('  Sign In CTA Link:', signInCta);
    if (!signInCta.includes('trackapp.atreyakamat.dev/login')) {
      throw new Error(`Expected Sign In to link to trackapp.atreyakamat.dev/login, got: ${signInCta}`);
    }

    // Verify Theme Switcher
    const initialTheme = await cdp.eval('document.documentElement.getAttribute("data-theme")');
    console.log('  Initial Theme:', initialTheme);
    await cdp.eval('document.querySelector(".btn--icon")?.click()');
    await new Promise((r) => setTimeout(r, 200));
    const toggledTheme = await cdp.eval('document.documentElement.getAttribute("data-theme")');
    console.log('  Toggled Theme:', toggledTheme);
    if (initialTheme === toggledTheme) throw new Error('Theme toggle did not change data-theme');

    // Verify Interactive Preview Tabs & Checkbox
    const initialPercent = await cdp.eval('document.querySelector("#preview .badge--accent")?.textContent');
    console.log('  Initial Demo Progress Badge:', initialPercent);
    // Click uncompleted task in demo
    await cdp.eval('document.querySelectorAll("#preview .card")[1]?.click()');
    await new Promise((r) => setTimeout(r, 200));
    const updatedPercent = await cdp.eval('document.querySelector("#preview .badge--accent")?.textContent');
    console.log('  Updated Demo Progress Badge after check:', updatedPercent);
    if (initialPercent === updatedPercent) throw new Error('Demo interaction did not update telemetry');

    // Responsive Verification on Landing
    console.log('\n  Landing Responsive Checks (Horizontal Overflow):');
    const viewports = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920];
    for (const w of viewports) {
      await cdp.setViewport(w, 900);
      await new Promise((r) => setTimeout(r, 100));
      const overflow = await cdp.eval(`({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth
      })`);
      console.log(`    ${w}px: scrollWidth=${overflow.scrollWidth}, innerWidth=${overflow.innerWidth}, overflow=${overflow.hasOverflow}`);
      if (overflow.hasOverflow) {
        throw new Error(`Horizontal overflow detected at ${w}px on landing site!`);
      }
    }
    console.log('✓ Landing site responsive checks passed with ZERO overflow.\n');

    // ----------------------------------------------------
    // VERIFY APPLICATION SITE
    // ----------------------------------------------------
    console.log('--- 2. VERIFYING APPLICATION SITE (apps/app) ---');
    // Root / should redirect unauthenticated user to /login
    await navigateAndWait('http://127.0.0.1:5174/');
    // Wait for React Router and AuthProvider to resolve session and perform redirect
    for (let i = 0; i < 30; i++) {
      const p = await cdp.eval('window.location.pathname');
      if (p === '/login') break;
      await new Promise((r) => setTimeout(r, 100));
    }

    const currentUrl = await cdp.eval('window.location.pathname');
    console.log('  Access / redirects unauthenticated visitor to:', currentUrl);
    if (currentUrl !== '/login') {
      throw new Error(`Expected redirect to /login, but landed at: ${currentUrl}`);
    }

    const loginHeading = await cdp.eval('document.querySelector("h1")?.textContent');
    console.log('  Login Page Heading:', loginHeading);
    if (!loginHeading || !loginHeading.includes('Sign in to Track.now')) {
      throw new Error(`Invalid login page heading: ${loginHeading}`);
    }

    const backToLandingLink = await cdp.eval('document.querySelector("a[href*=\\"tracknow.atreyakamat.dev\\"]")?.href');
    console.log('  Back to Marketing Site link on Login:', backToLandingLink);
    if (!backToLandingLink || !backToLandingLink.includes('https://tracknow.atreyakamat.dev')) {
      throw new Error('Missing back-to-landing link on login page');
    }

    // Direct SPA Route Refresh checks
    console.log('\n  Direct SPA Route Navigation & Reload Tests:');
    const appRoutes = ['/login', '/signup', '/today', '/tracks', '/settings'];
    for (const route of appRoutes) {
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:5174${route}` });
      await new Promise((r) => setTimeout(r, 800));
      const hasRoot = await cdp.eval('Boolean(document.getElementById("root"))');
      const routeText = await cdp.eval('document.body.innerText.slice(0, 40).replace(/\\n/g, " ")');
      console.log(`    ${route}: SPA render success (hasRoot=${hasRoot}, snippet="${routeText}")`);
      if (!hasRoot) throw new Error(`Route ${route} failed to render application root`);
    }

    // Application Responsive Checks
    console.log('\n  Application Responsive Checks (Horizontal Overflow):');
    for (const w of viewports) {
      await cdp.setViewport(w, 900);
      await new Promise((r) => setTimeout(r, 100));
      const overflow = await cdp.eval(`({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth
      })`);
      console.log(`    ${w}px: scrollWidth=${overflow.scrollWidth}, innerWidth=${overflow.innerWidth}, overflow=${overflow.hasOverflow}`);
      if (overflow.hasOverflow) {
        throw new Error(`Horizontal overflow detected at ${w}px on application site!`);
      }
    }
    console.log('✓ Application responsive checks passed with ZERO overflow.\n');

    cdp.close();
    console.log('=== ALL CHROME CDP & RESPONSIVE VERIFICATIONS PASSED 100% ===');
  } finally {
    chromeProc.kill();
    landingServer.close();
    appServer.close();
    // remove scratch user data dir
    try {
      fs.rmSync(path.resolve(__dirname, '../scratch_chrome_user_data'), { recursive: true, force: true });
    } catch (e) {}
  }
}

runAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});

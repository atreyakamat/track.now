const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// 1. Static SPA Server for apps/app/dist
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

// 2. CDP Client with Fetch interception
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

async function runNumericBrowserE2E() {
  console.log('================================================================');
  console.log('🚀 TRACK.NOW — DEDICATED NUMERIC TARGETS BROWSER E2E TEST (CDP)');
  console.log('================================================================');

  const appDist = path.resolve(__dirname, '../apps/app/dist');
  if (!fs.existsSync(appDist)) {
    throw new Error('Production build not found at apps/app/dist. Run "npm run build" first.');
  }

  const port = 5175;
  const server = createSpaServer(appDist);
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  console.log(`✓ Real SPA server listening at http://127.0.0.1:${port}`);

  const cdpPort = 9227;
  const tempDir = path.join(os.tmpdir(), `tracknow_numeric_cdp_${Date.now()}`);
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

  // In-memory backend simulation for intercepted Supabase calls
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
    items: [],
    completions: [],
  };

  try {
    // Wait for Chrome CDP to be available
    let versionRes;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (res.ok) {
          versionRes = await res.json();
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (!versionRes) throw new Error('Could not connect to Chrome CDP port ' + cdpPort);

    // Get active page WebSocket URL (must be type: page, not extension)
    const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const pages = await listRes.json();
    let targetPage = pages.find((t) => t.type === 'page' && !t.url.startsWith('chrome-extension:'));
    if (!targetPage) {
      const newRes = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: 'PUT' });
      targetPage = await newRes.json();
    }
    const pageWsUrl = targetPage?.webSocketDebuggerUrl;
    if (!pageWsUrl) throw new Error('No target page available in Chrome.');

    cdpClient = new CdpClient(pageWsUrl);
    await cdpClient.connect();
    console.log('✓ Connected to headless Chrome via CDP.');

    await cdpClient.send('Page.enable');
    await cdpClient.send('Runtime.enable');
    cdpClient.on('Runtime.consoleAPICalled', (params) => {
      console.log('  [Browser Console]', params.type, params.args.map((a) => a.value || a.description).join(' '));
    });
    cdpClient.on('Runtime.exceptionThrown', (params) => {
      console.error('  [Browser Exception]', params.exceptionDetails.text, params.exceptionDetails.exception?.description);
    });
    await cdpClient.send('Fetch.enable', {
      patterns: [{ urlPattern: '*supabase.co/*' }],
    });

    // Handle Supabase Network Requests via CDP Fetch interception
    cdpClient.on('Fetch.requestPaused', async (params) => {
      const { requestId, request } = params;
      const url = new URL(request.url);
      const reqPath = url.pathname;
      const method = request.method;

      let statusCode = 200;
      let bodyObj = null;

      const acceptHeader = (request.headers['Accept'] || request.headers['accept'] || '');
      console.log(`  [Fetch] ${method} ${reqPath}?${url.search}`);

      if (method === 'OPTIONS') {
        await cdpClient.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 204,
          responseHeaders: [
            { name: 'Access-Control-Allow-Origin', value: '*' },
            { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
            { name: 'Access-Control-Allow-Headers', value: '*' },
          ],
          body: '',
        });
        return;
      }

      try {
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
          } else if (method === 'POST') {
            const rawBody = request.postData ? JSON.parse(request.postData) : {};
            const newItem = {
              id: `item-${Date.now()}`,
              user_id: state.user.id,
              plan_id: rawBody.plan_id || 'plan-1',
              track_id: rawBody.track_id || 'track-1',
              name: rawBody.name,
              title: rawBody.name,
              description: rawBody.description || null,
              type: rawBody.type || 'task',
              priority: rawBody.priority || 'medium',
              due_date: rawBody.due_date || null,
              target_count: rawBody.target_count ?? 1,
              current_count: rawBody.current_count ?? 0,
              unit: rawBody.unit || null,
              status: rawBody.status || 'todo',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              track_now_item_schedules: [],
            };
            state.items.push(newItem);
            bodyObj = newItem;
          } else if (method === 'PATCH') {
            const idParam = url.searchParams.get('id');
            const targetId = idParam ? idParam.replace('eq.', '') : '';
            const updates = request.postData ? JSON.parse(request.postData) : {};
            const item = state.items.find((i) => i.id === targetId);
            if (item) {
              Object.assign(item, updates, { updated_at: new Date().toISOString() });
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
              completed_date: raw.completed_date,
            });
            bodyObj = { id: 'comp-1' };
          } else if (method === 'DELETE') {
            const idParam = url.searchParams.get('item_id');
            const targetId = idParam ? idParam.replace('eq.', '') : '';
            state.completions = state.completions.filter((c) => c.item_id !== targetId);
            bodyObj = [];
          } else {
            bodyObj = state.completions;
          }
        } else if (reqPath.includes('/rest/v1/rpc/track_now_increment_item_count')) {
          const raw = request.postData ? JSON.parse(request.postData) : {};
          const item = state.items.find((i) => i.id === raw.p_item_id);
          if (item) {
            const delta = raw.p_delta || 0;
            const target = Math.max(1, item.target_count || 1);
            const newCount = Math.max(0, (item.current_count || 0) + delta);
            const willBeDone = newCount >= target;
            const wasDone = item.status === 'done';
            item.current_count = newCount;
            item.status = willBeDone ? 'done' : 'todo';
            item.updated_at = new Date().toISOString();
            if (willBeDone && !wasDone) {
              state.completions.push({
                id: `comp-${Date.now()}`,
                item_id: item.id,
                user_id: state.user.id,
                completed_date: raw.p_completed_date || '2026-10-08',
              });
            } else if (!willBeDone && wasDone) {
              state.completions = state.completions.filter((c) => c.item_id !== item.id);
            }
            bodyObj = item;
          } else {
            statusCode = 404;
            bodyObj = { message: 'Item not found' };
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

    // Step 1: Open app & seed session in localStorage
    console.log('\n[1/8] Injecting authentication session into real browser localStorage...');
    await cdpClient.send('Page.navigate', { url: `http://127.0.0.1:${port}/login` });
    await new Promise((r) => setTimeout(r, 1000));

    // Seed valid session matching supabase client key
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

    // Step 2: Navigate to Plan Detail page
    console.log('\n[2/8] Navigating to Plan Detail Page (/plans/plan-1)...');
    await cdpClient.send('Page.navigate', { url: `http://127.0.0.1:${port}/plans/plan-1` });
    await new Promise((r) => setTimeout(r, 2000));

    const currentUrl = await cdpClient.eval(`window.location.href`);
    console.log('✓ Current URL after navigation:', currentUrl);
    const bodyText = await cdpClient.eval(`document.body.innerText.substring(0, 200)`);
    console.log('✓ Body preview:', bodyText.replace(/\n+/g, ' '));

    const pageHeading = await cdpClient.eval(`document.querySelector('.page-header h1, h1')?.innerText`);
    console.log('✓ Rendered Plan Heading:', pageHeading);
    if (!pageHeading || !pageHeading.includes('Half Marathon Arc')) {
      throw new Error(`Expected plan heading "Half Marathon Arc", got: "${pageHeading}"`);
    }

    // Step 3: Open Create Item Modal and add item with Numeric Target
    console.log('\n[3/8] Opening CreateItemModal and configuring Numeric Target (5 km)...');
    await cdpClient.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Item'));
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Fill in modal inputs using React value setters
    await cdpClient.eval(`
      (() => {
        const setVal = (input, val) => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const modal = document.querySelector('.modal');
        const inputs = Array.from(modal.querySelectorAll('input'));
        
        // 1. Title input (placeholder includes '5km')
        const titleInput = inputs.find(i => i.placeholder.includes('5km') || i.labels?.[0]?.innerText.includes('Title'));
        if (titleInput) setVal(titleInput, '5km Morning Run');

        // 2. Target Quantity (number input)
        const targetInput = inputs.find(i => i.type === 'number');
        if (targetInput) setVal(targetInput, '5');

        // 3. Unit input (placeholder includes 'reps')
        const unitInput = inputs.find(i => i.placeholder.includes('reps'));
        if (unitInput) setVal(unitInput, 'km');

        // 4. Click Submit
        const submitBtn = Array.from(modal.querySelectorAll('button')).find(b => b.innerText.includes('Add Item'));
        if (submitBtn) submitBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    // Verify item created in DOM
    const itemCardText = await cdpClient.eval(`
      Array.from(document.querySelectorAll('.card')).find(c => c.innerText.includes('5km Morning Run'))?.innerText || ''
    `);
    console.log('✓ Created Item Card visible text:\n', itemCardText);
    if (!itemCardText.includes('5km Morning Run')) {
      throw new Error('Created item "5km Morning Run" not found in DOM.');
    }
    if (!itemCardText.includes('0 / 5 km')) {
      throw new Error(`Expected stepper pill "0 / 5 km", card text was: "${itemCardText}"`);
    }

    // Step 4: Increment stepper 3 times (0 -> 3 km)
    console.log('\n[4/8] Testing Stepper Increment (+) to 3 / 5 km...');
    for (let s = 1; s <= 3; s++) {
      await cdpClient.eval(`
        (() => {
          const card = Array.from(document.querySelectorAll('.card')).find(c => c.innerText.includes('5km Morning Run'));
          const plusBtn = card ? Array.from(card.querySelectorAll('button')).find(b => b.innerText.trim() === '+') : null;
          if (plusBtn) plusBtn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 400));
    }

    const stateAt3 = await cdpClient.eval(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.innerText.includes('5km Morning Run'));
      return {
        pillText: card ? Array.from(card.querySelectorAll('span')).find(s => s.innerText.includes('/ 5 km'))?.innerText || null : null,
        isDone: card ? card.classList.contains('card--muted') : false,
      };
    })()`);
    console.log('✓ DOM State at count 3:', stateAt3);
    if (stateAt3.pillText !== '3 / 5 km') {
      throw new Error(`Expected "3 / 5 km", got: "${stateAt3.pillText}"`);
    }
    if (stateAt3.isDone) {
      throw new Error('Item should be INCOMPLETE at 3 / 5 km, but was marked done!');
    }

    // Step 5: Increment 2 more times to reach Target (5 / 5 km)
    console.log('\n[5/8] Incrementing to reach target (5 / 5 km) and verifying automatic completion...');
    for (let s = 4; s <= 5; s++) {
      await cdpClient.eval(`
        (() => {
          const card = Array.from(document.querySelectorAll('.card')).find(c => c.innerText.includes('5km Morning Run'));
          const plusBtn = card ? Array.from(card.querySelectorAll('button')).find(b => b.innerText.trim() === '+') : null;
          if (plusBtn) plusBtn.click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 400));
    }

    const stateAt5 = await cdpClient.eval(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.innerText.includes('5km Morning Run'));
      return {
        pillText: card ? Array.from(card.querySelectorAll('span')).find(s => s.innerText.includes('/ 5 km'))?.innerText || null : null,
        isDone: card ? card.classList.contains('card--muted') : false,
      };
    })()`);
    console.log('✓ DOM State at target count 5:', stateAt5);
    if (stateAt5.pillText !== '5 / 5 km') {
      throw new Error(`Expected "5 / 5 km", got: "${stateAt5.pillText}"`);
    }
    if (!stateAt5.isDone) {
      throw new Error('Item should be AUTOMATICALLY COMPLETED at 5 / 5 km, but isDone was false!');
    }

    // Step 6: Decrement stepper 1 time (5 -> 4 km) and verify uncompletion
    console.log('\n[6/8] Decrementing below target (4 / 5 km) and verifying uncompletion...');
    await cdpClient.eval(`
      (() => {
        const card = Array.from(document.querySelectorAll('.card')).find(c => c.innerText.includes('5km Morning Run'));
        const minusBtn = card ? Array.from(card.querySelectorAll('button')).find(b => b.innerText.trim() === '–' || b.innerText.trim() === '-') : null;
        if (minusBtn) minusBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const stateAt4 = await cdpClient.eval(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.innerText.includes('5km Morning Run'));
      return {
        pillText: card ? Array.from(card.querySelectorAll('span')).find(s => s.innerText.includes('/ 5 km'))?.innerText || null : null,
        isDone: card ? card.classList.contains('card--muted') : false,
      };
    })()`);
    console.log('✓ DOM State at count 4:', stateAt4);
    if (stateAt4.pillText !== '4 / 5 km') {
      throw new Error(`Expected "4 / 5 km", got: "${stateAt4.pillText}"`);
    }
    if (stateAt4.isDone) {
      throw new Error('Item should REVERT TO INCOMPLETE at 4 / 5 km, but was still marked done!');
    }

    // Step 7: Reload page and verify state persistence
    console.log('\n[7/8] Reloading page (F5) and verifying persisted numeric state...');
    await cdpClient.send('Page.reload');
    await new Promise((r) => setTimeout(r, 2000));

    const stateAfterReload = await cdpClient.eval(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.innerText.includes('5km Morning Run'));
      return {
        hasCard: Boolean(card),
        pillText: card ? Array.from(card.querySelectorAll('span')).find(s => s.innerText.includes('/ 5 km'))?.innerText || null : null,
        isDone: card ? card.classList.contains('card--muted') : false,
      };
    })()`);
    console.log('✓ DOM State after reload:', stateAfterReload);
    if (stateAfterReload.pillText !== '4 / 5 km') {
      throw new Error(`Expected "4 / 5 km" after reload, got: "${stateAfterReload.pillText}"`);
    }

    // Step 8: Edit item numeric properties (Target 5 -> 10, Unit km -> miles)
    console.log('\n[8/8] Editing item: updating target count (5 -> 10) and unit (km -> miles)...');
    await cdpClient.eval(`
      (() => {
        const card = Array.from(document.querySelectorAll('.card')).find(c => c.innerText.includes('5km Morning Run'));
        const editBtn = card ? Array.from(card.querySelectorAll('button')).find(b => b.title === 'Edit item' || b.getAttribute('aria-label')?.includes('Edit')) : null;
        if (editBtn) editBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Update target and unit in EditItemModal
    await cdpClient.eval(`
      (() => {
        const setVal = (input, val) => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const modal = document.querySelector('.modal');
        const inputs = Array.from(modal.querySelectorAll('input'));

        // Target quantity (label: Target Quantity)
        const targetInput = inputs.find(i => i.labels?.[0]?.innerText.includes('Target Quantity') || i.value === '5');
        if (targetInput) setVal(targetInput, '10');

        // Unit input (label: Unit)
        const unitInput = inputs.find(i => i.labels?.[0]?.innerText.includes('Unit') || i.value === 'km');
        if (unitInput) setVal(unitInput, 'miles');

        // Submit
        const saveBtn = Array.from(modal.querySelectorAll('button')).find(b => b.innerText.includes('Save'));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    const stateAfterEdit = await cdpClient.eval(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.innerText.includes('5km Morning Run'));
      return {
        pillText: card ? Array.from(card.querySelectorAll('span')).find(s => s.innerText.includes('/ 10 miles'))?.innerText || null : null,
        isDone: card ? card.classList.contains('card--muted') : false,
      };
    })()`);
    console.log('✓ DOM State after editing target and unit:', stateAfterEdit);
    if (stateAfterEdit.pillText !== '4 / 10 miles') {
      throw new Error(`Expected "4 / 10 miles" after editing, got: "${stateAfterEdit.pillText}"`);
    }

    console.log('\n================================================================');
    console.log('🎉 ALL DEDICATED NUMERIC TARGET BROWSER E2E TESTS PASSED 100%');
    console.log('================================================================');
  } finally {
    if (cdpClient) {
      try { await cdpClient.send('Browser.close'); } catch {}
    }
    chromeProc.kill();
    server.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

runNumericBrowserE2E().catch((err) => {
  console.error('\n❌ NUMERIC TARGET BROWSER E2E FAILED:', err);
  process.exit(1);
});

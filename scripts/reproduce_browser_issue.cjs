const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const userDataDir = 'C:\\Users\\atkam\\.gemini\\antigravity-cli\\brain\\9aa8e125-7fee-438b-b361-288fc715183a\\scratch\\repro_brave_profile';

if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('[REPRO] Launching Chrome...');
  const chromeProc = spawn(
    chromePath,
    [
      '--remote-debugging-port=9222',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'http://localhost:5173/signup',
    ],
    { stdio: 'inherit' }
  );

  let chromeExited = false;
  chromeProc.on('exit', (code, signal) => {
    chromeExited = true;
    console.log(`[CHROME PROCESS EXITED] code: ${code}, signal: ${signal}`);
  });

  // Wait for remote debugging to be ready
  let targets = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch (e) {
      // waiting
    }
    await sleep(500);
  }

  if (!targets) {
    console.error('[ERROR] Could not connect to Chrome debugging port.');
    chromeProc.kill();
    return;
  }

  console.log('[REPRO] Found targets:', targets.map((t) => ({ type: t.type, url: t.url })));
  const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('5173')) || targets[0];
  console.log('[REPRO] Connecting to target WebSocket:', pageTarget.webSocketDebuggerUrl);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let messageId = 1;
  const pendingRequests = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  console.log('[REPRO] Connected to page debugger.');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pendingRequests.has(data.id)) {
      const { resolve, reject } = pendingRequests.get(data.id);
      pendingRequests.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
      return;
    }

    if (data.method === 'Runtime.consoleAPICalled') {
      const args = data.params.args.map((a) => a.value || a.description).join(' ');
      console.log(`[BROWSER CONSOLE ${data.params.type.toUpperCase()}]`, args);
    } else if (data.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER UNCAUGHT EXCEPTION]', JSON.stringify(data.params.exceptionDetails));
    } else if (data.method === 'Page.windowOpen') {
      console.log('[BROWSER WINDOW OPEN]', data.params);
    } else if (data.method === 'Page.close') {
      console.log('[BROWSER PAGE CLOSE EVENT]');
    } else if (data.method === 'Network.requestWillBeSent') {
      if (data.params.request.url.includes('supabase') || data.params.request.url.includes('auth')) {
        console.log('[BROWSER NETWORK REQUEST]', data.params.request.method, data.params.request.url);
      }
    } else if (data.method === 'Network.responseReceived') {
      if (data.params.response.url.includes('supabase') || data.params.response.url.includes('auth')) {
        console.log('[BROWSER NETWORK RESPONSE]', data.params.response.status, data.params.response.url);
      }
    }
  };

  ws.onclose = () => {
    console.log('[TARGET WEBSOCKET CLOSED]');
  };

  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');
  await sendCommand('Network.enable');

  // Wait 2 seconds for app to render
  await sleep(2000);

  // Evaluate script to inspect page and fill form
  const evaluate = async (expression) => {
    const res = await sendCommand('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  };

  console.log('[REPRO] Checking page URL and inputs...');
  const pageState = await evaluate(`({
    url: window.location.href,
    title: document.title,
    inputsCount: document.querySelectorAll('input').length,
    buttonsCount: document.querySelectorAll('button').length
  })`);
  console.log('[REPRO] Page state:', pageState);

  // Fill in signup form with React controlled input setter
  const testEmail = `diagnostic_${Date.now()}@gmail.com`;
  console.log(`[REPRO] Typing inputs with email: ${testEmail}...`);

  await evaluate(`
    (() => {
      const setReactValue = (input, value) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const inputs = Array.from(document.querySelectorAll('input'));
      // Input 0: Name/Alias
      if (inputs[0]) setReactValue(inputs[0], 'Diagnostic Tester');
      // Input 1: Email
      if (inputs[1]) setReactValue(inputs[1], '${testEmail}');
      // Input 2: Password
      if (inputs[2]) setReactValue(inputs[2], 'Password123!');
      // Input 3: Confirm Password
      if (inputs[3]) setReactValue(inputs[3], 'Password123!');
    })()
  `);

  await sleep(500);

  console.log('[REPRO] Submitting signup form...');
  await evaluate(`
    (() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) {
        console.log('Clicking submit button:', submitBtn.innerText);
        submitBtn.click();
      } else {
        console.error('Submit button not found!');
      }
    })()
  `);

  console.log('[REPRO] Waiting 5 seconds to observe browser behavior post-submit...');
  for (let s = 1; s <= 5; s++) {
    await sleep(1000);
    console.log(`[REPRO] Elapsed ${s}s | Chrome process exited? ${chromeExited} | WS readyState: ${ws.readyState}`);
    if (chromeExited || ws.readyState !== WebSocket.OPEN) {
      console.log('[REPRO] Browser or connection closed early!');
      break;
    }
    const domInfo = await evaluate(`({
      url: window.location.href,
      alertError: document.querySelector('.alert--error')?.innerText || null,
      alertInfo: document.querySelector('.alert--info')?.innerText || null,
      submitText: document.querySelector('button[type="submit"]')?.innerText || null,
    })`).catch(() => null);
    console.log(`[REPRO] DOM state at ${s}s:`, domInfo);
  }

  console.log('[REPRO] Finished diagnostic run.');
  if (!chromeExited) {
    chromeProc.kill();
  }
}

run().catch((err) => {
  console.error('[FATAL RUN ERROR]', err);
});

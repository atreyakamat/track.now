const { spawn } = require('child_process');
const fs = require('fs');

const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const userDataDir = 'C:\\Users\\atkam\\.gemini\\antigravity-cli\\brain\\9aa8e125-7fee-438b-b361-288fc715183a\\scratch\\repro_keystroke_profile';

if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('[KEYSTROKE TEST] Launching Brave...');
  const braveProc = spawn(
    bravePath,
    [
      '--remote-debugging-port=9555',
      `--user-data-dir=${userDataDir}`,
      '--enable-features=AutofillSuggestionsShownOnTyping',
      'http://localhost:5173/signup',
    ],
    { stdio: 'inherit' }
  );

  let braveExited = false;
  braveProc.on('exit', (code, sig) => {
    braveExited = true;
    console.log(`[BRAVE EXITED] code: ${code}, signal: ${sig}`);
  });

  let targets = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9555/json');
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch (e) {}
    await sleep(500);
  }

  if (!targets) {
    console.error('Failed to get targets');
    braveProc.kill();
    return;
  }

  const page = targets.find((t) => t.type === 'page' && t.url.includes('5173')) || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) {
      const { resolve, reject } = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) reject(d.error);
      else resolve(d.result);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Input.enable');
  await sleep(2000);

  // Focus password input
  console.log('[KEYSTROKE TEST] Focusing password input...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const inputs = document.querySelectorAll('input[type="password"]');
      if (inputs[0]) inputs[0].focus();
    })()`,
  });

  await sleep(500);

  // Type characters into password input using CDP Input.dispatchKeyEvent
  console.log('[KEYSTROKE TEST] Typing into password input with dispatchKeyEvent...');
  const text = 'P@ssw0rd123';
  for (const char of text) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
    await send('Input.dispatchKeyEvent', { type: 'keyUp' });
    await sleep(100);
  }

  console.log('[KEYSTROKE TEST] Typed password. Now focusing confirm password...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const inputs = document.querySelectorAll('input[type="password"]');
      if (inputs[1]) inputs[1].focus();
    })()`,
  });

  await sleep(500);

  for (const char of text) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
    await send('Input.dispatchKeyEvent', { type: 'keyUp' });
    await sleep(100);
  }

  console.log('[KEYSTROKE TEST] Done typing. Checking if Brave is still alive...');
  await sleep(2000);
  console.log('[KEYSTROKE TEST] Brave exited?', braveExited);
  if (!braveExited) {
    braveProc.kill();
  }
}

run().catch(console.error);

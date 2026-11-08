#!/usr/bin/env node
/**
 * Renders the brand mark (brand/tracknow-mark.svg) to every raster size the apps need, using
 * the local Chrome over the DevTools protocol (no extra npm dependencies). From the repo root:
 *
 *   node scripts/render_brand.cjs
 *
 * Outputs: web icons + an Open Graph image (apps/app/public, apps/landing/public) and the
 * Expo icon set (apps/mobile/assets/images). SVG favicons are copied as-is.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const SVG = fs.readFileSync(path.join(ROOT, 'brand', 'tracknow-mark.svg'), 'utf8')
const CHROME =
  process.env.CHROME_PATH ||
  [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((p) => fs.existsSync(p))
if (!CHROME) {
  console.error('Chrome not found; set CHROME_PATH.')
  process.exit(1)
}
const PORT = 9333
const svgData = `data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`

/** Mark only, scaled to `scale` of the canvas, on a transparent or solid background. */
const markPage = (size, scale, background = 'transparent') => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:transparent;overflow:hidden}
.c{position:absolute;left:0;top:0;width:${size}px;height:${size}px;background:${background}}
img{position:absolute;left:50%;top:50%;width:${Math.round(size * scale)}px;height:${Math.round(size * scale)}px;transform:translate(-50%,-50%)}
</style></head><body><div class="c"><img src="${svgData}" alt=""></div></body></html>`

/** White glyph on transparent (Android monochrome icon). */
const monoPage = (size) => {
  const mono = SVG.replace(/<rect[^>]*\/>/, '')
    .replace(/stroke="#3a3936"/, 'stroke="rgba(255,255,255,0.35)"')
    .replace(/stroke="url\(#lime\)"/, 'stroke="#ffffff"')
    .replace(/fill="#e2ff7e"/, 'fill="#ffffff"')
    .replace(/stroke="#f4efe6"/, 'stroke="#ffffff"')
  const data = `data:image/svg+xml;base64,${Buffer.from(mono).toString('base64')}`
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:transparent;overflow:hidden}
.c{position:absolute;left:0;top:0;width:${size}px;height:${size}px}
img{position:absolute;left:50%;top:50%;width:${Math.round(size * 0.62)}px;height:${Math.round(size * 0.62)}px;transform:translate(-50%,-50%)}
</style></head><body><div class="c"><img src="${data}" alt=""></div></body></html>`
}

/** Open Graph card 1200×630. */
const ogPage = () => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;overflow:hidden;font-family:"Segoe UI",Inter,system-ui,sans-serif;color:#f4efe6}
.c{position:absolute;left:0;top:0;width:1200px;height:630px;background:#0e0e0d;overflow:hidden}
.wrap{position:absolute;inset:0;display:flex;align-items:center;gap:64px;padding:0 96px;box-sizing:border-box}
.glow{position:absolute;width:900px;height:900px;left:-250px;top:-400px;border-radius:50%;background:radial-gradient(closest-side,rgba(200,241,105,0.18),transparent)}
img{width:260px;height:260px;filter:drop-shadow(0 24px 60px rgba(0,0,0,0.6))}
h1{margin:0;font-size:88px;letter-spacing:-0.035em;font-weight:800;line-height:1}
p{margin:18px 0 0;font-size:34px;color:#b9b4a8;line-height:1.3;max-width:640px}
.pill{display:inline-flex;align-items:center;gap:10px;margin-top:34px;padding:10px 18px;border:1px solid #3a3936;border-radius:999px;font-size:20px;letter-spacing:0.14em;color:#c8f169}
.dot{width:10px;height:10px;border-radius:50%;background:#c8f169}
</style></head><body><div class="c"><div class="glow"></div><div class="wrap"><img src="${svgData}" alt=""><div>
<h1>Track.now</h1><p>Your life, organized to execute. Tracks, Arcs, routines and honest progress.</p>
<div class="pill"><span class="dot"></span>TRACK · PLAN · EXECUTE · VERIFY</div></div></div></div></body></html>`

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 1
    this.pending = new Map()
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve()
      this.ws.onerror = (e) => reject(e)
      this.ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data)
        if (m.id && this.pending.has(m.id)) {
          const { resolve: res, reject: rej } = this.pending.get(m.id)
          this.pending.delete(m.id)
          m.error ? rej(new Error(m.error.message)) : res(m.result)
        }
      }
    })
  }
  send(method, params = {}) {
    const id = this.id++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tracknow-brand-'))
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tracknow-brand-profile-'))
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1400,1000', 'about:blank',
  ], { stdio: 'ignore' })
  let cdp
  try {
    let target
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(200)
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
        target = list.find((t) => t.type === 'page')
      } catch {
        /* not up yet */
      }
    }
    if (!target) throw new Error('Chrome did not start')
    cdp = new Cdp(target.webSocketDebuggerUrl)
    await cdp.connect()
    await cdp.send('Page.enable')
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })

    const shoot = async (html, width, height, out) => {
      const page = path.join(tmp, `${path.basename(out, '.png')}-${width}.html`)
      fs.writeFileSync(page, html)
      fs.mkdirSync(path.dirname(out), { recursive: true })
      await cdp.send('Page.navigate', { url: `file:///${page.replace(/\\/g, '/')}` })
      await sleep(250)
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width, height, scale: 1 },
        captureBeyondViewport: true,
      })
      fs.writeFileSync(out, Buffer.from(data, 'base64'))
      console.log(`wrote ${path.relative(ROOT, out)} (${width}×${height})`)
    }

    const app = path.join(ROOT, 'apps', 'app', 'public')
    const landing = path.join(ROOT, 'apps', 'landing', 'public')
    const mobile = path.join(ROOT, 'apps', 'mobile', 'assets', 'images')
    for (const dir of [app, landing]) {
      fs.writeFileSync(path.join(dir, 'favicon.svg'), SVG)
      console.log(`wrote ${path.relative(ROOT, path.join(dir, 'favicon.svg'))}`)
      await shoot(markPage(512, 1), 512, 512, path.join(dir, 'icon-512.png'))
      await shoot(markPage(192, 1), 192, 192, path.join(dir, 'icon-192.png'))
      await shoot(markPage(180, 1), 180, 180, path.join(dir, 'apple-touch-icon.png'))
      await shoot(ogPage(), 1200, 630, path.join(dir, 'og-image.png'))
    }
    // Expo: full-bleed app icon, adaptive Android layers, splash logo and favicon.
    await shoot(markPage(1024, 1), 1024, 1024, path.join(mobile, 'icon.png'))
    await shoot(markPage(1024, 0.66), 1024, 1024, path.join(mobile, 'android-icon-foreground.png'))
    await shoot(markPage(1024, 0, '#141414'), 1024, 1024, path.join(mobile, 'android-icon-background.png'))
    await shoot(monoPage(1024), 1024, 1024, path.join(mobile, 'android-icon-monochrome.png'))
    await shoot(markPage(512, 1), 512, 512, path.join(mobile, 'splash-icon.png'))
    await shoot(markPage(64, 1), 64, 64, path.join(mobile, 'favicon.png'))
    console.log('done')
  } finally {
    try {
      cdp?.ws.close()
    } catch {
      /* ignore */
    }
    chrome.kill()
    // Chrome may still hold the profile for a moment on Windows; leftovers in %TEMP% are harmless.
    for (const dir of [tmp, profile]) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

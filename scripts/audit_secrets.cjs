#!/usr/bin/env node
/**
 * Secret scan: tracked files, the whole git history, and the built web bundles.
 *
 * It prints WHERE something that looks like a secret is (file, line, kind), never the value.
 * JWT-shaped strings are decoded locally to tell a public anon key from a service-role key.
 * Exit code 1 when a finding is not on the allowlist below.
 *
 * Usage: node scripts/audit_secrets.cjs [--history] [--out <file.md>]
 */
const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const withHistory = args.includes('--history')
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : null

const PATTERNS = [
  { kind: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { kind: 'Supabase secret key (sb_secret_)', re: /sb_secret_[A-Za-z0-9_-]{16,}/g },
  { kind: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { kind: 'Stripe live key', re: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/g },
  { kind: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { kind: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { kind: 'Expo access token', re: /\bexpo_[A-Za-z0-9_-]{30,}\b/g },
  { kind: 'JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { kind: 'hard-coded credential assignment', re: /\b(?:password|passwd|secret|api[_-]?key|smtp[_-]?pass(?:word)?|service[_-]?role[_-]?key)\b\s*[:=]\s*["'`][^"'`\s$<{]{8,}["'`]/gi },
]

// Things that look like secrets and are not. Each entry says why.
const ALLOW = [
  { file: /^scripts\/lib\/e2eMock\.cjs$/, why: 'documented fake key for the mocked browser tests' },
  { file: /^scripts\/(verify_|render_|audit_|run_).*\.cjs$/, kind: /credential assignment|JWT/, why: 'made-up tokens used only against the mocked backend' },
  { file: /^apps\/app\/tests\//, why: 'test fixtures' },
  { file: /^apps\/app\/vite\.config\.ts$/, why: 'non-functional placeholder so unit tests can load modules' },
  { file: /\.md$/, kind: /credential assignment/, why: 'documentation examples' },
  // Finding S-29: the web config of the first, Firebase-based version is in old commits. History is
  // not rewritten; the owner retires that Firebase project and its key instead.
  { file: /^(app\/\.env|app\/src\/boot\/firebase\.js|release\/app\/assets\/firebase\.[0-9a-f]+\.js)$/, historyOnly: true, why: 'KNOWN FINDING S-29: old Firebase web config in history (owner retires the project)' },
]

function classifyJwt(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    if (payload.role === 'service_role') return 'JWT with role service_role (SECRET)'
    if (payload.role === 'anon') return 'JWT with role anon (public key, allowed in client config)'
    return `JWT (role: ${payload.role ?? 'none'})`
  } catch {
    return 'JWT-shaped string (payload not decodable)'
  }
}

const findings = []
function scanText(text, where, lineOffset = 0) {
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (line.length > 20000) line = line.slice(0, 20000) + line.slice(-20000)
    for (const { kind, re } of PATTERNS) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(line))) {
        const label = kind === 'JWT' ? classifyJwt(m[0]) : kind
        findings.push({ where, line: i + 1 + lineOffset, kind: label })
        if (m.index === re.lastIndex) re.lastIndex++
      }
    }
  })
}

const isBinary = (buf) => buf.subarray(0, 4000).includes(0)

// 1. Tracked files at HEAD.
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8').split('\0').filter(Boolean)
let scannedFiles = 0
for (const rel of tracked) {
  const abs = path.join(ROOT, rel)
  let buf
  try {
    if (fs.statSync(abs).size > 5 * 1024 * 1024) continue
    buf = fs.readFileSync(abs)
  } catch {
    continue
  }
  if (isBinary(buf)) continue
  scannedFiles++
  scanText(buf.toString('utf8'), `HEAD:${rel}`)
}

// 2. Environment files must not be tracked (examples are fine).
const trackedEnv = tracked.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !/\.example$/.test(f))
trackedEnv.forEach((f) => findings.push({ where: `HEAD:${f}`, line: 0, kind: 'environment file is tracked by git' }))

// 3. Built web bundles (what the public can download).
let scannedBundles = 0
for (const dist of ['apps/app/dist', 'apps/landing/dist']) {
  const dir = path.join(ROOT, dist)
  if (!fs.existsSync(dir)) continue
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(js|css|html|json|map|webmanifest)$/.test(e.name)) {
        scannedBundles++
        scanText(fs.readFileSync(p, 'utf8'), `BUILD:${path.relative(ROOT, p).replace(/\\/g, '/')}`)
        if (e.name.endsWith('.map')) findings.push({ where: `BUILD:${path.relative(ROOT, p).replace(/\\/g, '/')}`, line: 0, kind: 'source map published with the site' })
      }
    }
  }
  walk(dir)
}

// 4. Every commit ever made (added lines only).
let commits = 0
if (withHistory) {
  const log = spawnSync('git', ['log', '--all', '-p', '--no-color', '--unified=0', '--format=%x00commit %h', '--', '.', ':!*.png', ':!*.lock', ':!package-lock.json'], { cwd: ROOT, maxBuffer: 1 << 30, encoding: 'utf8' })
  let commit = ''
  let file = ''
  for (const raw of (log.stdout || '').split('\n')) {
    if (raw.startsWith('\0commit ')) {
      commit = raw.slice(8).trim()
      commits++
    } else if (raw.startsWith('+++ b/')) file = raw.slice(6).trim()
    else if (raw.startsWith('+') && !raw.startsWith('+++')) scanText(raw.slice(1), `HISTORY:${commit}:${file}`)
  }
}

// Report: one line per (place, kind); values are never printed.
const norm = (w) => w.replace(/^(HEAD|BUILD):/, '').replace(/^HISTORY:[0-9a-f]+:/, '')
const allowed = (f) => {
  if (/anon \(public key/.test(f.kind) && !f.where.startsWith('HEAD:')) return 'public anon key in a client bundle or old commit'
  const hit = ALLOW.find((a) => a.file.test(norm(f.where)) && (!a.kind || a.kind.test(f.kind)) && (!a.historyOnly || f.where.startsWith('HISTORY:')))
  return hit ? hit.why : null
}
const seen = new Map()
for (const f of findings) {
  const key = `${f.where}|${f.kind}`
  const prev = seen.get(key)
  if (prev) prev.count++
  else seen.set(key, { ...f, count: 1, allowed: allowed(f) })
}
const rows = [...seen.values()]
const open = rows.filter((r) => !r.allowed)
const lines = [
  '# Secret scan',
  '',
  `Scanned ${scannedFiles} tracked text files, ${scannedBundles} built bundle files${withHistory ? `, and the added lines of ${commits} commits` : ' (history not scanned: pass --history)'}.`,
  'Values are never printed. Locations only.',
  '',
  `**Result: ${open.length === 0 ? 'PASS, nothing outside the allowlist' : `FAIL, ${open.length} location(s) need a look`}**`,
  '',
  '| Where | Line | Kind | Count | Status |',
  '| :--- | :--- | :--- | :--- | :--- |',
  ...rows.sort((a, b) => Number(Boolean(a.allowed)) - Number(Boolean(b.allowed)) || a.where.localeCompare(b.where)).map((r) => `| ${r.where} | ${r.line || '-'} | ${r.kind} | ${r.count} | ${r.allowed ? `allowed: ${r.allowed}` : '**REVIEW**'} |`),
  '',
]
if (outFile) {
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true })
  fs.writeFileSync(outFile, lines.join('\n'))
}
console.log(lines.slice(2, 6).join('\n'))
open.forEach((r) => console.log(`REVIEW: ${r.where}${r.line ? `:${r.line}` : ''} — ${r.kind}`))
process.exit(open.length ? 1 : 0)

#!/usr/bin/env node
/**
 * Runs the MOCKED browser E2E / audit scripts safely:
 *   1. builds apps/app with a fake Supabase project (scripts/lib/e2eMock.cjs),
 *   2. runs each script (they refuse to start against any other build),
 *   3. rebuilds the normal production bundle (from your .env) so dist/ is not left mocked.
 *
 * Nothing here contacts Supabase. Screenshots go to TRACKNOW_SCREENSHOT_DIR when set
 * (defaults to a temp directory outside the repository).
 *
 * Usage: node scripts/run_mocked_e2e.cjs [script names...]
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { MOCK_URL, MOCK_ANON_KEY, assertMockBuild } = require('./lib/e2eMock.cjs')

const ROOT = path.resolve(__dirname, '..')
const APP = path.join(ROOT, 'apps', 'app')
const DEFAULT_SCRIPTS = [
  'verify_numeric_e2e.cjs',
  'verify_streaks_heatmap_e2e.cjs',
  'verify_sidebar_scroll_signup_e2e.cjs',
  'verify_reminders_notifications_e2e.cjs',
  'verify_every_task_reminders_e2e.cjs',
  'audit_ux_responsive.cjs',
  'verify_responsive_cdp.cjs',
]
const scripts = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SCRIPTS
const shell = process.platform === 'win32'

function build(env, label) {
  console.log(`\n=== Building apps/app (${label}) ===`)
  const r = spawnSync('npx', ['vite', 'build'], { cwd: APP, env, stdio: 'inherit', shell })
  if (r.status !== 0) {
    console.error(`Build failed (${label}).`)
    process.exit(1)
  }
}

const screenshotDir = process.env.TRACKNOW_SCREENSHOT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'tracknow-e2e-shots-'))
const mockEnv = { ...process.env, VITE_SUPABASE_URL: MOCK_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY, TRACKNOW_SCREENSHOT_DIR: screenshotDir }
// Make sure no real values can leak into the mock build through the environment.
delete mockEnv.SUPABASE_SERVICE_ROLE_KEY

const results = []
try {
  build(mockEnv, 'E2E mock Supabase project')
  assertMockBuild()
  for (const name of scripts) {
    console.log(`\n=== ${name} ===`)
    const started = Date.now()
    const r = spawnSync(process.execPath, [path.join(__dirname, name)], { cwd: ROOT, env: mockEnv, stdio: 'inherit', timeout: 15 * 60 * 1000 })
    results.push({ name, code: r.status, signal: r.signal, seconds: Math.round((Date.now() - started) / 1000) })
  }
} finally {
  // Restore the normal bundle (Vite reads the real public config from .env files).
  const normalEnv = { ...process.env }
  delete normalEnv.VITE_SUPABASE_URL
  delete normalEnv.VITE_SUPABASE_ANON_KEY
  build(normalEnv, 'normal')
}

console.log('\n=== Mocked E2E summary ===')
for (const r of results) console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  exit=${r.code ?? r.signal}  ${r.seconds}s  ${r.name}`)
console.log(`Screenshots: ${screenshotDir}`)
process.exit(results.every((r) => r.code === 0) ? 0 : 1)

/**
 * Shared configuration for the MOCKED browser E2E scripts.
 *
 * Those scripts serve apps/app/dist in a throw-away Chrome profile and answer every
 * Supabase request themselves (CDP Fetch interception + a DNS block). As a structural
 * third layer, they only run against a bundle BUILT WITH A FAKE PROJECT: the URL below
 * points at a project ref that does not exist and the key is not a credential, so even if
 * interception and the DNS rule both failed, nothing could reach the real project.
 *
 * Build that bundle with `node scripts/run_mocked_e2e.cjs` (it also runs the scripts and
 * rebuilds the normal bundle afterwards).
 */
const fs = require('node:fs')
const path = require('node:path')

const MOCK_REF = 'tracknowe2emockref00'
const MOCK_URL = `https://${MOCK_REF}.supabase.co`
const MOCK_ANON_KEY = 'e2e-mock-anon-key-not-a-real-credential'
const AUTH_STORAGE_KEY = `sb-${MOCK_REF}-auth-token`
const DEFAULT_APP_DIST = path.resolve(__dirname, '../../apps/app/dist')

/** Exits with code 2 unless `distDir` was built with the mock Supabase configuration. */
function assertMockBuild(distDir = DEFAULT_APP_DIST) {
  const assets = path.join(distDir, 'assets')
  let bundle = ''
  try {
    for (const f of fs.readdirSync(assets)) if (f.endsWith('.js')) bundle += fs.readFileSync(path.join(assets, f), 'utf8')
  } catch {
    console.error(`REFUSED: no app build found at ${distDir}. Run: node scripts/run_mocked_e2e.cjs`)
    process.exit(2)
  }
  const refs = new Set(Array.from(bundle.matchAll(/https:\/\/([a-z0-9]{20})\.supabase\.(?:co|in)/g), (m) => m[1]))
  if (!bundle.includes(MOCK_URL) || [...refs].some((r) => r !== MOCK_REF)) {
    console.error('REFUSED: apps/app/dist was built against a real Supabase project, not the E2E mock.')
    console.error('Run the mocked suite through: node scripts/run_mocked_e2e.cjs')
    process.exit(2)
  }
}

module.exports = { MOCK_REF, MOCK_URL, MOCK_ANON_KEY, AUTH_STORAGE_KEY, DEFAULT_APP_DIST, assertMockBuild }

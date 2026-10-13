/**
 * Fail-closed guard for the scripts that talk to a REAL Supabase project
 * (verify_rls_security.cjs, verify_browser_e2e.cjs, verify_e2e_journey.cjs).
 *
 * They create and delete users and data. They must never run against production by
 * accident, so they refuse to start unless ALL of these hold:
 *   1. SUPABASE_SERVICE_ROLE_KEY is set (users are created with the admin API and
 *      email_confirm=true, so no confirmation email is ever sent, and they can be deleted).
 *   2. ALLOW_LIVE_SUPABASE is set to the project ref of the target URL
 *      (the "<ref>" in https://<ref>.supabase.co) — an explicit, per-project opt-in.
 *   3. The target is not listed in PRODUCTION_SUPABASE_REFS (comma-separated), which the
 *      owner can set to make the production ref impossible to target from this machine.
 * Exit code 2 = refused (not a test failure).
 */
function projectRef(url) {
  try {
    const host = new URL(url).hostname
    const m = host.match(/^([a-z0-9]{20})\.supabase\.(co|in)$/i)
    return m ? m[1].toLowerCase() : null
  } catch {
    return null
  }
}

function assertLiveTargetAllowed({ url, serviceKey, env = process.env, scriptName = 'this script' }) {
  const refuse = (reason) => {
    console.error(`REFUSED: ${scriptName} talks to a live Supabase project and ${reason}`)
    console.error('Use a disposable development project and set ALLOW_LIVE_SUPABASE=<its project ref>.')
    process.exit(2)
  }
  if (!url) refuse('no Supabase URL is configured.')
  if (!serviceKey) refuse('SUPABASE_SERVICE_ROLE_KEY is not set (public sign-up is never used, so no emails are sent).')
  const ref = projectRef(url)
  if (!ref) refuse('the URL is not a recognisable https://<ref>.supabase.co project URL.')
  const allowed = String(env.ALLOW_LIVE_SUPABASE || '').trim().toLowerCase()
  if (!allowed) refuse('ALLOW_LIVE_SUPABASE is not set.')
  if (allowed !== ref) refuse(`ALLOW_LIVE_SUPABASE does not match the target project ref.`)
  const blocked = String(env.PRODUCTION_SUPABASE_REFS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (blocked.includes(ref)) refuse('the target is listed in PRODUCTION_SUPABASE_REFS.')
  return ref
}

module.exports = { assertLiveTargetAllowed, projectRef }

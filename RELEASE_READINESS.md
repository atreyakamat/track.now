# Track.now — Release Readiness (v1 web)

Date: 2026-10-13 · Branch: `main` (uncommitted working tree; nothing committed, pushed or deployed).

## Verdict

**BLOCKED ONLY BY SPECIFIED EXTERNAL ACTIONS.** Every locally verifiable check passes. The web apps can be deployed
from a code point of view, but the hosted database still exposes the critical RPC (S-1 in `SECURITY_AUDIT.md`) until
the owner applies the prepared migrations, and the password-reset redirect must be allowed in Supabase Auth.
Do not describe the hosted project as secure before step 1 below is done.

## Verification evidence (2026-10-13, Windows 11, Node 24.14.0, npm 10.9.0)

| Command | Result | Exit |
| :--- | :--- | :--- |
| `npm run typecheck` (landing `tsc -b`, app `tsc -b` + `tsc -p tsconfig.test.json`) | PASS | 0 |
| `npm test` (Vitest 3.2.7) | **PASS — 34 files, 427 tests** (baseline before this pass: 25 files, 262 tests) | 0 |
| `npm run build` (landing + app, Vite 6.4.3) | PASS (no source maps) | 0 |
| `node scripts/audit_tables.cjs` | PASS — no legacy table names | 0 |
| `node scripts/verify_sql_local.cjs` (disposable PostgreSQL 18.3 cluster, deleted afterwards) | **PASS — 15/15 harness checks** (incl. 22-check RPC security script, 14-check habit-counter script, exploit reproduction before fix, re-application, 8×25 concurrency, `tracked_profiles` untouched) | 0 |
| `node scripts/run_mocked_e2e.cjs` (mock-project build, temp Chrome profiles) | **PASS — 7/7 scripts** | 0 |
| ↳ `verify_numeric_e2e.cjs` | PASS | 0 |
| ↳ `verify_streaks_heatmap_e2e.cjs` | PASS | 0 |
| ↳ `verify_sidebar_scroll_signup_e2e.cjs` | PASS | 0 |
| ↳ `verify_reminders_notifications_e2e.cjs` | PASS | 0 |
| ↳ `verify_every_task_reminders_e2e.cjs` | PASS | 0 |
| ↳ `audit_ux_responsive.cjs` (14 routes × 10 widths 320–1920 px, light + dark) | PASS — 0 findings | 0 |
| ↳ `verify_responsive_cdp.cjs` | PASS | 0 |
| `npm audit --omit=dev` | **0 vulnerabilities** | 0 |
| `npm audit` (incl. dev) | 3 dev-only findings (tinypool ×2 critical, @vitest/mocker moderate) — justified in `SECURITY_AUDIT.md` S-12 | 1 |

**Not run (by design):** `scripts/verify_rls_security.cjs`, `verify_browser_e2e.cjs`, `verify_e2e_journey.cjs`, `verify_rpc_http_dev.cjs` (live
Supabase; now refuse to start without `SUPABASE_SERVICE_ROLE_KEY` + `ALLOW_LIVE_SUPABASE=<ref>`). See the incident
note INC-1 in `SECURITY_AUDIT.md`: one rejected public sign-up request reached the live project during this pass.

What the evidence does **not** prove: hosted RLS isolation, hosted RPC behaviour over HTTP, real email delivery,
PKCE links against hosted Auth, Netlify header behaviour, native widgets.

## Verified user journeys (mocked Supabase)

Auth (validation, duplicate submit, 429, network/5xx/offline, reset request, recovery-only reset form, session
restore, protected/public routes, return path, sign-out cleanup, account switch); Tracks (create/edit/duplicate-name
confirmation/archive/restore/delete, not-found deep links); Plans (create/edit/archive/delete, wrong-track URL
canonicalised, not-found); items of all five types (create/edit/delete, targets, schedules, checklist, schedule failure
rollback); Today grouping (overdue/due today/anytime/upcoming/completed today, midnight boundary); completion and
un-completion, numeric counters, habit daily restart, stale-day rejection; progress (empty = 0 %, archived excluded,
off-schedule habits excluded); Analytics and Reviews from real completion history (paged); reminders for every type
(create/edit/remove/snooze/relative/before/custom/habit days/cancel on complete-delete-archive/corrupt storage/catch-up/
multi-tab/sign-out); Settings (profile, theme, notification permission states, test notification, widget snapshot).

## Deployment settings

| Site | Netlify base | Build | Publish | Env var NAMES (values never in git) |
| :--- | :--- | :--- | :--- | :--- |
| Landing — `https://tracknow.atreyakamat.dev` | `apps/landing` | `npm run build` | `dist` | optional `VITE_APP_URL` |
| App — `https://trackapp.atreyakamat.dev` | `apps/app` | `npm run build` | `dist` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, recommended `VITE_APP_URL=https://trackapp.atreyakamat.dev` |

- Config: `netlify/app/netlify.toml` / `apps/app/netlify.toml` and `netlify/landing/netlify.toml` /
  `apps/landing/netlify.toml` (pairs are identical; use the one matching how each site's base directory is set).
- `NODE_VERSION = "22"` is pinned in every `netlify.toml` (React Router 7 requires Node ≥ 20).
- App redirects: `/assets/*` → 404 (missing assets are never served as HTML), then `/* /index.html 200` (SPA deep
  links). Same rules in `apps/app/public/_redirects`.
- Headers: `X-Frame-Options DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP
  (`script-src 'self'`, `connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co`,
  `base-uri 'none'`, `form-action 'self'`, `object-src 'none'`, `frame-ancestors 'none'`).
- Never put a service-role key in any `VITE_` variable or Netlify site.

## Owner actions, in order (none performed)

1. **Database migrations** (status: **NOT APPLIED**) — follow "Applying the migrations" below.
2. **Password-reset redirect:** Supabase → Authentication → URL Configuration → Redirect URLs → add
   `https://trackapp.atreyakamat.dev/reset-password` (plus your local dev origin if needed). Optionally set
   `VITE_APP_URL` on the app site.
3. **PKCE note:** default email templates (`{{ .ConfirmationURL }}`) work unchanged. Links must be opened in the browser
   that requested them; tell users that in support copy if needed.
4. **Signup rate limit / bounced emails:** review Supabase Auth logs and SMTP settings (the frontend only reports them).
5. **Deploy** the app site, then the landing site (independent).
6. Optional: run the live scripts against a **disposable** project only:
   `SUPABASE_SERVICE_ROLE_KEY=… ALLOW_LIVE_SUPABASE=<dev-ref> PRODUCTION_SUPABASE_REFS=<prod-ref> node scripts/verify_rls_security.cjs`.

## Applying the migrations

Files (apply in this order, each only once):
1. `supabase/migrations/20261012000000_secure_increment_item_count_rpc.sql` — security fix (S-1).
2. `supabase/migrations/20261013000000_habit_daily_counter.sql` — `count_date` + daily-restart RPC (S-14). It refuses
   to run if step 1 is missing.

Helpers: `supabase/verification/preflight_function_inventory.sql` (read-only, safe on production),
`verify_increment_rpc_security.sql` and `verify_habit_daily_counter.sql` (development only; every write is rolled
back; they refuse to run when `auth.users` has more than 25 rows).

1. **Local (done):** `node scripts/verify_sql_local.cjs` → 15/15.
2. **Development project:** apply both files, then
   `psql "<dev connection string>" -v ON_ERROR_STOP=1 -X -f supabase/verification/verify_increment_rpc_security.sql`
   (expect `ALL 22 CHECKS PASSED`) and the same for `verify_habit_daily_counter.sql` (expect `ALL 14 HABIT COUNTER CHECKS
   PASSED`). In the SQL editor run each whole file as `postgres` without impersonation; success is the final row.
3. **HTTP smoke test on dev** — scripted in `scripts/verify_rpc_http_dev.cjs` (creates and deletes two throw-away
   `.invalid` users via the admin API; reads only exported variables, never `.env`):
   `SUPABASE_URL=https://<dev-ref>.supabase.co SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… ALLOW_LIVE_SUPABASE=<dev-ref> PRODUCTION_SUPABASE_REFS=<prod-ref> node scripts/verify_rpc_http_dev.cjs`
   (expect every line `PASS`, exit 0). It checks:
   - `POST /rest/v1/rpc/track_now_increment_item_count` with only the anon key → permission error.
   - As user B with user A's `p_item_id` → `42501`; A's item unchanged.
   - Old payload with `p_user_id` → `PGRST202`.
   - As user A on their own item → success; rename a habit, press + on the next day → count restarts at 1.
4. **Production pre-flight:** run `preflight_function_inventory.sql`, save the output.
5. **Migration history:** `supabase migration list --linked`. If `20261005000000`/`20261008000000` were applied by hand,
   either `supabase migration repair --status applied 20261005000000 20261008000000` or apply only the two new files in
   the SQL editor, in order. Never let `db push` re-run `20261008000000` after the fix (it would recreate the
   vulnerable overload until step 1's file runs again).
6. **Apply to production** in a quiet period, then rerun the inventory: query 1 must return exactly one row
   `track_now_increment_item_count(uuid,integer,date,boolean)`, `search_path=""`, `anon_execute = false`; query 2 no rows;
   review anything in query 3 with its owner.
7. Never run the two verification scripts on production.

## Rollback (never restores the vulnerable function)

- **Frontend:** Netlify → Deploys → previous deploy → Publish. This build and older builds work with and without the
  migrations: when the RPC is missing they use the RLS-protected fallback; before `count_date` exists they never
  write it.
- **Habit migration misbehaves:** re-run `20261012000000_secure_increment_item_count_rpc.sql` (it drops every overload
  and recreates the secure, `count_date`-unaware function). Leave the nullable `count_date` column in place.
- **Security function misbehaves:**
  ```sql
  DROP FUNCTION IF EXISTS public.track_now_increment_item_count(uuid, integer, date, boolean);
  NOTIFY pgrst, 'reload schema';
  ```
  Clients then get `PGRST202` and use the RLS-protected fallback, so counters keep working and the hole stays closed.
  **Never** re-create the `(uuid, integer, uuid, date)` version from `20261008000000`.
- Device data uses additive, per-user keys; older builds ignore new keys.

## Known limitations

- Reminders, review notes, notification preferences and the widget snapshot are stored per user on the device only.
- Reminders fire only while the app is open (visible tab, or a background tab with system notifications allowed);
  nothing fires with the browser closed — there is no Web Push sender.
- Native Android/iOS: widget sources only; no Capacitor app, Gradle project, Xcode project, bridge plugin or SDKs. The
  JS bridge (`nativeMobileBridge.ts`) has no native counterpart. Not buildable on this machine.
- Monthly habit schedules behave like daily ones (preserved on edit, not yet given monthly semantics).
- Before `20261013000000` is applied the client falls back to the `updated_at` heuristic for a habit's day; the edit
  path no longer writes stale counts, so the remaining gap is a legacy row renamed by an older client build.
- PWA icon is SVG-only (no raster/maskable/Apple touch icon).

## Smoke test after deploy

Sign in, open Today, complete and un-complete a task, step a habit counter, rename a habit (counter unchanged today),
open Analytics and Reviews, set/snooze/remove a reminder, request a password reset (link opens `/reset-password` with
the form), sign out (toasts/reminders gone). Watch Supabase logs: `42501` from the RPC = a caller tried another user's
item; `PGRST202` = an old client still sends `p_user_id`.

# Track.now — Security Audit (2026-10-12 → 2026-10-13)

Scope: `apps/app`, `apps/landing`, `supabase/migrations`, `supabase/verification`, `scripts/`, `android/`, `ios/`,
Netlify configuration, service worker, dependencies.

Method: static review of all source and SQL; mocked unit/regression tests (Vitest); mocked headless-browser
tests (Chrome DevTools Protocol, temp profiles, Supabase requests answered locally); and a **disposable local
PostgreSQL 18.3 cluster** (`node scripts/verify_sql_local.cjs`) that emulates Supabase roles, `auth.uid()` and
Supabase's default function/table grants.

**Verification levels used below**
- *Static* — reviewed in source only.
- *Local* — executed: unit tests, mocked browser tests, or the disposable PostgreSQL cluster.
- *Remote* — executed against hosted Supabase. **Nothing in this audit is remotely verified.** Local SQL results
  show the SQL behaves as intended under an emulation; they do not prove hosted tenant isolation.

---

## Incident disclosure (2026-10-13)

**INC-1 — one unintended request to the live Supabase project.** While adding the fail-closed guard to
`scripts/verify_e2e_journey.cjs` (S-21), the agent executed the script to confirm it refused to start. The edit had
not been written (a scripted edit aborted), so the original script ran and sent **one public `auth.signUp`
request** for a random `testrunner…@gmail.com` address to the project in `.env`. The server rejected it with
`email rate limit exceeded`: no user was created, no confirmation email was sent, no data changed. It counted
against the project's auth rate limit. The guard is now in place and unit-tested offline
(`apps/app/tests/live_script_guard.test.ts`); live scripts are never executed to test them.

---

## Summary

| # | Finding | Severity | Status | Level |
| :--- | :--- | :--- | :--- | :--- |
| S-1 | `track_now_increment_item_count` trusts a client-supplied user id (cross-tenant write, anon-callable) | **Critical** | Fix prepared in `20261012000000`; **NOT APPLIED — owner approval required**. Client already uses the safe contract. | Local (reproduced + fixed) |
| S-14 | Habit edited on a new day continued yesterday's count and could log a fabricated completion | High (integrity) | Fixed in client; server-side rule in `20261013000000` (**NOT APPLIED**) | Local |
| S-21 | Live-Supabase scripts did not fail closed (public sign-up, real email domains, destructive cleanup of `TEST_USER_EMAIL`) | High | Fixed | Local (offline guard tests) |
| S-15 | `/reset-password` let any signed-in session set a new password without recovery proof | Medium | Fixed | Local |
| S-16 | Recovery link could land on the dashboard without asking for a new password; native origins broke the link | Medium | Fixed (owner must allow the redirect URL) | Local |
| S-17 | Implicit auth flow: crafted `#access_token=` link signs a victim into the attacker's account (login CSRF) | Medium | Fixed (PKCE) | Local |
| S-18 | Persistent reminder toasts (item names, Snooze bound to old user) survived sign-out/account switch | Medium | Fixed | Local |
| S-22 | Mocked browser scripts relied on interception + DNS rule only | Medium | Fixed (mock-project build guard) | Local |
| S-25 | Completion history silently truncated at PostgREST's 1000-row cap | Medium (integrity) | Fixed (paging) | Local |
| S-8 | React Router 6.30.6 advisories (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) | Moderate | **Resolved**: upgraded to 7.18.4 | Local |
| S-19 | `safeReturnPath` validated before URL normalisation (`/..//evil.com` → `//evil.com`) | Low | Fixed | Local |
| S-20 | Sign-out cleanup incomplete (expiry kept reminders, shown notifications stayed, double sign-out, stale profile name, previous user's page reused) | Low | Fixed | Local |
| S-23 | Service worker: HTML cached as `/assets/*`, `/\host` accepted as click/push target | Low | Fixed | Local |
| S-24 | CSP lacked `base-uri`, `form-action`, `object-src` | Low | Fixed | Static |
| S-2 … S-13 | Earlier findings (mocked scripts forwarding requests, recovery dead end, sign-out failure, widget cache, inline script vs CSP, script hygiene, test isolation, definer search_path, dump files) | — | Fixed earlier, re-checked | Local |
| S-12 | Dependency advisories | see below | Production: **0**; dev-only remainder justified | Local (`npm audit`) |

---

## S-1 — Cross-tenant write via SECURITY DEFINER RPC (Critical)

- **Where:** `supabase/migrations/20261008000000_harden_constraints_and_rls.sql`,
  `public.track_now_increment_item_count(p_item_id uuid, p_delta int, p_user_id uuid, p_completed_date date)`.
- **Root cause:** `SECURITY DEFINER` (bypasses RLS) + row filter on the **caller-supplied** `p_user_id` + no
  `auth.uid()` check + no pinned `search_path` + Supabase's default `EXECUTE` grant to `anon`/`authenticated`.
- **Evidence (local, reproduced 2026-10-13):** `supabase/verification/local/reproduce_vulnerable_rpc.sql`, run by the
  harness on the un-fixed schema: an **anonymous** caller and a **second signed-in user** raised the victim's
  counter to 5 and forged a completion row. The harness requires this reproduction to succeed before the fix and
  to fail after it, so the checks provably detect the bug.
- **Remediation:** `supabase/migrations/20261012000000_secure_increment_item_count_rpc.sql`
  - drops **every** overload of the name (a planted extra `(uuid,int,uuid)` overload is removed in the test);
  - recreates `(p_item_id, p_delta, p_completed_date, p_reset_count)`; actor = `auth.uid()`; anonymous → `42501`;
  - `SECURITY DEFINER SET search_path = ''`, every object schema-qualified (`GREATEST`/`COALESCE` left unqualified —
    they are SQL constructs; the earlier `pg_catalog.greatest` mistake is not reintroduced);
  - validates `p_delta` (non-zero, |δ| ≤ 10000) and `p_completed_date` (±2 days of server date);
  - `REVOKE ALL … FROM PUBLIC, anon`; `GRANT EXECUTE … TO authenticated, service_role`;
  - pins `search_path` on `handle_new_track_now_user` and `handle_track_now_updated_at`.
- **Client:** never sends a user id; falls back to the RLS-protected path only on `PGRST202` (function missing).
- **Local verification:** `node scripts/verify_sql_local.cjs` → **15/15 harness checks**, including
  `verify_increment_rpc_security.sql` (**22 checks**: single overload, no definer function taking `p_user_id`, no anon
  execute, anon call rejected, cross-tenant call rejected, RLS read/update/insert isolation, owner increment to
  target logs completion, decrement below target removes it, floor at zero, one-off un-completion, zero delta and
  out-of-window date rejected, habit rollover, stale reset ignored), re-application of all migrations, and a real
  concurrency run (8 parallel sessions × 25 increments → exactly 200, one completion).
- **Status:** **NOT APPLIED.** Until the owner applies it, the hosted database still exposes the vulnerable
  function to anyone holding the public anon key. The rollback procedure never restores it (see
  `RELEASE_READINESS.md`).

## S-14 — Habit counter: stale count and fabricated completions (High, integrity)

- **Where:** `apps/app/src/services/executionService.ts` (`editExecutionItem`, `stepItemCount` fallback),
  `components/execution/EditItemModal.tsx`, `ExecutionItemCard.tsx`, the RPC.
- **Root cause:** a habit's `current_count` had no record of which day it belonged to; the client inferred it from
  `updated_at`, which any edit bumps. The edit dialog also pre-filled yesterday's count and always re-sent it, and
  `editExecutionItem` recomputed completion from it: editing (even just opening "Remind" and saving) a habit that
  was finished yesterday **logged a completion for today**, inflating streaks and analytics.
- **Fix:**
  - new column `count_date` (migration `20261013000000_habit_daily_counter.sql`, additive, idempotent, backfilled with
    the `updated_at` trigger suspended, refuses to run before `20261012000000`);
  - the RPC decides the daily restart from `count_date`; a request for an **older** day than `count_date` is rejected
    and changes nothing; the client hint `p_reset_count` is only used for legacy NULL rows;
  - client: shared rules in `src/domain/habitCounter.ts`; edits only touch count/status/history when count, target or
    type change; the dialog pre-fills today's effective count and only sends changed progress fields; every count
    write stamps `count_date` when the column exists (detected from the row — no write of an unknown column before the
    migration).
- **Tests:** `tests/habit_daily_counter.test.ts` (23 tests: next-day edit, same-day edit, midnight boundary, legacy
  heuristic, stale-day rejection, increment/decrement/zero, stale reset never wipes today, persistence failure
  surfaced, paging); mutation-checked (restoring the old count logic makes the new-day edit tests fail).
  SQL: `supabase/verification/verify_habit_daily_counter.sql` (14 checks) + backfill and ordering-guard checks in the
  harness.

## S-21 — Live-Supabase scripts did not fail closed (High)

- **Where:** `scripts/verify_e2e_journey.cjs` (worst), `verify_rls_security.cjs`, `verify_browser_e2e.cjs`.
- **Evidence:** without a service key `verify_e2e_journey.cjs` called public `auth.signUp` for
  `testrunner<ts>@gmail.com` (real email domain, confirmation email, orphaned user), and with `TEST_USER_EMAIL` it
  deleted all of that account's tracks and its profile. No script checked which project it targeted. INC-1 above
  happened through this path.
- **Fix:** `scripts/lib/liveGuard.cjs` — refuses (exit 2) unless `SUPABASE_SERVICE_ROLE_KEY` is set **and**
  `ALLOW_LIVE_SUPABASE` equals the target project ref **and** the ref is not in `PRODUCTION_SUPABASE_REFS`. Public
  sign-up and `TEST_USER_EMAIL` were removed; addresses use the non-routable `.invalid` domain; the journey script
  deletes its throw-away user on failure too.
- **Tests (offline):** `tests/live_script_guard.test.ts` (guard decisions; each script calls the guard before creating
  any client; no `auth.signUp(`, no `@gmail.com`).
- **New:** `scripts/verify_rpc_http_dev.cjs` — the S-1 HTTP smoke test for a development project (anon refused, cross-user
  `42501`, old signature `PGRST202`, owner operations, RLS read isolation, habit restart/stale-day when `count_date`
  exists). Same guard; reads only exported variables (never the repository `.env`, which points at production).
  Written and guard-tested offline; **not run** (no development project was available).

## S-15 / S-16 — Password reset hardening (Medium)

- `/reset-password` rendered the "choose a new password" form for **any** signed-in session (account takeover from an
  unlocked browser or stolen access token; an expired link opened while signed in also showed the form).
  Now the form only appears for a session created by a recovery link (`PASSWORD_RECOVERY`), tracked in a tab-scoped,
  one-hour marker (`features/auth/recoveryMarker.ts`, captured by a listener registered at client creation so the
  event cannot be missed). Link errors (`#error_description=…`) are shown instead of a form.
- If Supabase falls back to the Site URL, the recovery session used to open the dashboard; route guards now send any
  recovery session to `/reset-password` first.
- `redirectTo` uses `VITE_APP_URL` when set (native shells have `https://localhost` / `tracknow://localhost`
  origins), otherwise the page origin.
- **Tests:** `tests/auth_security.test.ts` (rendered with `react-dom/server`: ordinary session gets no form, recovery
  session gets it; marker TTL; link errors; redirect origin), `tests/auth_recovery_signout.test.ts`.
- **Owner action:** add `https://trackapp.atreyakamat.dev/reset-password` to Supabase Auth → Redirect URLs.

## S-17 — Login CSRF via the implicit flow (Medium)

- With the default implicit flow and `detectSessionInUrl`, any app URL carrying an attacker's
  `#access_token=…&refresh_token=…` signed the victim into the attacker's account.
- **Fix:** `flowType: 'pkce'` (`src/lib/supabase/client.ts`): links carry a one-time `?code=` that only the browser
  that started the flow can exchange. Consequence: confirmation/recovery links must be opened on the device that
  requested them (the email is still confirmed server-side if opened elsewhere; the user then signs in normally).
  Default Supabase email templates (`{{ .ConfirmationURL }}`) work unchanged. **Not verified against hosted Auth.**
- **Test:** `tests/supabase_client_config.test.ts`.

## S-18 / S-20 — Session cleanup (Medium / Low)

- Toasts: `clearAll()` on AppShell unmount and on user change; duration-0 reminder toasts can no longer outlive the
  session (`tests/toasts.test.ts`).
- Any `SIGNED_OUT` (manual, expiry, revocation, other tab) and any account switch now wipes the previous user's
  reminders and widget snapshot and closes visible system notifications; the profile name is reset on user change;
  a double click cannot start two sign-outs; after a manual sign-out the next login does not return to the previous
  user's page; an unreachable server shows an "offline" retry screen instead of a login form that cannot work.
- **Tests:** `tests/auth_security.test.ts` (route decisions), `tests/toasts.test.ts`, `tests/auth_recovery_signout.test.ts`.
- **Device-local data kept on purpose:** review notes (`tracknow_reviews_<uid>`) and notification preferences stay on
  the device after sign-out, namespaced per user (another account cannot read them in the app); stated in Settings.

## S-19 — Return-path normalisation (Low)

- `safeReturnPath` now re-checks the normalised pathname (`/..//evil.com`, `/%2e%2e//evil.com`, `/./login`).
  Not exploitable before (router collapses `//`), fixed as defence in depth. Mutation-checked (7 tests fail without
  the fix).

## S-22 — Mocked browser scripts (Medium)

- In addition to CDP interception (never `continueRequest`) and the Chrome DNS block, every mocked script now calls
  `scripts/lib/e2eMock.cjs#assertMockBuild()` and refuses to run unless `apps/app/dist` was built for a **fake project**
  (`https://tracknowe2emockref00.supabase.co`, non-credential key). `scripts/run_mocked_e2e.cjs` builds that bundle,
  runs the suite, and rebuilds the normal bundle. The real project ref was removed from all scripts.

## S-23 / S-24 — Service worker and headers (Low)

- `sw.js` v3: never caches non-OK, opaque or `text/html` responses under `/assets/`; precaches the shell's assets at
  install; prunes assets of old deploys; notification click/push targets must be same-origin paths (rejects `//`,
  `\`, schemes); focuses an existing tab and routes in-app via `postMessage`. Supabase/cross-origin requests are never
  intercepted (`tests/service_worker.test.ts`, node:vm simulation).
- Netlify: `/assets/*` → real 404 before the SPA fallback; CSP adds `base-uri 'none'; form-action 'self';
  object-src 'none'; worker-src 'self'; manifest-src 'self'` (app) and the first three (landing).

## S-25 — Silent truncation (Medium, integrity)

- `listCompletionsForItems`, `listUserDailyCompletionCounts`, `listTodayExecutionItems` and `listItemSummaries` had no
  paging, so accounts with more than 1000 rows got arbitrary partial history (wrong streaks/heatmaps, reminders of
  truncated items cancelled by reconciliation). Now paged with deterministic ordering and chunked `in()` filters
  (`services/helpers.ts#fetchAllPages`). Test: `habit_daily_counter.test.ts` "completion history is paged".

## S-8 — React Router (resolved)

Upgraded `react-router-dom` 6.30.6 → **7.18.4** (library mode, `<BrowserRouter>`; no data router, SSR or loaders).
GHSA-wrjc-x8rr-h8h6 (backslash open redirect in `<Link>`/`navigate`) and GHSA-337j-9hxr-rhxg (SSR
`deserializeErrors`) are fixed in ≥ 7.18.0. `safeReturnPath` remains as defence in depth. All routes, redirects and
auth flows pass the unit suite and the mocked browser suite after the upgrade. Netlify builds pin `NODE_VERSION = "22"`
(React Router 7 requires Node ≥ 20).

## S-12 — Dependencies (`npm audit`, 2026-10-13, after changes)

`npm audit --omit=dev`: **0 vulnerabilities.**

Full `npm audit`: 3 remaining, all **dev/test-only** (never shipped in either bundle):

| Package | Advisory | Why it remains | Applicability |
| :--- | :--- | :--- | :--- |
| tinypool 1.1.1 (via vitest 3.2.7) | GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr (critical) | Fix requires vitest 5 / tinypool ≥ 2.1.2; npm 10.9.0 crashes (`Cannot read properties of null (reading 'edgesOut')`) resolving vitest ≥ 4's optional peer set | Exploitation needs a prototype-pollution primitive inside the test runner process, i.e. already-malicious test code or dependencies. Not reachable from app input. |
| @vitest/mocker 3.2.7 | GHSA-82fw-gwwq-j7x9 (moderate) | Same upgrade blocker (fixed in 4.1.11) | Requires a test file that registers a malicious redirect mock; tests are first-party. |

Resolved in this pass: Vite 5.4.21 → **6.4.3** (GHSA-fx2h-pf6j-xcff Windows `server.fs.deny` bypass and two others),
esbuild 0.21 → 0.25 (GHSA-67mh-4wv8-2f99), vitest 2.1.9 → **3.2.7** (GHSA-5xrq-8626-4rwp critical UI-server
advisory). To finish the remainder: upgrade npm (≥ 10.9.x with the arborist fix / npm 11) and move to vitest ≥ 4.1.11
(or 5.x for tinypool).

## Secret scan (2026-10-13)

Searched source, scripts, docs and `apps/*/dist` (values never printed) for `sb_secret_`, `service_role`,
`SUPABASE_SERVICE`, JWT-shaped strings and `password=`.
- Bundles: no source maps; the only JWT decodes to `role=anon` (public by design); `sb_secret_`/`password` hits are
  supabase-js library code (key-prefix check, `weak_password` error names).
- Repository: JWTs only in git-ignored `.env`, `apps/app/.env`, `codebase_dump.txt` (all `role=anon`).
  `service_role` appears only in SQL grants, docs and tests; `SUPABASE_SERVICE_ROLE_KEY` is only read from the
  environment by the three guarded live scripts.

## Static review results (no change needed)

- RLS enabled on all seven `track_now_*` tables; `auth.uid()` in `USING` and `WITH CHECK`; plan/item/completion/
  schedule policies verify parent ownership (also exercised by the 22-check SQL script).
- `track_now_track_templates` is intentionally public-read.
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`; no user-controlled `href`/`window.location` targets.
- Migrations reference only `track_now_*` objects; `tracked_profiles` is untouched (asserted by the harness).

## Independent review follow-ups (fixed, `tests/review_followups.test.ts`, mutation-checked)

An adversarial read-only review of this change set found, and this pass fixed:
1. Completing a habit re-created a reminder the user had removed (from delivered history) → only active reminders are
   advanced; cancelling also retires delivered records (`dismissed`).
2. "Snooze" on a still-visible toast revived reminders of completed/deleted items → retired records are not snoozable.
3. Renaming a habit could mark it "done today" from an earlier day's count → `doneTodayAfterEdit`.
4. Offline start could race to the login form (`INITIAL_SESSION` with a null session) → start-up state comes only from
   `getSession()`.
5. Completing a habit left its countdown/custom-time reminder armed → `settleRemindersAfterCompletion` cancels it.
6. Backfill used the UTC day for very recent rows → rows updated within 36 h stay NULL (legacy path).
7. Service worker evicted cached fonts on every deploy → only unreferenced `.js`/`.css` are pruned.
8. Daily briefing lost for the day when the monitor stopped mid-load → state restored.
9. No way out of an abandoned password reset → "Cancel and sign out" on `/reset-password`.

## Residual risks

1. The vulnerable RPC stays live until `20261012000000` is applied (owner action).
2. Hosted RLS isolation, PKCE email links, and the recovery redirect are verified locally/statically only.
3. Device-local review notes and preferences remain in the browser profile after sign-out (namespaced, documented).
4. Users can edit the cosmetic `email` column of their own profile row (RLS-limited to themselves).
5. Dev-only advisories listed in S-12.
6. Without `navigator.locks`, the localStorage fallback lock for cross-tab reminder delivery is best-effort (a rare
   duplicate alert is possible in very old browsers).

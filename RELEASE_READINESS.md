# Track.now — Release Readiness (v1 web)

Last updated: 2026-11-08 · Branch: `main` (pushed; Netlify auto-deploys from it). First written 2026-10-13.

## 2026-11-10: instant ticks, usage visibility, synced notes and focus (branch `feat/product-generalisation`, not pushed)

**What changed**

| Area | Change |
| :--- | :--- |
| Ticks, counters, checklist steps (web and phone) | The screen changes on the tap. Saves run in the background, one at a time per item, in tap order. A failed save shows a message and the list is re-read from the server. A ticked item stays in its section for 0.7 s, then moves to Completed. One habit tick is 3 requests instead of 6. |
| Usage and errors | First-party events and crash reports (`packages/core/src/services/telemetry.ts`), switch in Settings, funnel queries in `supabase/analytics/funnel.sql`. Sends nothing until migration `20261110000000` is applied. |
| Review notes and Today's focus | Saved on the device first, then copied to the account (`packages/core/src/services/syncedState.ts`). Device-only, and labelled so, until migration `20261111000000` is applied. |
| Web reminders while closed | Still not possible (no push server). Settings says so and links to the Android app once `VITE_ANDROID_APP_URL` is set. |

**Verification (2026-11-10, this machine; nothing contacted Supabase)**

| Gate | Result |
| :--- | :--- |
| `npm run typecheck` (core, landing, app, tests) | PASS, exit 0 |
| `apps/mobile`: `npx tsc --noEmit` | PASS, exit 0 |
| `npm test` | PASS, 45 files, 582 tests |
| `node scripts/verify_sql_local.cjs` (disposable local PostgreSQL) | PASS, 40/40 |
| `node scripts/run_mocked_e2e.cjs` (mocked backend, temporary Chrome profile) | PASS, 8/8 scripts, including the new `verify_instant_ticks_e2e.cjs`: with every write delayed 900 ms a tick is on screen about 25 ms after the tap |
| `node scripts/verify_phone_ticks_e2e.cjs` (phone app exported for the web, mocked backend) | PASS: tick shown about 17 ms after the tap, rapid taps, counter, failed-save rollback |
| `npm run build:landing`, app build (inside the browser suite) | PASS |
| Phone app on a real device | NOT RUN. The phone code is typechecked and passes the browser check above, which cannot show frame rate, haptics or touch handling on a device. |

**Owner actions for this release, in order**

1. ✅ `supabase/migrations/20261110000000_client_events.sql` and `supabase/migrations/20261111000000_synced_state.sql`
   applied by the owner in the SQL editor (the owner's word, 2026-11-10; not yet probed read-only).
2. Before shipping builds that include this: publish the updated privacy page (`apps/landing/public/privacy.html`)
   and update the Play Console Data safety form (`Playstore readiness/data-safety.md` has the two new rows).
3. Custom SMTP (below): the owner has said it is not theirs to do. Someone with dashboard access has to.
4. When the Android app is live on Google Play, set `VITE_ANDROID_APP_URL` on the Netlify app site.

### Custom SMTP (owner only; nothing in the code can do this)

Email-code sign-in is the default, so every sign-in sends an email. Supabase's built-in sender is meant for testing
and allows only a handful of emails per hour for the whole project.

1. Pick a provider with a free tier (Resend, Brevo, Postmark, Amazon SES) and verify a sending domain there
   (it gives you SPF and DKIM DNS records to add at your DNS host).
2. Supabase dashboard → Authentication → Emails → SMTP Settings → enable custom SMTP. Enter the provider's host, port,
   username and password, a sender address on the verified domain (for example `no-reply@atreyakamat.dev`) and the
   sender name `Track.now`. The password goes only into this dashboard field: never into the repository, `.env` files
   or Netlify variables.
3. Supabase dashboard → Authentication → Rate Limits → raise "emails sent per hour" to what you expect at peak
   (sign-ins per hour, with headroom). The default after enabling custom SMTP is low; check the number shown there.
4. Authentication → Emails → Templates: keep `{{ .Token }}` in the Magic Link and Confirm signup templates (already
   listed below as the email-code template step).
5. Send yourself one sign-in code from the live site and check it arrives, lands in the inbox, and shows the code.

## Verdict

**LAUNCHED — READY.** Both web sites are live and the hosted database has all three security/habit migrations
applied (owner-applied; verified read-only through the public anon REST role on 2026-11-05). Remaining items below are
hardening or account-bound steps, not launch blockers. Not yet verified by anyone: an authenticated round-trip on the
live project (see "Smoke test after deploy").

### Current live status (2026-11-08)

| Area | Status | Evidence |
| :--- | :--- | :--- |
| Web app `https://trackapp.atreyakamat.dev` | ✅ live | `/`, `/today`, `/reset-password` → 200 (2026-11-08) |
| Landing `https://tracknow.atreyakamat.dev` | ✅ live | `/` → 200 (2026-11-08) |
| `20261012000000` counter RPC fix (S-1) | ✅ applied | anon call to `track_now_increment_item_count` refused (401/42501) |
| `20261013000000` habit `count_date` (S-14) | ✅ applied | `select=id,count_date` → 200; bogus column → 400 |
| `20261014000000` trigger-function revoke | ✅ applied | anon RPC to `handle_new_track_now_user` → `PGRST202` |
| Supabase Auth health | ✅ | `/auth/v1/health` → 200 (2026-11-05) |
| Password-reset redirect URL | ✅ owner, 2026-10-14 | — |
| Mobile (Expo) | Preview APK + OTA channel working; store release pending | `apps/mobile/RELEASE.md` |

Re-run 2026-11-08: `npm test` → **PASS, 35 files, 434 tests**. The table below is the full 2026-10-13 run.

### Open items (none block the web launch)

1. **Signed-in smoke test** on the live app (owner) — see the end of this file.
2. **Custom SMTP** for Auth emails: the built-in sender's rate limit was hit once (INC-1). Supabase → Authentication → SMTP.
3. **Leaked-password protection** is off (Authentication → Password settings; may need a paid plan).
4. Advisor items that are **not Track.now objects** and were deliberately left untouched: `public.rls_auto_enable()`
   (executable by anon/authenticated) and `tracked_profiles` (RLS on, no policies). Review with their owner.
5. Mobile store release: needs the owner's Google Play / Apple accounts (`apps/mobile/RELEASE.md`).

## Next release: Plans/Arcs, minimal Today, quiet gamification (branch `feat/product-generalisation`)

Ship order (each step needs the owner's go-ahead):

1. **Apply** `supabase/migrations/20261108000000_plans_arcs_and_flexible_items.sql` in the Supabase SQL editor
   (additive and idempotent; does not touch other apps' objects). **Applied 2026-11-08** (verified: the new plan,
   item and schedule columns return 200 with the anon key).
2. **Apply** `supabase/migrations/20261108010000_plans_arc_name.sql` (one nullable column, `arc_name`, for the Arc
   grouping). **Applied 2026-11-08** (`track_now_plans?select=arc_name&limit=0` returns 200).
3. **Merge and push** the branch to `main` (Netlify rebuilds both sites). Approved by the owner 2026-11-08.
4. **Import** your plan in Settings → *Import a plan* (e.g. `my-plans/winter-arc-2026.plan.json`, which is git-ignored).

The order matters only for extra fields: the new build works on the current database too. It saves Plans and items
without outcome / start date / weekly target / checklist steps and tells the user, and pausing explains that it needs
the update.

| What changed | Where |
| :--- | :--- |
| Today is the home screen (Focus ≤ 3, Overdue, Due Today, Anytime, Upcoming, Completed), day summary, Momentum, quick add, Plan · Track context | `pages/TodayPage.tsx`, `domain/today.ts` |
| Arc (30/60/90/custom days) or ongoing Plan; outcome, success criteria; pause/resume, complete with review, re-open, "start the next Arc" | `pages/plans/*`, `domain/plans.ts`, `services/plansService.ts` |
| Item start dates, weekly-target habits, checklist steps | `domain/schedule.ts`, `domain/checklist.ts`, item forms |
| Momentum, XP, levels, achievements (derived from completions) | `domain/momentum.ts`, Analytics → *Your progress* |
| Reviews: Plans completed in the period, Plans due for review | `pages/ReviewsPage.tsx`, `domain/reviews.ts` |
| Plan file import (`tracknow.plan.v1`) | `domain/planImport.ts`, `services/planImportService.ts`, Settings |
| Navigation: Today, Tracks, Reviews, Analytics (+ Settings); Dashboard removed, `/dashboard` → `/today` | layout, routes |
| Arcs: Plans across Tracks grouped by `arc_name`; Arc page (`/arcs/:key`), Arcs section on Tracks, chips on Today, "Part of an Arc" on Plan forms | `domain/arcs.ts`, `pages/arcs/ArcPage.tsx`, `components/plans/Arc*.tsx` |
| Retention: weekly planned-vs-done consistency, per-Plan trend, habits kept / slipping / dropped (Analytics and each Arc) | `domain/retention.ts`, `components/insights/RetentionPanel.tsx` |
| Password: change password in Settings (current password verified first), show/hide toggle + strength meter on every password field, reset-link resend cooldown | `auth/password.ts`, `authService.changePassword`, `components/settings/ChangePasswordCard.tsx` |
| Brand: new mark (ring + T + "now" dot) as SVG favicon, PNG icons, apple-touch-icon, Open Graph image, Expo icon set; `node scripts/render_brand.cjs` regenerates them from `brand/tracknow-mark.svg` | `brand/`, `apps/*/public`, `apps/mobile/assets/images`, `components/ui/BrandMark.tsx` |
| Gamified tour (6 steps, Skip always available; auto-opens once for an account with no Tracks, replay from Settings or `/today?tour=1`) and getting-started quests (8, each verified from real records or a local flag; one-time +20 XP each) | `components/onboarding/*`, `domain/quests.ts`, `features/onboarding/onboardingState.ts` |
| Level strip on Today (level, XP to next, active-day streak, this week planned/done), level-up toast once per level, 5 new achievements (Explorer, Perfect week, Comeback, Arc builder, Century) | `components/insights/LevelStrip.tsx`, `hooks/useLifetimeLedger.ts`, `domain/momentum.ts` |

### Routines, mobile parity round two, Play Store pack — 2026-11-09

| Area | What shipped | Where |
| :--- | :--- | :--- |
| Tickable routines | A habit can carry steps (a routine). Steps are ticked per day and reset the next day; the last tick completes the habit for that day through the normal completion log (un-tick removes it). Web and mobile cards, both item forms, plan files (`steps` on habits), library routines | `domain/checklist.ts` (`effectiveHabitSteps`), `executionService.toggleHabitStep`, cards, forms, `domain/planImport.ts` |
| Mobile: calendar | "Plan my week" with +1 day / Next week, and a month grid | `apps/mobile/src/app/(app)/calendar.tsx` |
| Mobile: library | The 8 ready-made setups with start date, preview and import | `apps/mobile/src/app/(app)/library.tsx` |
| Mobile: quick add | "Gym Mon Wed Fri 6am" fills the new-item form | `components/execution/ItemForm.tsx` |
| Mobile: reschedule and skip | "More" on each Today card: Tomorrow / In 3 days / Next week, or skip with a reason; Skipped section with Undo | `app/(app)/(tabs)/index.tsx` |
| Mobile: share links | Create, send (system share sheet) and revoke read-only Plan links | `components/plans/SharePlanCard.tsx` |
| Motion | Web: page and list entrances, tick pop and ring pulse on completion, modal pop, press feedback. Mobile: staggered fade-in lists, spring pop on ticks, eased progress bars. All respect reduced-motion settings | `styles/workspace.css`, `components/ui/Motion.tsx` |
| Activity heatmap | A year of days at a glance on Reviews and Analytics (web) and Reviews and Insights (phone): Mon–Sun weeks, month labels, five intensity levels tuned for light and dark, 3 / 6 / 12-month spans, completions / active days / current and longest run / best day, click or arrow to a day to see what was completed, Track filter (web), the reviewed week or month ringed | `domain/heatmap.ts`, `components/insights/ActivityHeatmap.tsx` (web), `components/insights/Heatmap.tsx` (mobile) |
| Play Store pack | `Playstore readiness/`: listing text, data-safety and content-rating answers, release checklist, icon, feature graphic, 8 captioned phone screenshots (1080×1920) plus raw captures | `Playstore readiness/`, `scripts/render_store_screenshots.cjs` |

Migration `20261109000000` (sharing + account deletion): **applied 2026-11-09** (verified: the shared-plan RPC answers 200 and `track_now_plan_shares` exists with anonymous access refused).

### Growth release — 2026-11-09

Everything from the "make it friendlier for more people" list that can be built without the owner's external accounts:

| Area | What shipped | Where |
| :--- | :--- | :--- |
| First five minutes | `/start` after sign-up: six one-tap setups (Student, Fitness, Freelancer, New parent, Exam prep, Side business) or "just one habit" in plain words (auto-creates Personal → Daily routine) | `pages/StartPage.tsx`, `constants/goalTemplates.ts` |
| Plan library ("store") | `/library`: 8 ready-made setups (Winter Arc 90 days, routines, half-marathon, learn to code, declutter, money reset, creator sprint, exam countdown) with a start date, preview and one-tap import; never duplicates | `constants/planLibrary.ts`, `pages/LibraryPage.tsx` |
| Plain language | Settings → Preferences → Names: Tracks/Plans/Arcs or Areas/Goals/Challenges (labels only) | `domain/terms.ts`, `services/preferences.ts`, `hooks/usePreferences.ts` |
| Natural-language quick add | "Gym Mon Wed Fri 6am", "Call dentist tomorrow", "Run 3x a week !high" fill the Add item form | `domain/quickAdd.ts`, `CreateItemModal.tsx` |
| Reschedule and skip | Item menu on Today: Tomorrow / Next week / pick a date; Skip today with a reason. Skips are rest days: left out of Today totals, streaks and retention | `services/skipService.ts`, `domain/streaks.ts`, `domain/retention.ts`, `domain/today.ts` |
| Calendar | `/calendar`: "Plan my week" (7 days with one-tap moves) and a month grid | `pages/CalendarPage.tsx` |
| Gentle mode | Settings → Preferences → Motivation: hides XP, levels, quests, achievements; Momentum stays (web + mobile) | `services/preferences.ts` |
| Shareable weekly card | 1080×1080 PNG "Week N of my Arc: X/Y done" via the share sheet or download, on Analytics and each Arc | `domain/shareCard.ts`, `components/insights/ShareWeekCard.tsx` |
| Accountability partner | Read-only share link per Plan (`/share/:token`), revocable; public RPC returns only that Plan | `services/shareService.ts`, `pages/SharedPlanPage.tsx`, migration `20261109000000` |
| Email code sign-in (default) | Sign-in and sign-up default to a 6-digit code sent by email (no password, no third party); a Password tab stays beside it. Web and mobile. Sign-in never creates accounts; sign-up does. 60-second resend cooldown | `authService.sendEmailCode` / `verifyEmailCode`, `components/auth/EmailCodeSignIn.tsx` (web and mobile) |
| Google / Apple sign-in | Built but **not shown** (owner's choice, 2026-11-09). `OAuthButtons.tsx` and `authService.signInWithProvider` are kept for later | `components/auth/OAuthButtons.tsx` |
| Import from elsewhere | CSV import (Todoist / Habitica exports or any sheet with a name column) into a chosen Plan | `domain/csvImport.ts`, `components/settings/DataCard.tsx` |
| Export and delete | Export everything as JSON or CSV; delete account (typed confirmation, server-side RPC) | `domain/exportData.ts`, `services/accountService.ts`, `DeleteAccountCard.tsx` |
| Privacy page | `tracknow.atreyakamat.dev/privacy.html`: exactly what is stored and where; linked from the landing footer and Settings | `apps/landing/public/privacy.html` |
| Clock | 12-hour / 24-hour / follow device preference | `services/preferences.ts` |
| GTM | `docs/GTM_PLAYBOOK.md`: positioning, channels, accounts to register, content system, launch sequence, 100 strategies | `docs/GTM_PLAYBOOK.md` |

**Needs the owner (2026-11-09):**
1. ~~Apply `20261109000000_account_deletion_and_plan_sharing.sql`~~ **Applied 2026-11-09.**
2. **Email code template:** in Supabase → Authentication → Email Templates, add `{{ .Token }}` to the **Magic Link** and **Confirm signup** templates (for example: "Your Track.now code is {{ .Token }}"). Without it the email contains only the link (which still signs in on the web). Custom SMTP (item 2 at the top) matters more now: the built-in sender allows only a few emails per hour.
3. Social accounts and the newsletter from `docs/GTM_PLAYBOOK.md` section 4.

**Deliberately not built (and why):** iOS home-screen widget (needs a Mac and expo-apple-targets), full localisation into Hindi/Spanish/Portuguese (hundreds of strings; the preferences scaffold is in place), offline-first write queue on mobile (reads are cached already; a sync engine is a multi-week project), paid tier (needs a payment provider account), Google Calendar / Apple Reminders import (OAuth / native APIs; CSV covers Todoist/Habitica), Monday/Sunday week start (every calculation is Monday-based on purpose).

### Mobile (Expo) parity — 2026-11-08

The same release on `apps/mobile`, sharing every calculation through `@tracknow/core`:

| What changed | Where |
| :--- | :--- |
| Today is the home tab (5 tabs: Today, Tracks, Insights, Reviews, Settings; the Dashboard tab is gone, its heatmap moved to Insights): Focus (star, max 3), Overdue / Due today / Anytime / Upcoming / Completed, swipe-to-complete, day summary + Momentum + level strip (level, XP, active-day streak, this week), Arc chips, quests card, tour, quick-add FAB with Plan picker, checklist steps, weekly-target status, "Starts <date>" | `app/(app)/(tabs)/index.tsx`, `components/onboarding/*`, `components/insights/LevelStrip.tsx` |
| Plans: Arc / Ongoing kind, length presets, outcome + criteria, "Part of an Arc" (with suggestions), Day X of N, due-for-review banner, Pause / Resume / Re-open / Archive, Complete with a review screen (records + what happened / learned / next), completed card with "Start the next Arc" | `app/(app)/plan/*`, `components/plans/PlanFields.tsx`, `components/plans/PlanCard.tsx` |
| Items: start date, "times a week" repeat, checklist steps editor | `components/execution/ItemForm.tsx`, `ExecutionItemCard.tsx`, `hooks/useExecutionItemActions.ts` |
| Arcs: section on Tracks, Arc screen with progress, Plans by Track and retention | `app/(app)/arc/[key].tsx`, `components/plans/ArcCard.tsx`, `hooks/useTracksOverview.ts` |
| Insights: level / XP / achievements / quest bonus, retention (weekly bars, by Plan, habits kept/slipping/dropped), consistency heatmap, then the range analytics — all from one lifetime ledger load | `app/(app)/(tabs)/analytics.tsx`, `components/insights/*` |
| Reviews: Plans due for review, Plans completed in the period (with their review), monthly "outcomes" prompt | `app/(app)/(tabs)/reviews.tsx` |
| Settings: change password (current password verified), replay the tour / show quests, import a plan by pasting JSON | `app/(app)/(tabs)/settings.tsx`, `components/settings/*` |
| Auth: brand mark, show/hide password + strength meter, reset-link resend cooldown | `app/(auth)/*`, `components/ui/PasswordField.tsx`, `components/ui/BrandMark.tsx` |
| Shared onboarding state (tour done, focus used, quests dismissed, last level) moved to core behind the storage seam, so web and mobile use one implementation | `packages/core/src/services/onboardingState.ts` |

Ship: JS-only changes go out with `eas update --branch preview --environment preview` to the installed OTA-enabled APK.
The new app icon, splash and adaptive-icon colours are **native** and need a new `eas build` (preview APK) before
they show on a device; until then the old icon stays and everything else works.

Verification (2026-11-08): mobile `tsc --noEmit` PASS (typed routes regenerated) · `expo export -p android -p web` PASS ·
web suite still 41 files / 491 tests PASS · web typecheck PASS.

Verification (2026-11-08, final): typecheck PASS (web, core, mobile `tsc --noEmit`) · `npm test` **PASS, 42 files, 512 tests** ·
both production builds PASS · `node scripts/verify_sql_local.cjs` **21/21** · `node scripts/run_mocked_e2e.cjs` **7/7 PASS** (responsive audit: no overflow 320–1920 px, light + dark) · `npm audit --omit=dev` 0.

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
| App — `https://trackapp.atreyakamat.dev` | repo root (`netlify/app/netlify.toml`; the app needs the `@tracknow/core` workspace) | `npm run build:app` | `apps/app/dist` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, recommended `VITE_APP_URL=https://trackapp.atreyakamat.dev` |

- Config: `netlify/app/netlify.toml` / `apps/app/netlify.toml` and `netlify/landing/netlify.toml` /
  `apps/landing/netlify.toml` (pairs are identical; use the one matching how each site's base directory is set).
- `NODE_VERSION = "22"` is pinned in every `netlify.toml` (React Router 7 requires Node ≥ 20).
- App redirects: `/assets/*` → 404 (missing assets are never served as HTML), then `/* /index.html 200` (SPA deep
  links). Same rules in `apps/app/public/_redirects`.
- Headers: `X-Frame-Options DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP
  (`script-src 'self'`, `connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co`,
  `base-uri 'none'`, `form-action 'self'`, `object-src 'none'`, `frame-ancestors 'none'`).
- Never put a service-role key in any `VITE_` variable or Netlify site.

## Owner actions, in order

1. **Database migrations:** ✅ all three applied by the owner in the SQL editor (verified 2026-11-05, see table above).
   The history below is kept for reference and for any new environment.
2. **Password-reset redirect:** ✅ done by the owner on 2026-10-14 (`https://trackapp.atreyakamat.dev/reset-password`
   added to Supabase Auth redirect URLs). `VITE_APP_URL` intentionally not set (the web origin is used).
3. **PKCE note:** default email templates (`{{ .ConfirmationURL }}`) work unchanged. Links must be opened in the browser
   that requested them; tell users that in support copy if needed.
4. **Signup rate limit / bounced emails:** review Supabase Auth logs and SMTP settings (the frontend only reports them).
5. **Deploy:** ✅ both sites first deployed on 2026-10-14 from `main` @ `4bf8096` (Netlify `apptracknow`, `tracknowapp`);
   verified over HTTP (routes 200, SW v3, `/assets/*` 404, CSP, PKCE bundle). They now auto-deploy from `main`
   (app built from the repo root since `1994ff4`). Signed-in smoke test pending.
6. Optional: run the live scripts against a **disposable** project only:
   `SUPABASE_SERVICE_ROLE_KEY=… ALLOW_LIVE_SUPABASE=<dev-ref> PRODUCTION_SUPABASE_REFS=<prod-ref> node scripts/verify_rls_security.cjs`.

## Applying the migrations

Files (apply in this order, each only once — already applied to production):
1. `supabase/migrations/20261012000000_secure_increment_item_count_rpc.sql` — security fix (S-1).
2. `supabase/migrations/20261013000000_habit_daily_counter.sql` — `count_date` + daily-restart RPC (S-14). It refuses
   to run if step 1 is missing.
3. `supabase/migrations/20261014000000_revoke_trigger_function_execute.sql` — revokes API EXECUTE on the sign-up
   trigger function (advisor 0028/0029). Provisioning still works (local harness 17/17).

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
5. **Migration history:** the production migration history table is **empty** (checked read-only on 2026-10-14): the
   earlier files were applied by hand. Do **not** use `supabase db push`. `supabase migration list --linked`. If `20261005000000`/`20261008000000` were applied by hand,
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

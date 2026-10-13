# Track.now — Roadmap & Status

Status legend: **Done** (implemented and covered by tests), **Partial** (works with stated limits),
**Blocked** (needs an owner action or external dependency), **Future** (not started; out of v1 scope).

Evidence for every "Done" item is in `RELEASE_READINESS.md` (commands, exit codes, test counts).
Security findings and remediations are in `SECURITY_AUDIT.md`.

> Note: the earlier `audit_findings.json` (zero findings) was a responsive screenshot audit only.
> It was never a security or functional audit.

---

## v1 — Core product

| Area | Status | Notes |
| :--- | :--- | :--- |
| Monorepo, two Netlify sites (landing + app) | Done | `apps/landing` has no Supabase dependency. |
| Email/password auth, session restore, protected/public routes | Done | PKCE flow (no login CSRF via URL fragments). Offline sessions get a retry screen. Mocked tests only; live Auth was deliberately not exercised. |
| Duplicate-submit guards and 429 / rate-limit messaging | Done | A frontend cannot remove the server-side Supabase limit. |
| Password reset (request link + set new password page) | Partial | Form shown only for a recovery-link session; recovery sessions are routed to `/reset-password`. The owner must add it to the Supabase redirect allow-list; with PKCE the link must be opened on the device that requested it. |
| Return to the intended page after login | Done | Validated same-origin paths only. |
| Sign-out that cannot leave the user signed in when offline | Done | Falls back to local sign-out and says so. |
| Tracks: create (templates/custom), edit, duplicate-name confirmation, archive, restore, delete | Done | Duplicate names allowed after confirmation. |
| Plans: create, edit (date validation), archive, restore, delete | Done | Archive/delete also cancel device reminders. |
| Execution items: habit, task, checklist, milestone, project — create/edit/delete | Done | Delete now asks for confirmation; schedule failures are never silent. |
| Today view: Overdue / Due Today / Anytime / Upcoming / Completed Today | Done | Only active Tracks and Plans; midnight rollover reloads. |
| Completion log, idempotent per item per day | Done | Unique index `(item_id, completed_date)`. |
| Numeric targets with +/- stepper | Done | Atomic RPC once the prepared migrations are applied; RLS-protected fallback before that. Habits restart daily from `count_date` (renaming/editing a habit on a new day no longer carries yesterday's count or logs a fake completion). |
| Progress rollups (item, plan, track, dashboard) | Done | Habits count as done only if completed today; habits not scheduled today are left out of today's total. Empty = 0%. History queries are paged (no 1000-row truncation). |
| Habit streaks, consistency, calendar heatmap | Done | Rest days do not break streaks. "Monthly" habits are treated as daily (see Future). |
| Smart reminders (all item types; in X time / X before / at time / custom) | Partial | Device-local; fire only while the app is open (see Reminders below). |
| Daily briefing and overdue alerts | Partial | Once a day while the app is open; no background delivery. |
| Settings: profile, theme, notification preferences, honest capability table | Done | |
| Analytics v1 (trends, habit consistency, per-track progress, overdue, recent) | Done | Built only from real completions; no sample data. |
| Reviews v1 (weekly review + monthly reflection) | Partial | Notes are stored on this device only (no table approved), per user; unsaved notes are kept when navigating away. "Mark done" is idempotent. |
| PWA manifest + service worker (offline shell, notification click routing) | Partial | Shell + assets precached, old deploys pruned, in-app routing on notification click. No Web Push sender; SVG-only icon. |
| Security remediation of `track_now_increment_item_count` + habit `count_date` | Blocked | Migrations `20261012000000` and `20261013000000` prepared and verified on a disposable local PostgreSQL (`node scripts/verify_sql_local.cjs`, 15/15); **not applied**; owner approval required. |
| Live multi-user RLS verification | Blocked | Requires an isolated Supabase project and admin credentials; not run. |

## Reminders — what actually works

| Situation | Delivery |
| :--- | :--- |
| App open, active tab | In-app alert always; system notification if enabled and permitted. |
| App open, background tab | System notification if enabled and permitted and no other Track.now tab is visible; otherwise it waits for a visible tab. One delivery across tabs. |
| Browser / installed app closed | Nothing fires. Due reminders appear on next open (3 individually, rest as a summary; anything more than 1 day late only in the summary). Reminders of items completed/deleted elsewhere are reconciled away first. |
| Native Android / iOS | Not available — no native app is built. |

## Blocked — owner actions

1. Review and apply `supabase/migrations/20261012000000_secure_increment_item_count_rpc.sql`, then `20261013000000_habit_daily_counter.sql` (see `RELEASE_READINESS.md`).
2. Add `https://trackapp.atreyakamat.dev/reset-password` to Supabase Auth → URL Configuration → Redirect URLs.
3. Investigate the live signup rate limit / bounced emails in the Supabase dashboard (Auth logs, SMTP settings).
4. Run a cross-tenant RLS test against an isolated (non-production) Supabase project.

## Native mobile — Blocked

- `android/` contains widget sources only (no Gradle project, no `MainActivity`, no Capacitor app). No Android SDK on the build machine. The manifest's duplicate receiver declaration was fixed (medium size has its own subclass).
- `ios/` contains SwiftUI widget sources only (no Xcode project, no app target, no App Group wiring). Requires macOS + Xcode.
- No `@capacitor/*` packages are installed; the `TrackNowWidgetBridge` plugin referenced by `nativeMobileBridge.ts` is not implemented.
- Next step: `npx cap add android` / `npx cap add ios`, implement the bridge plugin, wire App Group / SharedPreferences, then build and test on devices.

## Future (not in v1)

- Hierarchical subtasks and checklist items inside projects.
- Drag-and-drop reordering persisted to `position`.
- True monthly habit cadence (schedule semantics + streak rules).
- Synced review notes (needs an approved `track_now_reviews` table).
- Web Push (VAPID keys, subscription storage, a sender service) for closed-browser reminders.
- Offline mutation queue and Supabase Realtime multi-device sync.
- Domain modules: fitness logs, finance balances, career OKRs, reading lists, business pipeline.
- Track balance radar, created-vs-completed velocity over long horizons, average days to completion.
- Raster/maskable PWA icons and Apple touch icon.

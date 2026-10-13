# Track.now

> A personal execution and life-management operating system designed for clarity, intentionality, and daily momentum.

Track.now is an editorial personal execution system structured into two independently deployable experiences:
1. **Public Marketing & Product Showcase:** `https://tracknow.atreyakamat.dev` (`apps/landing`)
2. **Authenticated Application:** `https://trackapp.atreyakamat.dev` (`apps/app`)

---

## 1. Product Concept & Hierarchy

Track.now models life management through a deterministic execution hierarchy:

```
User
  └── Tracks (Major life domains: Fitness, Finance, Career, Learning, Business, Custom)
        └── Plans / Arcs (Time-bound campaigns, quarters, or specific strategic arcs)
              └── Execution Items (Actionable units: Tasks, Habits, Checklists, Milestones, Projects)
                    ├── Scheduling (Due dates, recurrence, time-of-day)
                    ├── Completion (Atomic status toggling & unique daily completion log)
                    └── Progress (Deterministic rollups at Plan and Track levels)
```

---

## 2. Multi-Site Architecture & Deployment

The repository is organized as an npm workspace monorepo supporting two distinct Netlify sites:

| Deployment | Domain | Source Directory | Base Directory | Netlify Build Command | Publish Directory |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Marketing Site** | `https://tracknow.atreyakamat.dev` | `apps/landing` | `apps/landing` | `npm run build` | `dist` |
| **Application** | `https://trackapp.atreyakamat.dev` | `apps/app` | `apps/app` | `npm run build` | `dist` |

- **Zero Runtime Dependencies:** The landing site does not import application source or Supabase clients; the application does not import landing marketing source.
- **SPA Routing:** Application deep navigation (`/login`, `/signup`, `/reset-password`, `/dashboard`, `/tracks/*`, `/plans/*`, `/today`, `/reviews`, `/analytics`, `/settings`) is rewritten to `/index.html` via `apps/app/netlify.toml` and `apps/app/public/_redirects`.
- **Security:** Zero service-role credentials in client bundles. The frontend interacts strictly through browser-safe Supabase credentials protected by PostgreSQL Row Level Security (RLS).

---

## 3. Technology Stack

- **Frontend Core:** React 18, TypeScript, Vite 6, React Router v7 (library mode)
- **Backend & Data Platform:** Supabase (Auth + PostgreSQL RLS)
- **Icons & Typography:** Lucide React, `@fontsource-variable/inter`
- **Testing:** Vitest (mocked Supabase; unit tests can never reach a live project) plus mocked headless-Chrome scripts in `scripts/`

---

## 4. Repository Structure

```
track.now/
├── apps/
│   ├── landing/                   # Public marketing & product site (tracknow.atreyakamat.dev)
│   │   ├── src/
│   │   │   ├── components/        # Standalone presentation components (ProgressCircle)
│   │   │   ├── hooks/             # Local theme persistence hook
│   │   │   ├── pages/             # LandingPage with all editorial sections
│   │   │   ├── styles/            # tokens.css, landing.css, base.css
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── netlify.toml
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   │
│   └── app/                       # Authenticated application (trackapp.atreyakamat.dev)
│       ├── public/                # Static assets + _redirects for Netlify SPA routing
│       ├── src/
│       │   ├── components/        # App shell, cards, modals, form controls
│       │   ├── domain/            # Pure business rules (progress, dates, streaks, today, analytics, reviews, briefing)
│       │   ├── features/auth/     # Auth provider & Supabase auth service
│       │   ├── pages/             # Dashboard, Tracks, Plans, Today, Analytics, Reviews, Settings, auth
│       │   ├── routes/            # Route guards (ProtectedRoute, PublicRoute)
│       │   ├── services/          # Supabase repositories (tracks, plans, execution)
│       │   ├── styles/            # Design tokens and shared application layout
│       │   ├── types/             # Domain TypeScript contracts
│       │   └── main.tsx
│       ├── tests/                 # Unit & regression test suites (Vitest)
│       ├── index.html
│       ├── netlify.toml
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── netlify/
│   ├── landing/netlify.toml       # Monorepo deployment reference for Landing
│   └── app/netlify.toml           # Monorepo deployment reference for App
├── scripts/                       # E2E & Chrome CDP responsive verification scripts
├── supabase/migrations/           # PostgreSQL DDL migrations & RLS policies
├── package.json                   # Root monorepo workspace configuration
├── tsconfig.json                  # Root TypeScript solution configuration
├── ENVIRONMENT.md                 # Environment variables and deployment specifications
└── README.md
```

---

## 5. Development Scripts

From repository root:

| Command | Action |
| :--- | :--- |
| `npm run dev:landing` | Starts local dev server for landing site |
| `npm run dev:app` | Starts local dev server for authenticated application |
| `npm run typecheck` | Typechecks `apps/landing`, `apps/app/src`, and `apps/app/tests` |
| `npm test` | Executes Vitest unit tests in `apps/app` |
| `npm run build` | Builds both `apps/landing` and `apps/app` production bundles |
| `npm run build:landing` | Builds landing production bundle in `apps/landing/dist` |
| `npm run build:app` | Builds application production bundle in `apps/app/dist` |

---

## 6. Status, Security & Release Documents

- `TODO.md` — what is done, partial, blocked, and future (kept in sync with the code).
- `SECURITY_AUDIT.md` — findings, severity, fixes, tests, and owner actions.
- `RELEASE_READINESS.md` — exact verification commands and results, deployment and rollback steps.

Important limits of the current v1:

- Reminders, review notes, and the widget snapshot are stored **on this device only**.
- Reminders fire only while Track.now is open in a browser tab; nothing fires with the browser closed.
- Android/iOS widget sources exist, but there is **no native app build** yet.
- Two prepared migrations (`20261012000000_secure_increment_item_count_rpc.sql`, a critical security fix, and
  `20261013000000_habit_daily_counter.sql`) are **not applied** and need owner approval — see `RELEASE_READINESS.md`.
  Both pass `node scripts/verify_sql_local.cjs` on a disposable local PostgreSQL cluster.

### Browser test scripts

| Script | Type |
| :--- | :--- |
| `verify_numeric_e2e`, `verify_streaks_heatmap_e2e`, `verify_sidebar_scroll_signup_e2e`, `verify_reminders_notifications_e2e`, `verify_every_task_reminders_e2e`, `audit_ux_responsive`, `verify_responsive_cdp` | **Mocked.** Run them with `node scripts/run_mocked_e2e.cjs` (builds the app against a fake Supabase project, runs them, rebuilds the normal bundle). They refuse any other build, intercept every Supabase request, block Supabase DNS, use a temporary Chrome profile, and save screenshots to the OS temp folder. |
| `verify_rls_security`, `verify_e2e_journey`, `verify_browser_e2e`, `verify_rpc_http_dev` | **Live.** Create real users. They refuse to start unless `SUPABASE_SERVICE_ROLE_KEY` is set and `ALLOW_LIVE_SUPABASE` equals the target project ref (and it is not in `PRODUCTION_SUPABASE_REFS`). Disposable projects only. |
| `verify_sql_local` | **Local database.** Creates, uses and deletes a throw-away PostgreSQL cluster on 127.0.0.1; never touches Supabase. |

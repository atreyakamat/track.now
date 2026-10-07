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
- **SPA Routing:** Application deep navigation (`/login`, `/signup`, `/dashboard`, `/tracks/*`, `/plans/*`, `/today`, `/settings`) is rewritten to `/index.html` via `apps/app/netlify.toml` and `apps/app/public/_redirects`.
- **Security:** Zero service-role credentials in client bundles. The frontend interacts strictly through browser-safe Supabase credentials protected by PostgreSQL Row Level Security (RLS).

---

## 3. Technology Stack

- **Frontend Core:** React 18, TypeScript, Vite 5, React Router v6
- **Backend & Data Platform:** Supabase (Auth + PostgreSQL RLS)
- **Icons & Typography:** Lucide React, `@fontsource-variable/inter`
- **Testing:** Vitest for pure domain logic, route guard logic, and progress calculations

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
│       │   ├── domain/            # Pure business rules (progress, dates)
│       │   ├── features/auth/     # Auth provider & Supabase auth service
│       │   ├── pages/             # Dashboard, Tracks, Plans, Today, Settings
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
| `npm run typecheck` | Typechecks both `apps/landing` and `apps/app` |
| `npm test` | Executes Vitest unit tests in `apps/app` |
| `npm run build` | Builds both `apps/landing` and `apps/app` production bundles |
| `npm run build:landing` | Builds landing production bundle in `apps/landing/dist` |
| `npm run build:app` | Builds application production bundle in `apps/app/dist` |

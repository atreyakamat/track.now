# Track.now

> A personal execution and life-management operating system designed for clarity, intentionality, and daily momentum.

Track.now is a modern, modular web application built to organize major life domains into coherent, actionable execution hierarchies without childish gamification, microservice overhead, or rigid templates.

---

## 1. Product Concept & Hierarchy

Track.now models life management through an intentional hierarchy:

```
User
  └── Tracks (Major life domains: Fitness, Finance, Career, Learning, Business, Custom)
        └── Plans / Arcs (Time-bound campaigns, quarters, or specific strategic arcs)
              └── Execution Items (Actionable units: Tasks, Habits, Checklists, Milestones, Projects)
                    ├── Scheduling (Due dates, recurrence, time-of-day)
                    ├── Completion (Atomic status toggling & timestamped completion log)
                    ├── Progress (Deterministic rollups at Plan and Track levels)
                    └── Reviews (Weekly & monthly retrospective audits)
```

### The 5 Predefined Track Templates
When getting started, Track.now provides 5 opinionated templates to accelerate setup:
1. **Fitness** — Physical conditioning, training splits, nutrition habits, and endurance milestones.
2. **Finance** — Budget tracking, investment reviews, debt elimination arcs, and savings goals.
3. **Career** — Role advancement, portfolio building, networking targets, and quarterly deliverables.
4. **Learning & Productivity** — Skill acquisition, reading lists, study sprints, and system workflows.
5. **Business** — Revenue milestones, product launches, client acquisition, and operational hygiene.

*Note: Templates are accelerators, not constraints. Users can create custom tracks with custom colors and icons, and duplicate track names are never blocked (a courteous confirmation modal allows using existing or spinning up another).*

---

## 2. Architecture & Tech Stack

Track.now is engineered as a **clean, modular monolithic single-page application** powered by a serverless relational data engine:

- **Frontend Core:** React 18, TypeScript, Vite 5, React Router v6
- **Backend & Data Platform:** Supabase
  - **Auth:** Supabase Auth (Email / Password session management, secure cookies/tokens, auto-profile sync)
  - **Database:** PostgreSQL with Row Level Security (RLS) ensuring strict multi-tenant isolation
  - **Storage & Realtime:** Supabase storage buckets and Postgres change listeners
- **Icons & Typography:** Lucide React, `@fontsource-variable/inter`
- **Testing:** Vitest for pure domain logic and calculations
- **No Legacy Constraints:** Zero Firebase/Firestore dependencies, zero microservice complexity, zero external Node/Express/Flask backends required.

---

## 3. Design System & Aesthetic

Inspired by high-end hardware, audio engineering interfaces, and editorial publications:
- **Light Mode:** Warm cream / off-white base (`#f4efe6`), deep black typography (`#121110`), soft pastel/neon accents (`#06d6a0`, `#3a86ff`, `#ffbe0b`, `#ff006e`, `#8338ec`), muted gray surfaces (`#e8e2d5`).
- **Dark Mode:** Near-black background (`#0e0e0c`), crisp cream/white text (`#f4efe6`), darkened surface layers (`#171614`).
- **Tokenized CSS Variables:** All colors, spacing, borders, shadows, and radii are defined in `src/styles/tokens.css` for effortless theming.
- **Tone:** Calm, focused, mature, and editorial. Never childish or cluttered with cartoonish reward mechanics.

---

## 4. Getting Started

### Prerequisites
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- A Supabase project (hosted or local via Supabase CLI)

### 1. Installation
```bash
git clone https://github.com/your-org/track.now.git
cd track.now
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase connection parameters:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```
*(If keys are missing, the application renders a friendly configuration guidance notice instead of crashing).*

### 3. Initialize Database
Execute the migration script against your Supabase database:
- Open your Supabase Dashboard → **SQL Editor**
- Paste and run the contents of [`supabase/migrations/20261005000000_init_track_now.sql`](supabase/migrations/20261005000000_init_track_now.sql).

### 4. Development Server
Start the local Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 5. Development Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite dev server with hot module replacement |
| `npm run typecheck` | Runs `tsc -b --noEmit` across all TypeScript modules |
| `npm test` | Executes unit tests via Vitest in single-run mode |
| `npm run build` | Performs type checking and creates production bundle in `dist/` |
| `npm run preview` | Locally serves the production build for smoke testing |

---

## 6. Project Structure

```
track.now/
├── dist/                   # Production build output
├── public/                 # Static assets (favicons, manifest.webmanifest)
├── src/
│   ├── components/         # Reusable UI component library
│   │   ├── execution/      # Execution item cards, creation modals
│   │   ├── layout/         # AppShell, Sidebar, Topbar, MobileNav
│   │   ├── plans/          # Plan cards, status badges
│   │   ├── tracks/         # Track cards, template selectors, icons
│   │   └── ui/             # Atomic controls (Button, Fields, Modal, Progress, Tabs, States)
│   ├── constants/          # Track templates, palette mappings, icon sets
│   ├── domain/             # Pure business rules (progress math, scheduling, dates)
│   ├── features/           # Feature slices (auth provider, user context)
│   ├── hooks/              # Custom React hooks (useTheme, useDebounce, etc.)
│   ├── lib/supabase/       # Supabase client wrapper and readiness detection
│   ├── pages/              # Routed view containers
│   │   ├── auth/           # Login, Signup
│   │   ├── plans/          # Plan detail workspace, Plan creation
│   │   ├── tracks/         # Track list, Track detail, Track creation
│   │   ├── AnalyticsPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── ReviewsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── TodayPage.tsx
│   ├── routes/             # Route configurations & ProtectedRoute wrapper
│   ├── services/           # Supabase repository adapters (Tracks, Plans, Execution)
│   ├── styles/             # Global CSS, tokens, resets, component styles
│   ├── types/              # Domain models and TypeScript contracts
│   ├── utils/              # Formatting helpers, strings, dates
│   ├── App.tsx             # Root React application component
│   └── main.tsx            # Application entrypoint
├── supabase/
│   └── migrations/         # PostgreSQL DDL migrations & RLS policies
├── tests/                  # Pure unit test suites (Vitest)
├── ARCHITECTURE.md         # Layered architectural breakdown and dependency rules
├── DATABASE.md             # PostgreSQL schema, entity relations, and RLS definitions
├── ENVIRONMENT.md          # Environment variable specifications and local dev guide
└── TODO.md                 # Detailed milestone roadmap for future phases
```

---

## 7. License

Private / Proprietary. All rights reserved.

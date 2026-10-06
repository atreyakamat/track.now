# Track.now — Roadmap & TODO Specification

This document lays out the phased development roadmap for **Track.now**, from the current foundational release to advanced domain modules, analytics, and offline sync.

---

## Current Status: Phase 1 (Foundation & Core Shell) — [COMPLETED]

- [x] Clean architecture scaffolded with React 18, TypeScript, Vite 5, React Router v6.
- [x] Complete removal of legacy Vue/Quasar/Firebase code.
- [x] PostgreSQL relational schema with Row Level Security (RLS) policies.
- [x] Design token system (warm cream light mode, near-black dark mode, MIDI/editorial aesthetic).
- [x] Supabase Auth integration (email/password signup, login, session persistence, profile sync).
- [x] 5 Predefined Track templates (Fitness, Finance, Career, Learning & Productivity, Business).
- [x] Custom Track creation with custom colors and Lucide icons.
- [x] Non-blocking duplicate track confirmation flow.
- [x] Track and Plan lifecycle management (Active, Archive, Restore).
- [x] Plan execution workspace with 5 Item Types (Habit, Task, Checklist, Milestone, Project).
- [x] Real-time atomic completion toggling.
- [x] Pure deterministic progress calculations across Items, Plans, and Tracks (0% faking).
- [x] Today view with time-aware grouping (Overdue, Due Today, Anytime, Upcoming, Completed) and active-only scoping (`listTodayExecutionItems`).
- [x] Database-level duplicate completion prevention via unique index `(item_id, completed_date)` and idempotent conflict resolution.
- [x] Full responsive design verified across viewports (320px–1920px) with mobile bottom nav and dialog overflow protection.
- [x] Security audited: zero hard-coded secrets or service_role keys in source code or client bundles.
- [x] 100% passing Vitest test suite (25/25 unit tests) for domain math, date scheduling, and domain invariants.
- [x] Zero-error TypeScript compilation and production build (`dist/`).
- [x] Live Supabase E2E full user journey and RLS tenant isolation verified.

---

## Phase 2: Execution Engine Expansion

- [ ] **Habit Streaks & History Engine:**
  - [ ] Implement streak calculator (current streak, longest streak, consistency percentage) using `item_completions`.
  - [ ] Habit daily completion calendar heatmap in Plan workspace.
  - [ ] Habit reset behavior based on `item_schedules.frequency` (daily, weekly, custom days).
- [ ] **Numeric Target Progress:**
  - [ ] Interactive counter controls (`-` / `+`) on cards with `target_count > 1` (e.g., 8 glasses of water, 50 pushups, 20 pages read).
  - [ ] Automatic status transition to `'done'` when `current_count >= target_count`.
- [ ] **Hierarchical Checklists & Subtasks:**
  - [ ] Nested subtask items inside Projects and Tasks.
  - [ ] Child task completion rolling up into parent task status.
- [ ] **Drag & Drop Reordering:**
  - [ ] Reorder Execution Items within a Plan via HTML5 drag-and-drop or pointer events.
  - [ ] Persist `position` column updates to Supabase batch API.

---

## Phase 3: Domain-Specific Track Modules

Specialized widgets and domain-specific data models layered on top of core Tracks:

### 3.1 Fitness Track
- [ ] Workout split planner (e.g. Push/Pull/Legs, Upper/Lower).
- [ ] Exercise weight/rep log tables for strength training.
- [ ] Body metric tracking (weight, resting heart rate, recovery score) with sparkline trends.

### 3.2 Finance Track
- [ ] Net worth and account balance snapshots.
- [ ] Budget category ceilings vs actual monthly expenditures.
- [ ] Debt snowball/avalanche payoff arc calculators.

### 3.3 Career Track
- [ ] Quarterly OKR / deliverable milestones with measurable key results.
- [ ] Skills inventory matrix (Proficiency ratings 1–5, practice goals).
- [ ] Professional contact & networking cadence tracker.

### 3.4 Learning & Productivity Track
- [ ] Reading list tracker (Currently reading, completed, key quotes).
- [ ] Focus timer / Pomodoro session recorder integrated with task items.
- [ ] Markdown notes and resource links attached to learning plans.

### 3.5 Business Track
- [ ] Revenue milestone runways and monthly recurring revenue (MRR) goals.
- [ ] Client acquisition pipeline board (Lead -> Pitched -> Won).
- [ ] Sprint cadence and release milestone checklists.

---

## Phase 4: Analytics, Heatmaps & Insights

- [ ] **Global Activity Heatmap:**
  - [ ] GitHub-style daily completion grid over a rolling 52-week window.
  - [ ] Filtering heatmap by Track (e.g. show only Fitness habit completions).
- [ ] **Execution Velocity Metrics:**
  - [ ] Average days to task completion.
  - [ ] Habit completion adherence rates by day of week (identifying weekend drop-offs).
  - [ ] Ratio of created vs completed items per week.
- [ ] **Track Balance Radar:**
  - [ ] Visual distribution chart showing where user time and energy are concentrated across their active Tracks.

---

## Phase 5: Reviews & Retrospectives

- [ ] **Weekly Review Wizard:**
  - [ ] Step-by-step guided flow:
    1. Clean up overdue tasks (reschedule, complete, or discard).
    2. Review habit consistency metrics from the past 7 days.
    3. Celebrate completed milestones and plans.
    4. Plan the top 3 focus priorities for the upcoming week.
  - [ ] Save retrospective journal entry into a `reviews` table.
- [ ] **Monthly Retrospective:**
  - [ ] High-level progress audit of all active Tracks.
  - [ ] Prompt to archive concluded plans and inaugurate new quarterly arcs.

---

## Phase 6: Offline Sync, Realtime & Mobile Native

- [ ] **Service Worker & Offline Cache:**
  - [ ] Workbox service worker caching static assets and API read queries in IndexedDB.
  - [ ] Offline mutation queue: record completions while offline and replay to Supabase when connectivity resumes.
- [ ] **Supabase Realtime:**
  - [ ] Realtime channel subscriptions on `execution_items` and `tracks` for instant multi-device synchronization.
- [ ] **Mobile Experience Enhancements:**
  - [ ] Native pull-to-refresh on mobile views.
  - [ ] Haptic feedback on task completion using the Web Vibration API.
  - [ ] Web Push Notifications for scheduled habits and reminders.

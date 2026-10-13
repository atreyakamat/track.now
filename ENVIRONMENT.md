# Track.now — Environment & Deployment Guide

This guide details all environment variables, Netlify multi-site configuration, and security boundaries for running and deploying **Track.now**.

---

## 1. Multi-Site Architecture & Deployment Overview

Track.now is partitioned into two independently deployable targets within the repository:

| Target | Production Domain | Directory | Netlify Base Dir | Netlify Build Cmd | Publish Dir | SPA Rewrite |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Public Landing Site** | `https://tracknow.atreyakamat.dev` | `apps/landing` | `apps/landing` | `npm run build` | `dist` | *None* |
| **Authenticated App** | `https://trackapp.atreyakamat.dev` | `apps/app` | `apps/app` | `npm run build` | `dist` | `/* /index.html 200` |

---

## 2. Environment Variables Specification

### Target 1: Public Landing Site (`apps/landing`)
The landing site is a zero-backend, high-performance marketing web experience. It does **NOT** require any database credentials.

| Variable Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_APP_URL` | Optional | `https://trackapp.atreyakamat.dev` | Target URL for CTAs pointing to the authenticated application. |

### Target 2: Authenticated Application (`apps/app`)
The application interacts directly with Supabase via browser-safe client credentials protected by Row Level Security (RLS).

| Variable Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | **Yes** | *None* | The unique HTTPS URL of your Supabase project (e.g. `https://xyzproject.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | *None* | The public anonymous API key (JWT) used for client-side requests. Enforced by PostgreSQL RLS. |
| `VITE_APP_URL` | Optional (required for native shells) | current page origin | Public origin used in emailed links (password reset `redirectTo`). Must be `https://` (or localhost). Set to `https://trackapp.atreyakamat.dev` for production builds. |

Build tooling: Node **22** (pinned with `NODE_VERSION` in every `netlify.toml`; React Router 7 needs Node ≥ 20), Vite 6.4.3.
Auth uses the **PKCE** flow: email links must be opened in the browser/device that requested them.

> [!CAUTION]
> **NEVER** expose your Supabase `service_role` key in frontend environment variables, Netlify site configuration, or source code.
> The `service_role` key bypasses all Row Level Security policies. Only `VITE_SUPABASE_ANON_KEY` is browser-safe.

---

## 3. Netlify Deployment Setup

### Site 1: Track.now Landing
1. In Netlify, create a new site from the Git repository.
2. Configure **Build settings**:
   - **Base directory:** `apps/landing`
   - **Build command:** `npm run build`
   - **Publish directory:** `apps/landing/dist` (or `dist` relative to base)
3. Set custom domain: `tracknow.atreyakamat.dev`.
4. Environment variables: None required (optionally set `VITE_APP_URL=https://trackapp.atreyakamat.dev`).

### Site 2: Track.now App
1. In Netlify, create a second site from the same Git repository.
2. Configure **Build settings**:
   - **Base directory:** `apps/app`
   - **Build command:** `npm run build`
   - **Publish directory:** `apps/app/dist` (or `dist` relative to base)
3. Set custom domain: `trackapp.atreyakamat.dev`.
4. Configure **Environment variables** in Netlify Site Configuration:
   - `VITE_SUPABASE_URL` = `https://<your-project>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<your-anon-key>`
5. SPA redirect rewrite is automatically handled by `apps/app/netlify.toml` and `apps/app/public/_redirects`.

---

## 4. Local Development

### Run Applications Locally
- **Root monorepo installation:**
  ```bash
  npm install
  ```
- **Develop Landing Page:**
  ```bash
  npm run dev:landing
  ```
- **Develop Application:**
  ```bash
  npm run dev:app
  ```
- **Run Tests:**
  ```bash
  npm test
  ```
- **Typecheck Both Applications:**
  ```bash
  npm run typecheck
  ```
- **Build Both Applications:**
  ```bash
  npm run build
  ```

---

## 5. Where `.env` files go

Vite reads environment files from each app's own folder:

- App: `apps/app/.env.local` (or `apps/app/.env`) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Landing: `apps/landing/.env.local` with optional `VITE_APP_URL` (a trailing slash is ignored).

A `.env` at the repository root is **not** read by either Vite build. All `.env*` files except
`.env.example` are git-ignored. Unit tests override the Supabase variables with an unroutable loopback
URL, so tests never contact a real project.

## 6. Supabase settings the owner must check (not changed by the code)

- **Redirect URLs:** add `https://trackapp.atreyakamat.dev/reset-password` (and your local dev origin) so
  password-reset emails land on the reset page.
- **Rate limits / SMTP:** signup and email limits are enforced by Supabase. Check Auth logs and SMTP
  configuration if users see "Too many attempts".
- **Pending migrations:** `supabase/migrations/20261012000000_secure_increment_item_count_rpc.sql` and
  `20261013000000_habit_daily_counter.sql` are not applied. See `RELEASE_READINESS.md` and `SECURITY_AUDIT.md`.

## 7. Variables used only by verification scripts (never by the apps)

| Variable | Used by | Purpose |
| :--- | :--- | :--- |
| `PG_BIN` | `scripts/verify_sql_local.cjs` | Folder with `initdb`/`pg_ctl`/`psql` for the disposable local cluster (auto-detected on Windows). |
| `TRACKNOW_SCREENSHOT_DIR` | mocked browser scripts | Screenshot folder (default: a temp folder outside the repo). |
| `SUPABASE_SERVICE_ROLE_KEY` | live scripts only | Admin key of a **disposable** project. Never in a `VITE_` variable or on Netlify. |
| `ALLOW_LIVE_SUPABASE` | live scripts only | Must equal the target project ref, or the live scripts refuse to start (exit 2). |
| `PRODUCTION_SUPABASE_REFS` | live scripts only | Comma-separated refs the live scripts must never target (set it to the production ref). |

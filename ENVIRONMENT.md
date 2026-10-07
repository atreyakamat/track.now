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

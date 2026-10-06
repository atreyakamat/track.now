# Track.now — Environment & Configuration Guide

This guide details all environment variables, local development setup steps, and security boundaries for running **Track.now**.

---

## 1. Environment Variables Specification

All environment variables used by the client application must be prefixed with `VITE_` so that the Vite build pipeline exposes them safely via `import.meta.env`.

| Variable Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | **Yes** | *None* | The unique HTTPS URL of your Supabase project (e.g. `https://xyzproject.supabase.co` or `http://127.0.0.1:54321` for local development). |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | *None* | The public anonymous API key (JWT) used for client-side requests. Enforced by PostgreSQL RLS. |

### Example `.env` File
Create a `.env` file at the root of the project:
```env
# Supabase Project Connection
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> [!CAUTION]
> **NEVER** expose your Supabase `service_role` key in frontend environment files (`.env`, `.env.local`, or source code). The `service_role` key bypasses all Row Level Security policies. Only the `anon` key is safe for client applications.

---

## 2. Setup Options

### Option A: Supabase Cloud (Recommended for Quick Setup)

1. Navigate to [supabase.com](https://supabase.com) and create or open a project.
2. In your project dashboard, navigate to **Project Settings** → **API**.
3. Copy the **Project URL** and paste it as `VITE_SUPABASE_URL`.
4. Copy the **Project API Keys** → `anon public` key and paste it as `VITE_SUPABASE_ANON_KEY`.
5. Open the **SQL Editor** in your Supabase dashboard.
6. Open [`supabase/migrations/20261005000000_init_track_now.sql`](supabase/migrations/20261005000000_init_track_now.sql) in this repo, copy its contents, paste them into the SQL editor, and click **Run**.
7. Restart your Vite dev server (`npm run dev`).

---

### Option B: Local Supabase Development via CLI

If you prefer running Supabase locally using Docker:

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```
2. Initialize and start the local containers:
   ```bash
   supabase start
   ```
3. Apply the migration:
   ```bash
   supabase db reset
   ```
4. Note the output credentials provided by `supabase start`:
   - API URL: `http://127.0.0.1:54321`
   - Anon key: `eyJhbGciOi...`
5. Configure your `.env`:
   ```env
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

---

## 3. Graceful Fallback & Unconfigured State Handling

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing or contains placeholder values (`your-project` / `your-anon-key`), Track.now **will not crash with a blank white screen**.

Instead:
1. `src/lib/supabase/client.ts` validates credentials via `isSupabaseConfigured()`.
2. The `<UnconfiguredNotice />` banner is displayed at the top of the interface, guiding the developer on how to configure `.env`.
3. The auth provider will display helpful notices on the login and signup forms rather than firing failing network requests.

---

## 4. Verification Checklist

To verify your environment is correctly configured:
- [ ] `.env` exists in the project root.
- [ ] `VITE_SUPABASE_URL` begins with `https://` (or `http://127.0.0.1`).
- [ ] `VITE_SUPABASE_ANON_KEY` is a valid JWT string.
- [ ] Running `npm run dev` and loading the app shows no orange configuration warning banner.
- [ ] Signing up a new account creates a row in `auth.users` and `public.track_now_profiles`.

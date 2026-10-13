-- ==============================================================================
-- LOCAL-ONLY SUPABASE STUB for a throw-away PostgreSQL cluster.
--
-- Used exclusively by scripts/verify_sql_local.cjs, which creates a brand-new
-- temporary cluster, applies this file, then the real migrations, and deletes the
-- cluster afterwards. NEVER run this against a Supabase project: it creates roles
-- and an `auth` schema that Supabase already manages.
--
-- It reproduces the parts of a Supabase database the Track.now migrations and the
-- verification scripts rely on:
--   * the API roles anon / authenticated / service_role,
--   * auth.users and auth.uid() (same definition Supabase ships: JWT `sub` claim),
--   * Supabase's default privileges, which grant ALL on new tables AND FUNCTIONS in
--     `public` to anon and authenticated explicitly (not only through PUBLIC). This
--     matters: a fix that only revokes from PUBLIC would still leave anon able to
--     execute the function.
-- ==============================================================================

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Unrelated table that shares the real database. The harness checks it is untouched.
CREATE TABLE IF NOT EXISTS public.tracked_profiles (
  id UUID PRIMARY KEY,
  label TEXT NOT NULL
);
INSERT INTO public.tracked_profiles (id, label)
VALUES ('99999999-0000-4000-8000-000000000001', 'sentinel row that must survive')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- TRACK.NOW: first-party usage events and error reports (2026-11-10)
--
-- track_now_client_events: an append-only log written by the web and mobile apps
-- (packages/core/src/services/telemetry.ts). kind 'event' = a feature was used
-- (tour, quests, templates, first Plan…); kind 'error' = crash details. It never holds
-- item names, notes or any other text typed by the user.
--
-- RLS: a signed-in user may INSERT rows for themselves and nothing else. App users
-- cannot read, change or delete rows; the owner reads them in the dashboard with
-- supabase/analytics/funnel.sql. Rows go away with the account (ON DELETE CASCADE).
--
-- The apps ship before this is applied: until the table exists they stop sending for
-- the session and nothing else changes.
-- Additive and idempotent. NOT APPLIED — the owner applies it in the Supabase SQL editor.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.track_now_client_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('event', 'error')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  props jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(props) <= 4096),
  app text NOT NULL CHECK (app IN ('web', 'mobile')),
  app_version text CHECK (char_length(app_version) <= 40),
  session_id text CHECK (char_length(session_id) <= 40),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS track_now_client_events_created_idx ON public.track_now_client_events(created_at);
CREATE INDEX IF NOT EXISTS track_now_client_events_user_created_idx ON public.track_now_client_events(user_id, created_at);
ALTER TABLE public.track_now_client_events ENABLE ROW LEVEL SECURITY;

-- The only policy: insert your own rows. No SELECT / UPDATE / DELETE policy on purpose.
DROP POLICY IF EXISTS track_now_client_events_insert_own ON public.track_now_client_events;
CREATE POLICY track_now_client_events_insert_own ON public.track_now_client_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Supabase grants ALL on new tables to anon and authenticated by default: take it back.
REVOKE ALL ON public.track_now_client_events FROM PUBLIC;
REVOKE ALL ON public.track_now_client_events FROM anon;
REVOKE ALL ON public.track_now_client_events FROM authenticated;
GRANT INSERT ON public.track_now_client_events TO authenticated;

NOTIFY pgrst, 'reload schema';

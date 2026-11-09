
-- ==============================================================================
-- TRACK.NOW: small per-user state that follows the account (2026-11-11)
--
-- track_now_synced_state: one row per (user, scope, key). It carries the things that used
-- to live on one device only and are now shared between the web app and the phone app
-- (packages/core/src/services/syncedState.ts):
--   scope 'review_note', key 'weekly:YYYY-MM-DD' | 'monthly:YYYY-MM'  -> one review's notes
--   scope 'focus',       key 'today'                                  -> today's focus picks
-- value is the note / focus as JSON; value NULL marks a deleted entry (so a delete on one
-- device is not undone by another device that still has the old copy). updated_at is the
-- time of the edit on the device that made it; the newest edit wins.
--
-- RLS: a signed-in user can read and write their own rows and nothing else.
-- Rows go away with the account (ON DELETE CASCADE).
--
-- The apps ship before this is applied: until the table exists they keep working exactly as
-- before (notes and focus stay on the device) and say so on the Reviews screen.
-- Additive and idempotent. NOT APPLIED — the owner applies it in the Supabase SQL editor.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.track_now_synced_state (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('review_note', 'focus')),
  key text NOT NULL CHECK (key ~ '^[A-Za-z0-9:_-]{1,64}$'),
  value jsonb CHECK (value IS NULL OR pg_column_size(value) <= 65536),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope, key)
);
ALTER TABLE public.track_now_synced_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS track_now_synced_state_select_own ON public.track_now_synced_state;
CREATE POLICY track_now_synced_state_select_own ON public.track_now_synced_state
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS track_now_synced_state_insert_own ON public.track_now_synced_state;
CREATE POLICY track_now_synced_state_insert_own ON public.track_now_synced_state
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS track_now_synced_state_update_own ON public.track_now_synced_state;
CREATE POLICY track_now_synced_state_update_own ON public.track_now_synced_state
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS track_now_synced_state_delete_own ON public.track_now_synced_state;
CREATE POLICY track_now_synced_state_delete_own ON public.track_now_synced_state
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Supabase grants ALL on new tables to anon and authenticated by default: take it back.
REVOKE ALL ON public.track_now_synced_state FROM PUBLIC;
REVOKE ALL ON public.track_now_synced_state FROM anon;
REVOKE ALL ON public.track_now_synced_state FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.track_now_synced_state TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- TRACK.NOW: security hardening from the 2026-11 audit (findings S-28 and S-35)
--
-- 1. Share-link tokens get a server-side default from the database's own
--    cryptographic random source (two v4 UUIDs = 244 random bits, 64 hex characters).
--    A device without a secure random source (some phone runtimes) can then create a
--    link without ever inventing the token itself.
-- 2. Defence in depth: the anonymous API role loses every table privilege it never
--    needed. Until now those tables were protected for anon by row level security
--    alone; after this, a mistake in a policy still cannot expose them to anon.
--    The public template catalogue stays readable; nobody writes it through the API.
--
-- Nothing a signed-in user can do changes. The public shared-plan page keeps working:
-- it goes through track_now_get_shared_plan(), not through table access.
-- Additive and idempotent. NOT APPLIED — the owner applies it in the Supabase SQL editor.
-- ==============================================================================

-- 1. Server-generated share tokens ------------------------------------------------
ALTER TABLE public.track_now_plan_shares
  ALTER COLUMN token SET DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

-- 2. anon: no table access except reading the template catalogue ---------------------
REVOKE ALL ON public.track_now_profiles FROM anon;
REVOKE ALL ON public.track_now_tracks FROM anon;
REVOKE ALL ON public.track_now_plans FROM anon;
REVOKE ALL ON public.track_now_execution_items FROM anon;
REVOKE ALL ON public.track_now_item_schedules FROM anon;
REVOKE ALL ON public.track_now_item_completions FROM anon;

REVOKE ALL ON public.track_now_track_templates FROM anon;
REVOKE ALL ON public.track_now_track_templates FROM authenticated;
GRANT SELECT ON public.track_now_track_templates TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

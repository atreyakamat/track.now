-- ==============================================================================
-- TRACK.NOW: revoke API execution of the sign-up trigger function (2026-10-14)
--
-- Supabase security advisor 0028/0029: public.handle_new_track_now_user() is a
-- SECURITY DEFINER trigger function that the anon/authenticated roles could call
-- via /rest/v1/rpc/handle_new_track_now_user. Calling a trigger function directly
-- only raises "trigger functions can only be called as triggers", so this was not
-- exploitable, but nothing should be able to call it over the API.
--
-- Safe: PostgreSQL checks EXECUTE on a trigger function only when the trigger is
-- CREATED, not when it fires, so new-user profile provisioning keeps working
-- (verified by scripts/verify_sql_local.cjs). Idempotent.
-- Does not touch public.rls_auto_enable() or any other non-Track.now object.
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_track_now_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_track_now_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_track_now_user() FROM authenticated;

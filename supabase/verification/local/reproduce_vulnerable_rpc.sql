-- ==============================================================================
-- LOCAL-ONLY REPRODUCTION of the cross-tenant write in the ORIGINAL
-- public.track_now_increment_item_count(uuid, integer, uuid, date)
-- (introduced by 20261008000000_harden_constraints_and_rls.sql).
--
-- Run by scripts/verify_sql_local.cjs on a throw-away cluster BEFORE the fix is
-- applied. It proves the harness can actually detect the bug: the script RAISES
-- (non-zero exit) if the attack does NOT work, i.e. if it is run against a fixed
-- database. All fixtures are rolled back by a sentinel exception.
-- Never run against a Supabase project.
-- ==============================================================================

DO $repro$
DECLARE
  ua constant uuid := '00000000-0000-4000-8000-0000000000aa';
  ub constant uuid := '00000000-0000-4000-8000-0000000000bb';
  ta constant uuid := '10000000-0000-4000-8000-0000000000aa';
  pa constant uuid := '20000000-0000-4000-8000-0000000000aa';
  ia constant uuid := '30000000-0000-4000-8000-0000000000aa';
  n integer;
BEGIN
  IF to_regprocedure('public.track_now_increment_item_count(uuid,integer,uuid,date)') IS NULL THEN
    RAISE EXCEPTION 'REPRO-SETUP: the vulnerable signature is not present';
  END IF;

  BEGIN
    INSERT INTO auth.users (id, email) VALUES (ua, 'victim@example.invalid'), (ub, 'attacker@example.invalid');
    INSERT INTO public.track_now_tracks (id, user_id, name) VALUES (ta, ua, 'Victim track');
    INSERT INTO public.track_now_plans (id, user_id, track_id, name) VALUES (pa, ua, ta, 'Victim plan');
    INSERT INTO public.track_now_execution_items (id, user_id, plan_id, track_id, type, name, target_count, current_count)
    VALUES (ia, ua, pa, ta, 'task', 'Victim task', 5, 0);

    -- 1. Anonymous caller (public anon key, no session) passes the victim's ids.
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM set_config('role', 'anon', true);
    PERFORM public.track_now_increment_item_count(ia, 1, ua, CURRENT_DATE);
    PERFORM set_config('role', 'none', true);

    -- 2. A different signed-in user (B) does the same.
    PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000bb","role":"authenticated"}', true);
    PERFORM set_config('role', 'authenticated', true);
    PERFORM public.track_now_increment_item_count(ia, 4, ua, CURRENT_DATE);
    PERFORM set_config('role', 'none', true);
    PERFORM set_config('request.jwt.claims', '', true);

    SELECT current_count INTO n FROM public.track_now_execution_items WHERE id = ia;
    IF n IS DISTINCT FROM 5 THEN
      RAISE EXCEPTION 'REPRO-FAILED: expected the attacks to raise the victim counter to 5, got %', n;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = ia AND user_id = ua) THEN
      RAISE EXCEPTION 'REPRO-FAILED: expected a forged completion row for the victim';
    END IF;
    RAISE NOTICE 'REPRODUCED: anon and another user changed the victim counter to % and forged a completion row', n;

    RAISE EXCEPTION USING ERRCODE = 'TNV02', MESSAGE = 'reproduction complete';
  EXCEPTION WHEN SQLSTATE 'TNV02' THEN
    RAISE NOTICE 'Vulnerability reproduced; fixtures rolled back.';
  END;
END
$repro$;

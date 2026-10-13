-- ==============================================================================
-- VERIFICATION SCRIPT for 20261013000000_habit_daily_counter.sql
--
-- WHERE:   a disposable local cluster (scripts/verify_sql_local.cjs runs it) or a
--          DEVELOPMENT / STAGING Supabase project AFTER both 20261012000000 and
--          20261013000000 are applied. Never production. Refuses to run when
--          auth.users looks populated (> 25 users) unless, in the same session:
--              SET track_now.allow_verify = 'yes';
-- HOW:     psql "<dev connection string>" -v ON_ERROR_STOP=1 -X -f verify_habit_daily_counter.sql
--          SQL editor: run the WHOLE file as "postgres" without impersonation; success
--          is the final row "ALL HABIT COUNTER CHECKS PASSED".
-- SAFETY:  all writes happen inside one DO block whose sandbox always ends with a
--          sentinel exception, so PostgreSQL rolls every fixture back. The outer
--          BEGIN/ROLLBACK is a second safeguard.
-- ==============================================================================

BEGIN;

DO $verify$
DECLARE
  ua constant uuid := '00000000-0000-4000-8000-0000000000c1';
  ub constant uuid := '00000000-0000-4000-8000-0000000000c2';
  ta constant uuid := '10000000-0000-4000-8000-0000000000c1';
  pa constant uuid := '20000000-0000-4000-8000-0000000000c1';
  h_renamed    constant uuid := '30000000-0000-4000-8000-0000000000c1';
  h_done_yday  constant uuid := '30000000-0000-4000-8000-0000000000c2';
  h_done_today constant uuid := '30000000-0000-4000-8000-0000000000c3';
  h_stale_day  constant uuid := '30000000-0000-4000-8000-0000000000c4';
  h_dec_newday constant uuid := '30000000-0000-4000-8000-0000000000c5';
  h_legacy     constant uuid := '30000000-0000-4000-8000-0000000000c6';
  h_legacy_rst constant uuid := '30000000-0000-4000-8000-0000000000c7';
  t_task       constant uuid := '30000000-0000-4000-8000-0000000000c8';
  h_repeat     constant uuid := '30000000-0000-4000-8000-0000000000c9';
  claims_a constant text := '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
  claims_b constant text := '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}';
  today constant date := CURRENT_DATE;
  v jsonb;
  n integer;
  d date;
  i integer;
  passes integer := 0;
BEGIN
  -- ------------------------------------------------------------ guards ----
  IF current_user NOT IN ('postgres', 'supabase_admin') AND NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'Refusing to run: connect as postgres (current_user=%).', current_user;
  END IF;
  IF (SELECT count(*) FROM auth.users) > 25
     AND current_setting('track_now.allow_verify', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Refusing to run: auth.users has more than 25 rows (looks like production).';
  END IF;

  -- ------------------------------------------- catalogue checks (no writes) ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'track_now_execution_items'
      AND column_name = 'count_date' AND data_type = 'date' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'FAIL: track_now_execution_items.count_date (nullable date) is missing. Is the migration applied?';
  END IF;
  RAISE NOTICE 'PASS: count_date column exists (nullable date)'; passes := passes + 1;

  IF (SELECT tgenabled FROM pg_trigger
      WHERE tgname = 'tr_track_now_items_updated_at'
        AND tgrelid = 'public.track_now_execution_items'::regclass) IS DISTINCT FROM 'O' THEN
    RAISE EXCEPTION 'FAIL: the updated_at trigger was left disabled after the backfill';
  END IF;
  RAISE NOTICE 'PASS: updated_at trigger is enabled again after the backfill'; passes := passes + 1;

  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'track_now_increment_item_count') IS DISTINCT FROM 1
     OR to_regprocedure('public.track_now_increment_item_count(uuid,integer,date,boolean)') IS NULL THEN
    RAISE EXCEPTION 'FAIL: expected exactly the (uuid,integer,date,boolean) overload';
  END IF;
  IF has_function_privilege('anon', 'public.track_now_increment_item_count(uuid,integer,date,boolean)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.track_now_increment_item_count(uuid,integer,date,boolean)', 'EXECUTE')
     OR NOT COALESCE((SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc
                      WHERE oid = 'public.track_now_increment_item_count(uuid,integer,date,boolean)'::regprocedure), false) THEN
    RAISE EXCEPTION 'FAIL: security properties of the RPC regressed (grants or search_path)';
  END IF;
  RAISE NOTICE 'PASS: single overload, authenticated-only, pinned search_path'; passes := passes + 1;

  -- -------------------------------------------- sandbox (always undone) ----
  BEGIN
    INSERT INTO auth.users (id, email) VALUES
      (ua, 'habit-check-a@example.invalid'),
      (ub, 'habit-check-b@example.invalid');
    INSERT INTO public.track_now_tracks (id, user_id, name) VALUES (ta, ua, 'Habit check track');
    INSERT INTO public.track_now_plans (id, user_id, track_id, name) VALUES (pa, ua, ta, 'Habit check plan');
    INSERT INTO public.track_now_execution_items
      (id, user_id, plan_id, track_id, type, name, status, target_count, current_count, count_date)
    VALUES
      (h_renamed,    ua, pa, ta, 'habit', 'Renamed today, 2/3 yesterday', 'todo', 3, 2, today - 1),
      (h_done_yday,  ua, pa, ta, 'habit', 'Done yesterday',               'done', 1, 1, today - 1),
      (h_done_today, ua, pa, ta, 'habit', 'Done today',                   'done', 1, 1, today),
      (h_stale_day,  ua, pa, ta, 'habit', '2/3 today',                    'todo', 3, 2, today),
      (h_dec_newday, ua, pa, ta, 'habit', '2/3 yesterday, decrement',     'todo', 3, 2, today - 1),
      (h_legacy,     ua, pa, ta, 'habit', 'Legacy NULL day, no hint',     'todo', 3, 2, NULL),
      (h_legacy_rst, ua, pa, ta, 'habit', 'Legacy NULL day, reset hint',  'todo', 3, 2, NULL),
      (t_task,       ua, pa, ta, 'task',  'Task 1/2 yesterday',           'todo', 2, 1, today - 1),
      (h_repeat,     ua, pa, ta, 'habit', 'Repeated presses',             'todo', 2, 0, today);
    INSERT INTO public.track_now_item_completions (item_id, user_id, completed_date) VALUES
      (h_done_yday,  ua, today - 1),
      (h_done_today, ua, today);

    -- The rename happened today: updated_at is today, but the count is yesterday's.
    UPDATE public.track_now_execution_items SET name = 'Renamed habit' WHERE id = h_renamed;

    PERFORM set_config('request.jwt.claims', claims_a, true);
    PERFORM set_config('role', 'authenticated', true);

    -- 1. Edited/renamed on a new day before the first press: restart from 0 even
    --    though the client (which only saw updated_at = today) sent no reset hint.
    v := public.track_now_increment_item_count(h_renamed, 1, today, false);
    IF (v->>'current_count')::int IS DISTINCT FROM 1 OR v->>'status' IS DISTINCT FROM 'todo'
       OR (v->>'count_date')::date IS DISTINCT FROM today
       OR EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = h_renamed) THEN
      RAISE EXCEPTION 'FAIL: habit renamed on a new day continued yesterday''s count (%)', v;
    END IF;
    RAISE NOTICE 'PASS: habit edited on a new day restarts its counter (1/3, no completion)'; passes := passes + 1;

    -- 2. Same-day press after that: keeps today's count.
    v := public.track_now_increment_item_count(h_renamed, 1, today, true);
    IF (v->>'current_count')::int IS DISTINCT FROM 2 THEN
      RAISE EXCEPTION 'FAIL: same-day press did not continue today''s count (%)', v;
    END IF;
    RAISE NOTICE 'PASS: same-day press continues today''s count even with a stale reset hint'; passes := passes + 1;

    -- 3. Habit done yesterday: first press today logs today and keeps yesterday.
    v := public.track_now_increment_item_count(h_done_yday, 1, today, false);
    IF (v->>'current_count')::int IS DISTINCT FROM 1 OR v->>'status' IS DISTINCT FROM 'done'
       OR (SELECT count(*) FROM public.track_now_item_completions WHERE item_id = h_done_yday) IS DISTINCT FROM 2 THEN
      RAISE EXCEPTION 'FAIL: day rollover for a habit done yesterday (%)', v;
    END IF;
    RAISE NOTICE 'PASS: habit done yesterday logs today and keeps yesterday''s history'; passes := passes + 1;

    -- 4. Stale reset hint on a habit already done today never wipes today's progress.
    v := public.track_now_increment_item_count(h_done_today, 1, today, true);
    IF (v->>'current_count')::int IS DISTINCT FROM 2 OR v->>'status' IS DISTINCT FROM 'done'
       OR NOT EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = h_done_today AND completed_date = today) THEN
      RAISE EXCEPTION 'FAIL: stale reset wiped today''s completion (%)', v;
    END IF;
    RAISE NOTICE 'PASS: stale reset hint cannot erase a completion recorded today'; passes := passes + 1;

    -- 5. Decrement while still at/above target keeps the completion; to zero removes it.
    v := public.track_now_increment_item_count(h_done_today, -1, today, false);
    IF (v->>'current_count')::int IS DISTINCT FROM 1 OR v->>'status' IS DISTINCT FROM 'done' THEN
      RAISE EXCEPTION 'FAIL: decrement above target changed completion state (%)', v;
    END IF;
    v := public.track_now_increment_item_count(h_done_today, -1, today, false);
    IF (v->>'current_count')::int IS DISTINCT FROM 0 OR v->>'status' IS DISTINCT FROM 'todo'
       OR EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = h_done_today) THEN
      RAISE EXCEPTION 'FAIL: decrement to zero did not remove today''s completion (%)', v;
    END IF;
    v := public.track_now_increment_item_count(h_done_today, -1, today, false);
    IF (v->>'current_count')::int IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'FAIL: counter went negative (%)', v;
    END IF;
    RAISE NOTICE 'PASS: decrement keeps/removes today''s completion correctly and floors at zero'; passes := passes + 1;

    -- 6. Request for an OLDER day than the counter's day is rejected and changes nothing.
    BEGIN
      PERFORM public.track_now_increment_item_count(h_stale_day, 1, today - 1, false);
      RAISE EXCEPTION 'FAIL: stale-day request was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;
    SELECT current_count, count_date INTO n, d FROM public.track_now_execution_items WHERE id = h_stale_day;
    IF n IS DISTINCT FROM 2 OR d IS DISTINCT FROM today
       OR EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = h_stale_day) THEN
      RAISE EXCEPTION 'FAIL: stale-day request modified the habit (count %, day %)', n, d;
    END IF;
    RAISE NOTICE 'PASS: a request for an older day is rejected without touching newer progress'; passes := passes + 1;

    -- 7. Decrement on a new day before any press: today's count is 0, stays 0.
    v := public.track_now_increment_item_count(h_dec_newday, -1, today, false);
    IF (v->>'current_count')::int IS DISTINCT FROM 0 OR (v->>'count_date')::date IS DISTINCT FROM today THEN
      RAISE EXCEPTION 'FAIL: decrement on a new day used yesterday''s count (%)', v;
    END IF;
    RAISE NOTICE 'PASS: decrement on a new day starts from zero'; passes := passes + 1;

    -- 8. Legacy rows (count_date NULL) keep the old contract: the hint decides.
    v := public.track_now_increment_item_count(h_legacy, 1, today, false);
    IF (v->>'current_count')::int IS DISTINCT FROM 3 OR v->>'status' IS DISTINCT FROM 'done' THEN
      RAISE EXCEPTION 'FAIL: legacy row without hint (%)', v;
    END IF;
    v := public.track_now_increment_item_count(h_legacy_rst, 1, today, true);
    IF (v->>'current_count')::int IS DISTINCT FROM 1 OR (v->>'count_date')::date IS DISTINCT FROM today THEN
      RAISE EXCEPTION 'FAIL: legacy row with reset hint (%)', v;
    END IF;
    RAISE NOTICE 'PASS: legacy rows fall back to the client hint and are stamped with a day'; passes := passes + 1;

    -- 9. One-off items never restart per day.
    v := public.track_now_increment_item_count(t_task, 1, today, true);
    IF (v->>'current_count')::int IS DISTINCT FROM 2 OR v->>'status' IS DISTINCT FROM 'done'
       OR NOT EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = t_task AND completed_date = today) THEN
      RAISE EXCEPTION 'FAIL: task counter restarted or did not complete (%)', v;
    END IF;
    RAISE NOTICE 'PASS: tasks keep their count across days'; passes := passes + 1;

    -- 10. Repeated presses beyond target: count keeps growing, exactly one completion.
    FOR i IN 1..5 LOOP
      v := public.track_now_increment_item_count(h_repeat, 1, today, false);
    END LOOP;
    IF (v->>'current_count')::int IS DISTINCT FROM 5 OR v->>'status' IS DISTINCT FROM 'done'
       OR (SELECT count(*) FROM public.track_now_item_completions WHERE item_id = h_repeat) IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'FAIL: repeated presses corrupted the counter or history (%)', v;
    END IF;
    RAISE NOTICE 'PASS: repeated presses apply exactly once each and log a single completion'; passes := passes + 1;

    -- 11. Another user still cannot step the habit.
    PERFORM set_config('request.jwt.claims', claims_b, true);
    BEGIN
      PERFORM public.track_now_increment_item_count(h_repeat, 1, today, false);
      RAISE EXCEPTION 'FAIL: user B stepped user A''s habit';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
    PERFORM set_config('role', 'none', true);
    PERFORM set_config('request.jwt.claims', '', true);
    SELECT current_count INTO n FROM public.track_now_execution_items WHERE id = h_repeat;
    IF n IS DISTINCT FROM 5 THEN
      RAISE EXCEPTION 'FAIL: cross-tenant attempt changed the habit (now %)', n;
    END IF;
    RAISE NOTICE 'PASS: cross-tenant call still rejected'; passes := passes + 1;

    RAISE EXCEPTION USING ERRCODE = 'TNV03', MESSAGE = 'habit counter sandbox complete';
  EXCEPTION WHEN SQLSTATE 'TNV03' THEN
    RAISE NOTICE 'ALL % HABIT COUNTER CHECKS PASSED. Every test row was rolled back.', passes;
  END;
END
$verify$;

ROLLBACK;

SELECT 'ALL HABIT COUNTER CHECKS PASSED (no test data was kept)' AS verification_result;

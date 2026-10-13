-- ==============================================================================
-- VERIFICATION SCRIPT for 20261012000000_secure_increment_item_count_rpc.sql
--
-- WHERE:   a DEVELOPMENT / STAGING Supabase project only, AFTER that migration is
--          applied. Never production. The script refuses to run when auth.users
--          looks populated (> 25 users) unless you first run, in the same session:
--              SET track_now.allow_verify = 'yes';
-- HOW:     preferred:  psql "<dev connection string>" -v ON_ERROR_STOP=1 -X -f verify_increment_rpc_security.sql
--          (prints one "PASS: ..." line per check).
--          SQL editor: run the WHOLE file with the role selector set to "postgres"
--          and no user impersonation. The editor does not show NOTICE lines; success
--          is the final row "ALL CHECKS PASSED"; any failure shows an error instead.
-- SAFETY:  every write happens inside ONE DO block whose inner sandbox always ends
--          by raising a sentinel error, which PostgreSQL rolls back. Nothing is kept
--          even with autocommit, "run selected", or a client that ignores BEGIN.
--          The outer BEGIN/ROLLBACK is a second safeguard. Catalogue checks and
--          guards run before any write. Do not run parts of this file.
-- ==============================================================================

BEGIN;

DO $verify$
DECLARE
  -- fixed ids for the throw-away fixtures
  ua  constant uuid := '00000000-0000-4000-8000-00000000000a';
  ub  constant uuid := '00000000-0000-4000-8000-00000000000b';
  ta  constant uuid := '10000000-0000-4000-8000-00000000000a';
  tb  constant uuid := '10000000-0000-4000-8000-00000000000b';
  pa  constant uuid := '20000000-0000-4000-8000-00000000000a';
  pb  constant uuid := '20000000-0000-4000-8000-00000000000b';
  ia_task       constant uuid := '30000000-0000-4000-8000-0000000000a1';
  ia_habit_done constant uuid := '30000000-0000-4000-8000-0000000000a2';
  ia_habit_part constant uuid := '30000000-0000-4000-8000-0000000000a3';
  ia_task_old   constant uuid := '30000000-0000-4000-8000-0000000000a4';
  ia_habit_now  constant uuid := '30000000-0000-4000-8000-0000000000a5';
  ib_task       constant uuid := '30000000-0000-4000-8000-0000000000b1';
  claims_a constant text := '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';
  claims_b constant text := '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';
  fn_new regprocedure := to_regprocedure('public.track_now_increment_item_count(uuid,integer,date,boolean)');
  v jsonb;
  n integer;
  passes integer := 0;
  r record;
BEGIN
  -- ------------------------------------------------------------ guards ----
  IF current_user NOT IN ('postgres', 'supabase_admin') AND NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'Refusing to run: connect as postgres (current_user=%). In the SQL editor, disable role impersonation.', current_user;
  END IF;
  IF (SELECT count(*) FROM auth.users) > 25
     AND current_setting('track_now.allow_verify', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Refusing to run: auth.users has more than 25 rows (looks like production). Use a dev project, or SET track_now.allow_verify = ''yes'' if you are sure.';
  END IF;

  -- ------------------------------------------- catalogue checks (no writes) ----
  IF fn_new IS NULL THEN
    RAISE EXCEPTION 'FAIL: public.track_now_increment_item_count(uuid,integer,date,boolean) not found. Is the migration applied?';
  END IF;

  SELECT count(*) INTO n FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND proname = 'track_now_increment_item_count';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: expected exactly 1 overload of track_now_increment_item_count, found %', n;
  END IF;
  RAISE NOTICE 'PASS: exactly one overload exists and it has no p_user_id parameter'; passes := passes + 1;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prosecdef AND 'p_user_id' = ANY (proargnames)) THEN
    RAISE EXCEPTION 'FAIL: a SECURITY DEFINER function in public still takes p_user_id';
  END IF;
  RAISE NOTICE 'PASS: no SECURITY DEFINER function in public accepts p_user_id'; passes := passes + 1;

  IF NOT COALESCE((SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = fn_new), false) THEN
    RAISE EXCEPTION 'FAIL: search_path is not pinned on the RPC';
  END IF;
  RAISE NOTICE 'PASS: RPC search_path is pinned to empty'; passes := passes + 1;

  IF has_function_privilege('anon', fn_new, 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: anon can EXECUTE the RPC';
  END IF;
  IF has_function_privilege('authenticated', fn_new, 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot EXECUTE the RPC';
  END IF;
  RAISE NOTICE 'PASS: EXECUTE granted to authenticated, not to anon'; passes := passes + 1;

  IF to_regprocedure('public.handle_new_track_now_user()') IS NULL
     OR to_regprocedure('public.handle_track_now_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'FAIL: expected trigger functions are missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid IN (to_regprocedure('public.handle_new_track_now_user()'), to_regprocedure('public.handle_track_now_updated_at()'))
      AND NOT COALESCE(p.proconfig @> ARRAY['search_path=""'], false)
  ) THEN
    RAISE EXCEPTION 'FAIL: trigger functions do not have a pinned search_path';
  END IF;
  RAISE NOTICE 'PASS: trigger functions have a pinned search_path'; passes := passes + 1;

  -- Informational: other anon-callable SECURITY DEFINER functions in public (shared DB).
  FOR r IN
    SELECT p.oid::regprocedure AS fn FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.prorettype <> 'trigger'::regtype
  LOOP
    RAISE NOTICE 'REVIEW: anon can execute SECURITY DEFINER function %', r.fn;
  END LOOP;

  -- -------------------------------------------- sandbox (always undone) ----
  BEGIN
    INSERT INTO auth.users (id, email) VALUES
      (ua, 'rpc-check-a@example.invalid'),
      (ub, 'rpc-check-b@example.invalid');
    INSERT INTO public.track_now_tracks (id, user_id, name) VALUES (ta, ua, 'A track'), (tb, ub, 'B track');
    INSERT INTO public.track_now_plans (id, user_id, track_id, name) VALUES (pa, ua, ta, 'A plan'), (pb, ub, tb, 'B plan');
    INSERT INTO public.track_now_execution_items
      (id, user_id, plan_id, track_id, type, name, status, target_count, current_count, updated_at)
    VALUES
      (ia_task,       ua, pa, ta, 'task',  'A task',               'todo', 3, 0, now()),
      (ia_habit_done, ua, pa, ta, 'habit', 'A habit done yday',    'done', 1, 1, now() - interval '1 day'),
      (ia_habit_part, ua, pa, ta, 'habit', 'A habit partial yday', 'todo', 3, 2, now() - interval '1 day'),
      (ia_task_old,   ua, pa, ta, 'task',  'A task done yday',     'done', 1, 1, now() - interval '1 day'),
      (ia_habit_now,  ua, pa, ta, 'habit', 'A habit done today',   'done', 1, 1, now()),
      (ib_task,       ub, pb, tb, 'task',  'B task',               'todo', 3, 0, now());
    INSERT INTO public.track_now_item_completions (item_id, user_id, completed_date) VALUES
      (ia_habit_done, ua, CURRENT_DATE - 1),
      (ia_task_old,   ua, CURRENT_DATE - 1),
      (ia_habit_now,  ua, CURRENT_DATE);

    IF NOT EXISTS (SELECT 1 FROM public.track_now_profiles WHERE id = ua) THEN
      RAISE EXCEPTION 'FAIL: profile trigger did not run with the pinned search_path';
    END IF;
    RAISE NOTICE 'PASS: profile provisioning trigger works'; passes := passes + 1;

    -- ---------------------------------------------------- anon caller ----
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM set_config('role', 'anon', true);
    BEGIN
      PERFORM public.track_now_increment_item_count(ia_task, 1, CURRENT_DATE, false);
      RAISE EXCEPTION 'FAIL: anon was able to call the RPC';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: anon call rejected (%)', SQLERRM; passes := passes + 1;
    END;
    PERFORM set_config('role', 'none', true);

    -- ------------------------------------ user B attacks user A's data ----
    PERFORM set_config('request.jwt.claims', claims_b, true);
    PERFORM set_config('role', 'authenticated', true);
    BEGIN
      PERFORM public.track_now_increment_item_count(ia_task, 1, CURRENT_DATE, false);
      RAISE EXCEPTION 'FAIL: user B stepped user A''s item';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: cross-tenant RPC call rejected (%)', SQLERRM; passes := passes + 1;
    END;

    SELECT count(*) INTO n FROM public.track_now_execution_items WHERE user_id = ua;
    IF n IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'FAIL: user B can read % of user A''s items', n; END IF;
    RAISE NOTICE 'PASS: user B cannot read user A''s items'; passes := passes + 1;

    UPDATE public.track_now_execution_items SET name = 'hijacked' WHERE id = ia_task;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'FAIL: user B updated user A''s item'; END IF;
    RAISE NOTICE 'PASS: user B cannot update user A''s item'; passes := passes + 1;

    BEGIN
      INSERT INTO public.track_now_item_completions (item_id, user_id, completed_date) VALUES (ia_task, ub, CURRENT_DATE);
      RAISE EXCEPTION 'FAIL: user B logged a completion on user A''s item';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: user B cannot log completions on user A''s item'; passes := passes + 1;
    END;

    BEGIN
      INSERT INTO public.track_now_execution_items (user_id, plan_id, type, name) VALUES (ub, pa, 'task', 'planted');
      RAISE EXCEPTION 'FAIL: user B added an item to user A''s plan';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: user B cannot add items to user A''s plan'; passes := passes + 1;
    END;
    PERFORM set_config('role', 'none', true);
    PERFORM set_config('request.jwt.claims', '', true);

    SELECT current_count INTO n FROM public.track_now_execution_items WHERE id = ia_task;
    IF n IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'FAIL: user A''s counter changed after the attack (now %)', n; END IF;
    RAISE NOTICE 'PASS: user A''s data is unchanged after the attack attempts'; passes := passes + 1;

    -- --------------------------------------- user A uses the RPC normally ----
    PERFORM set_config('request.jwt.claims', claims_a, true);
    PERFORM set_config('role', 'authenticated', true);

    PERFORM public.track_now_increment_item_count(ia_task, 1, CURRENT_DATE, false);
    PERFORM public.track_now_increment_item_count(ia_task, 1, CURRENT_DATE, false);
    v := public.track_now_increment_item_count(ia_task, 1, CURRENT_DATE, false);
    IF v IS NULL OR (v->>'current_count')::int IS DISTINCT FROM 3 OR v->>'status' IS DISTINCT FROM 'done'
       OR NOT EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = ia_task AND completed_date = CURRENT_DATE) THEN
      RAISE EXCEPTION 'FAIL: owner step to target returned %', v;
    END IF;
    RAISE NOTICE 'PASS: owner can step own item; reaching target logs a completion'; passes := passes + 1;

    v := public.track_now_increment_item_count(ia_task, -1, CURRENT_DATE, false);
    IF v IS NULL OR (v->>'current_count')::int IS DISTINCT FROM 2 OR v->>'status' IS DISTINCT FROM 'todo'
       OR EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = ia_task) THEN
      RAISE EXCEPTION 'FAIL: regression below target did not revert status/completion (%)', v;
    END IF;
    RAISE NOTICE 'PASS: dropping below target reverts status and removes the completion'; passes := passes + 1;

    v := public.track_now_increment_item_count(ia_task, -99, CURRENT_DATE, false);
    IF v IS NULL OR (v->>'current_count')::int IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'FAIL: counter went below zero (%)', v;
    END IF;
    RAISE NOTICE 'PASS: counter never goes below zero'; passes := passes + 1;

    -- One-off item completed YESTERDAY, un-completed today: its old completion must go too.
    v := public.track_now_increment_item_count(ia_task_old, -1, CURRENT_DATE, false);
    IF v IS NULL OR v->>'status' IS DISTINCT FROM 'todo'
       OR EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = ia_task_old) THEN
      RAISE EXCEPTION 'FAIL: un-completing a one-off item left an older completion (%)', v;
    END IF;
    RAISE NOTICE 'PASS: un-completing a one-off item removes its earlier completion'; passes := passes + 1;

    BEGIN
      PERFORM public.track_now_increment_item_count(ia_task, 0, CURRENT_DATE, false);
      RAISE EXCEPTION 'FAIL: zero delta accepted';
    EXCEPTION WHEN invalid_parameter_value THEN
      RAISE NOTICE 'PASS: zero delta rejected'; passes := passes + 1;
    END;

    BEGIN
      PERFORM public.track_now_increment_item_count(ia_task, 1, CURRENT_DATE - 30, false);
      RAISE EXCEPTION 'FAIL: completion date 30 days in the past accepted';
    EXCEPTION WHEN invalid_parameter_value THEN
      RAISE NOTICE 'PASS: out-of-window completion date rejected'; passes := passes + 1;
    END;

    -- Habit finished yesterday: today's first + logs TODAY's completion and keeps yesterday's.
    v := public.track_now_increment_item_count(ia_habit_done, 1, CURRENT_DATE, true);
    IF v IS NULL OR v->>'status' IS DISTINCT FROM 'done'
       OR NOT EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = ia_habit_done AND completed_date = CURRENT_DATE)
       OR NOT EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = ia_habit_done AND completed_date = CURRENT_DATE - 1) THEN
      RAISE EXCEPTION 'FAIL: habit day rollover did not log today''s completion or lost history (%)', v;
    END IF;
    RAISE NOTICE 'PASS: habit finished yesterday logs a new completion today and keeps history'; passes := passes + 1;

    -- Habit left at 2/3 yesterday: the new day restarts the count.
    v := public.track_now_increment_item_count(ia_habit_part, 1, CURRENT_DATE, true);
    IF v IS NULL OR (v->>'current_count')::int IS DISTINCT FROM 1 OR v->>'status' IS DISTINCT FROM 'todo' THEN
      RAISE EXCEPTION 'FAIL: habit daily reset not applied (%)', v;
    END IF;
    RAISE NOTICE 'PASS: habit counter restarts on a new day'; passes := passes + 1;

    -- Stale client: reset flag sent for a habit ALREADY completed today must be ignored.
    v := public.track_now_increment_item_count(ia_habit_now, 1, CURRENT_DATE, true);
    IF v IS NULL OR (v->>'current_count')::int IS DISTINCT FROM 2 OR v->>'status' IS DISTINCT FROM 'done'
       OR NOT EXISTS (SELECT 1 FROM public.track_now_item_completions WHERE item_id = ia_habit_now AND completed_date = CURRENT_DATE) THEN
      RAISE EXCEPTION 'FAIL: stale reset flag wiped today''s habit progress (%)', v;
    END IF;
    RAISE NOTICE 'PASS: stale reset flag cannot wipe a habit already done today'; passes := passes + 1;

    PERFORM set_config('role', 'none', true);
    PERFORM set_config('request.jwt.claims', '', true);

    RAISE EXCEPTION USING ERRCODE = 'TNV01', MESSAGE = 'verification sandbox complete';
  EXCEPTION WHEN SQLSTATE 'TNV01' THEN
    RAISE NOTICE 'ALL % CHECKS PASSED. Every test row was rolled back.', passes;
  END;
END
$verify$;

ROLLBACK;

-- Visible in the SQL editor (only reached when every check passed).
SELECT 'ALL CHECKS PASSED (no test data was kept)' AS verification_result;

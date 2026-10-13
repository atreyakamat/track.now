-- ==============================================================================
-- READ-ONLY PRE-FLIGHT / POST-FLIGHT INVENTORY (safe on production: SELECT only)
--
-- Run before and after applying 20261012000000_secure_increment_item_count_rpc.sql
-- and keep both outputs with the change record.
--
-- Expected AFTER the migration:
--   * Query 1 returns exactly one row: track_now_increment_item_count(uuid,integer,date,boolean)
--     with security_definer = true, search_path pinned, anon_execute = false.
--   * Query 2 returns no rows (no SECURITY DEFINER function in public takes p_user_id).
--   * Query 3 lists any other SECURITY DEFINER functions the anon role can call. The
--     database is shared with other apps; review each one with its owner.
-- ==============================================================================

-- 1. Every overload of the Track.now counter RPC.
SELECT p.oid::regprocedure                                   AS function,
       p.prosecdef                                           AS security_definer,
       p.proconfig                                           AS settings,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname = 'track_now_increment_item_count'
ORDER BY 1::text;

-- 2. SECURITY DEFINER functions in public that accept a caller-supplied user id.
SELECT p.oid::regprocedure AS function, p.proargnames AS argument_names
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.prosecdef
  AND 'p_user_id' = ANY (p.proargnames)
ORDER BY 1::text;

-- 3. All SECURITY DEFINER functions in public that anon may execute (excluding triggers).
SELECT p.oid::regprocedure AS function, p.proconfig AS settings
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.prosecdef
  AND p.prorettype <> 'trigger'::regtype
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY 1::text;

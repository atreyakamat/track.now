-- ==============================================================================
-- TRACK.NOW SECURITY REMEDIATION MIGRATION (2026-10-12)
--
-- STATUS: NOT APPLIED — REQUIRES EXPLICIT OWNER APPROVAL
--   This file was prepared offline during a security audit. It has NOT been
--   executed against any remote Supabase project. Apply it only after review,
--   via the Supabase SQL editor or `supabase db push`, and verify afterwards.
--
-- FINDING (critical, cross-tenant write / IDOR):
--   public.track_now_increment_item_count (introduced in
--   20261008000000_harden_constraints_and_rls.sql) is SECURITY DEFINER, so it
--   bypasses Row Level Security. It filtered the target row by the caller-
--   supplied `p_user_id` instead of the authenticated identity, never compared
--   `p_user_id` to `auth.uid()`, set no fixed `search_path`, and relied on the
--   default EXECUTE grant to PUBLIC (which includes the `anon` role).
--   Consequence: any caller (even unauthenticated) who learns another user's
--   item UUID and user UUID could mutate that user's counter/status and
--   insert or delete their completion history.
--
-- REMEDIATION (additive; historical migrations are left untouched):
--   1. Drop every overload of the function name (incl. the vulnerable one).
--   2. Recreate the function WITHOUT `p_user_id`; the actor is `auth.uid()`.
--      A new optional `p_reset_count` flag lets the client start a habit's
--      daily counter from zero on a new day (the client already applies this
--      local-date rule in its RLS-protected fallback path).
--   3. Pin `search_path` to '' and schema-qualify every object (GREATEST/COALESCE
--      are SQL keywords, not functions, so they are left unqualified).
--   4. Validate inputs (delta bounds, completion-date window).
--   5. Revoke EXECUTE from PUBLIC and anon; grant only to authenticated
--      (and service_role for administrative tooling).
--   6. Pin `search_path` on the other SECURITY DEFINER / trigger functions.
--
-- CLIENT CONTRACT: apps/app/src/services/executionService.ts now calls
--   rpc('track_now_increment_item_count',
--       { p_item_id, p_delta, p_completed_date, p_reset_count })
--   and falls back to the RLS-protected client path only when PostgREST reports
--   that the function is missing (schema not yet migrated).
-- ==============================================================================

-- 1. Remove EVERY existing overload of this function name, not only the known
--    vulnerable (UUID, INTEGER, UUID, DATE) signature. The live database is shared
--    and may contain hand-made variants that still accept a caller-supplied user id.
DO $drop_overloads$
DECLARE
  r regprocedure;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure
    FROM pg_catalog.pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'track_now_increment_item_count'
  LOOP
    EXECUTE pg_catalog.format('DROP FUNCTION %s', r);
  END LOOP;
END
$drop_overloads$;

-- 2. Recreate with the actor derived from auth.uid().
CREATE OR REPLACE FUNCTION public.track_now_increment_item_count(
  p_item_id UUID,
  p_delta INTEGER,
  p_completed_date DATE DEFAULT CURRENT_DATE,
  p_reset_count BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_item public.track_now_execution_items%ROWTYPE;
  v_base_count integer;
  v_new_count integer;
  v_target_count integer;
  v_done_today boolean;
  v_will_be_done boolean;
  v_was_done boolean;
  v_next_status text;
  v_res jsonb;
BEGIN
  -- Identity: never trust a client-supplied user id.
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Input validation.
  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'p_item_id is required' USING ERRCODE = '22004';
  END IF;
  IF p_delta IS NULL OR p_delta = 0 OR pg_catalog.abs(p_delta) > 10000 THEN
    RAISE EXCEPTION 'p_delta must be a non-zero integer between -10000 and 10000' USING ERRCODE = '22023';
  END IF;
  -- The client sends its local calendar date; allow a small window around the
  -- server date so legitimate timezone offsets work but arbitrary history cannot
  -- be rewritten through this privileged path.
  IF p_completed_date IS NULL
     OR p_completed_date < (CURRENT_DATE - 2)
     OR p_completed_date > (CURRENT_DATE + 2) THEN
    RAISE EXCEPTION 'p_completed_date must be within two days of the current date' USING ERRCODE = '22023';
  END IF;

  -- Row-level lock on the caller's own item only.
  SELECT * INTO v_item
  FROM public.track_now_execution_items
  WHERE id = p_item_id AND user_id = v_actor
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution item not found or unauthorized' USING ERRCODE = '42501';
  END IF;

  v_target_count := GREATEST(1, COALESCE(v_item.target_count, 1));

  -- Completion state for the requested day (read under the row lock above).
  v_done_today := EXISTS (
    SELECT 1 FROM public.track_now_item_completions c
    WHERE c.item_id = p_item_id
      AND c.user_id = v_actor
      AND c.completed_date = p_completed_date
  );

  -- Habits restart their counter each scheduled day. The client passes
  -- p_reset_count = true when its local calendar day is newer than the item's
  -- last activity. The server only honours it when the habit is NOT already
  -- completed for that day, so a stale client can never wipe today's progress.
  v_base_count := CASE
    WHEN p_reset_count IS TRUE AND v_item.type = 'habit' AND NOT v_done_today THEN 0
    ELSE COALESCE(v_item.current_count, 0)
  END;
  v_new_count := GREATEST(0, v_base_count + p_delta);
  v_will_be_done := v_new_count >= v_target_count;

  -- "Was done": per-day truth from the completion log for habits; status for one-off items.
  v_was_done := CASE
    WHEN v_item.type = 'habit' THEN v_done_today
    ELSE v_item.status = 'done'
  END;
  v_next_status := CASE WHEN v_will_be_done THEN 'done' ELSE 'todo' END;

  UPDATE public.track_now_execution_items
  SET current_count = v_new_count,
      status = v_next_status,
      updated_at = pg_catalog.now()
  WHERE id = p_item_id AND user_id = v_actor;

  -- Keep the completion log consistent with the status transition.
  IF v_will_be_done AND NOT v_was_done THEN
    INSERT INTO public.track_now_item_completions (item_id, user_id, completed_date)
    VALUES (p_item_id, v_actor, p_completed_date)
    ON CONFLICT (item_id, completed_date) DO NOTHING;
  ELSIF NOT v_will_be_done AND v_was_done THEN
    IF v_item.type = 'habit' THEN
      -- Habits: undo only the requested day's completion.
      DELETE FROM public.track_now_item_completions
      WHERE item_id = p_item_id
        AND user_id = v_actor
        AND completed_date = p_completed_date;
    ELSE
      -- One-off items have a single completion event, possibly logged on an earlier
      -- day; un-completing removes it (matches the client's syncCompletionLog).
      DELETE FROM public.track_now_item_completions
      WHERE item_id = p_item_id
        AND user_id = v_actor;
    END IF;
  END IF;

  SELECT pg_catalog.row_to_json(t)::jsonb INTO v_res
  FROM (
    SELECT i.*,
      (SELECT pg_catalog.json_agg(s.*)
       FROM public.track_now_item_schedules s
       WHERE s.item_id = i.id) AS track_now_item_schedules
    FROM public.track_now_execution_items i
    WHERE i.id = p_item_id AND i.user_id = v_actor
  ) t;

  RETURN v_res;
END;
$$;

COMMENT ON FUNCTION public.track_now_increment_item_count(UUID, INTEGER, DATE, BOOLEAN) IS
  'Atomically steps an execution item counter for the authenticated user (auth.uid()). SECURITY DEFINER with pinned search_path; never trusts a client-supplied user id.';

-- 3. Least-privilege execution grants.
REVOKE ALL ON FUNCTION public.track_now_increment_item_count(UUID, INTEGER, DATE, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_now_increment_item_count(UUID, INTEGER, DATE, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.track_now_increment_item_count(UUID, INTEGER, DATE, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_now_increment_item_count(UUID, INTEGER, DATE, BOOLEAN) TO service_role;

-- 4. Pin search_path on the remaining definer/trigger functions (defense in depth).
--    Both bodies already schema-qualify their table references; built-ins resolve
--    from pg_catalog regardless of search_path.
ALTER FUNCTION public.handle_new_track_now_user() SET search_path = '';
ALTER FUNCTION public.handle_track_now_updated_at() SET search_path = '';

-- 5. Ask PostgREST to reload its schema cache so the new signature is visible.
NOTIFY pgrst, 'reload schema';

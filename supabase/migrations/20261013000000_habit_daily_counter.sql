-- ==============================================================================
-- TRACK.NOW HABIT DAILY COUNTER MIGRATION (2026-10-13)
--
-- STATUS: NOT APPLIED — REQUIRES EXPLICIT OWNER APPROVAL.
--   Apply only AFTER 20261012000000_secure_increment_item_count_rpc.sql, on a
--   development project first. See RELEASE_READINESS.md for the sequence.
--
-- PROBLEM:
--   A habit's `current_count` belongs to one calendar day, but the schema had no
--   record of WHICH day. The client guessed it from `updated_at`: "last touched
--   before today => yesterday's count => restart from 0". Any unrelated edit
--   (rename, priority, description) bumps `updated_at` through the trigger, so a
--   habit edited on a new day before its counter was pressed kept counting from
--   the previous day's value — and an edit could even log a completion for today
--   from yesterday's count.
--
-- FIX (additive, idempotent):
--   1. New nullable column `count_date DATE`: the client's local calendar day that
--      `current_count` belongs to. NULL means "unknown" (legacy rows / old clients).
--   2. One-time backfill for existing rows (best effort, see note below).
--   3. The counter RPC now decides the daily restart itself from `count_date`:
--        * habit, not completed on p_completed_date, count_date < p_completed_date
--          -> the counter restarts from 0 before applying p_delta;
--        * habit, count_date > p_completed_date (a request for an OLDER day that
--          arrives after the counter already moved to a newer day, e.g. two devices
--          around midnight) -> rejected, nothing is changed;
--        * count_date IS NULL -> legacy behaviour: the client's p_reset_count hint
--          is honoured only if the habit is not already completed that day.
--      Every successful call stores count_date = p_completed_date.
--   Signature, security properties (auth.uid(), pinned search_path, grants) are
--   unchanged from 20261012000000.
--
-- BACKFILL NOTE: legacy rows have no day information.
--   * A habit whose status is 'done' gets the date of its latest completion (that
--     date was sent by the client, so it is the user's local day).
--   * Rows last updated more than 36 hours ago get the UTC date of `updated_at`:
--     that moment is at least one local day in the past in every timezone, so the
--     habit correctly restarts on its next press.
--   * Habits updated within the last 36 hours are left NULL (their local day is
--     ambiguous across timezones); the RPC then keeps the pre-migration behaviour
--     for them (client hint) until their next counter write stamps a real day.
--   A habit renamed shortly before the migration with a stale count can therefore
--   still show that count once; every later press is correct.
-- ==============================================================================

-- 0. Ordering guard: the security remediation must already be in place, otherwise
--    CREATE OR REPLACE below would add a second overload next to the vulnerable one.
DO $guard$
BEGIN
  IF to_regprocedure('public.track_now_increment_item_count(uuid,integer,uuid,date)') IS NOT NULL THEN
    RAISE EXCEPTION 'Apply 20261012000000_secure_increment_item_count_rpc.sql before this migration (vulnerable overload still present).';
  END IF;
END
$guard$;

-- 1. Column.
ALTER TABLE public.track_now_execution_items
  ADD COLUMN IF NOT EXISTS count_date DATE;

COMMENT ON COLUMN public.track_now_execution_items.count_date IS
  'Local calendar date (client day) that current_count belongs to. Habits restart their counter when a newer day is reached. NULL = unknown (legacy row).';

-- 2. Backfill (only rows that have never been assigned a day; safe to re-run).
--    The updated_at trigger is suspended so the backfill does not make every item
--    look "active today" in progress/last-activity views.
ALTER TABLE public.track_now_execution_items DISABLE TRIGGER tr_track_now_items_updated_at;

UPDATE public.track_now_execution_items AS i
SET count_date = COALESCE(
  CASE
    WHEN i.type = 'habit' AND i.status = 'done' THEN (
      SELECT max(c.completed_date)
      FROM public.track_now_item_completions AS c
      WHERE c.item_id = i.id
    )
  END,
  CASE
    WHEN i.updated_at < pg_catalog.now() - interval '36 hours' THEN (i.updated_at AT TIME ZONE 'UTC')::date
  END
)
WHERE i.count_date IS NULL;

ALTER TABLE public.track_now_execution_items ENABLE TRIGGER tr_track_now_items_updated_at;

-- 3. Counter RPC with server-side daily semantics (same signature as 20261012000000).
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
  v_is_habit boolean;
  v_restart boolean;
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

  -- Row-level lock on the caller's own item only. Concurrent calls for the same
  -- item queue here, so every delta is applied exactly once.
  SELECT * INTO v_item
  FROM public.track_now_execution_items
  WHERE id = p_item_id AND user_id = v_actor
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution item not found or unauthorized' USING ERRCODE = '42501';
  END IF;

  v_is_habit := v_item.type = 'habit';

  -- A habit counter never moves backwards in time: a request for an older day than
  -- the one the counter already belongs to is stale and must not touch newer progress.
  IF v_is_habit AND v_item.count_date IS NOT NULL AND p_completed_date < v_item.count_date THEN
    RAISE EXCEPTION 'This habit was already updated for a later day (%). Refresh and try again.', v_item.count_date
      USING ERRCODE = '22023';
  END IF;

  v_target_count := GREATEST(1, COALESCE(v_item.target_count, 1));

  -- Completion state for the requested day (read under the row lock above).
  v_done_today := EXISTS (
    SELECT 1 FROM public.track_now_item_completions c
    WHERE c.item_id = p_item_id
      AND c.user_id = v_actor
      AND c.completed_date = p_completed_date
  );

  -- Daily restart. Decided from count_date when known; the client's hint is only a
  -- fallback for legacy rows. Never restart a habit already completed that day.
  v_restart := v_is_habit AND NOT v_done_today AND CASE
    WHEN v_item.count_date IS NULL THEN p_reset_count IS TRUE
    ELSE v_item.count_date < p_completed_date
  END;

  v_base_count := CASE WHEN v_restart THEN 0 ELSE COALESCE(v_item.current_count, 0) END;
  v_new_count := GREATEST(0, v_base_count + p_delta);
  v_will_be_done := v_new_count >= v_target_count;

  -- "Was done": per-day truth from the completion log for habits; status for one-off items.
  v_was_done := CASE WHEN v_is_habit THEN v_done_today ELSE v_item.status = 'done' END;
  v_next_status := CASE WHEN v_will_be_done THEN 'done' ELSE 'todo' END;

  UPDATE public.track_now_execution_items
  SET current_count = v_new_count,
      count_date = p_completed_date,
      status = v_next_status,
      updated_at = pg_catalog.now()
  WHERE id = p_item_id AND user_id = v_actor;

  -- Keep the completion log consistent with the status transition.
  IF v_will_be_done AND NOT v_was_done THEN
    INSERT INTO public.track_now_item_completions (item_id, user_id, completed_date)
    VALUES (p_item_id, v_actor, p_completed_date)
    ON CONFLICT (item_id, completed_date) DO NOTHING;
  ELSIF NOT v_will_be_done AND v_was_done THEN
    IF v_is_habit THEN
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
  'Atomically steps an execution item counter for the authenticated user (auth.uid()). Habits restart per day using count_date. SECURITY DEFINER with pinned search_path; never trusts a client-supplied user id.';

-- 4. Re-assert least-privilege grants (CREATE OR REPLACE keeps them, this is defensive).
REVOKE ALL ON FUNCTION public.track_now_increment_item_count(UUID, INTEGER, DATE, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_now_increment_item_count(UUID, INTEGER, DATE, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.track_now_increment_item_count(UUID, INTEGER, DATE, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_now_increment_item_count(UUID, INTEGER, DATE, BOOLEAN) TO service_role;

NOTIFY pgrst, 'reload schema';

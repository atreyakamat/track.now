-- ==============================================================================
-- TRACK.NOW SCHEMA HARDENING MIGRATION (2026-10-08)
-- Adds database-level CHECK constraints for numeric targets and entity names.
-- Hardens track_now_execution_items RLS policy to validate track_id ownership.
-- ==============================================================================

-- 1. Numeric target invariants on track_now_execution_items
ALTER TABLE public.track_now_execution_items
  DROP CONSTRAINT IF EXISTS chk_track_now_items_target_count,
  ADD CONSTRAINT chk_track_now_items_target_count CHECK (target_count >= 1);

ALTER TABLE public.track_now_execution_items
  DROP CONSTRAINT IF EXISTS chk_track_now_items_current_count,
  ADD CONSTRAINT chk_track_now_items_current_count CHECK (current_count >= 0);

-- 2. Non-empty string invariants for entity names
ALTER TABLE public.track_now_tracks
  DROP CONSTRAINT IF EXISTS chk_track_now_tracks_name_nonempty,
  ADD CONSTRAINT chk_track_now_tracks_name_nonempty CHECK (length(trim(name)) > 0);

ALTER TABLE public.track_now_plans
  DROP CONSTRAINT IF EXISTS chk_track_now_plans_name_nonempty,
  ADD CONSTRAINT chk_track_now_plans_name_nonempty CHECK (length(trim(name)) > 0);

ALTER TABLE public.track_now_execution_items
  DROP CONSTRAINT IF EXISTS chk_track_now_items_name_nonempty,
  ADD CONSTRAINT chk_track_now_items_name_nonempty CHECK (length(trim(name)) > 0);

-- 3. Hardened RLS policy on track_now_execution_items (ensures track_id belongs to user)
DROP POLICY IF EXISTS "track_now_items_user_isolation" ON public.track_now_execution_items;
CREATE POLICY "track_now_items_user_isolation"
  ON public.track_now_execution_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.track_now_plans
      WHERE public.track_now_plans.id = track_now_execution_items.plan_id
        AND public.track_now_plans.user_id = auth.uid()
    )
    AND (
      track_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.track_now_tracks
        WHERE public.track_now_tracks.id = track_now_execution_items.track_id
          AND public.track_now_tracks.user_id = auth.uid()
      )
    )
  );

-- 4. Atomic Counter Mutation RPC (eliminates lost-update race conditions)
CREATE OR REPLACE FUNCTION public.track_now_increment_item_count(
  p_item_id UUID,
  p_delta INTEGER,
  p_user_id UUID,
  p_completed_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_item record;
  v_new_count integer;
  v_target_count integer;
  v_will_be_done boolean;
  v_was_done boolean;
  v_next_status text;
  v_res jsonb;
BEGIN
  -- Acquire row-level lock on the execution item
  SELECT * INTO v_item
  FROM public.track_now_execution_items
  WHERE id = p_item_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution item not found or unauthorized';
  END IF;

  v_target_count := GREATEST(1, COALESCE(v_item.target_count, 1));
  v_new_count := GREATEST(0, COALESCE(v_item.current_count, 0) + p_delta);
  v_will_be_done := v_new_count >= v_target_count;
  v_was_done := v_item.status = 'done';
  v_next_status := CASE WHEN v_will_be_done THEN 'done' ELSE 'todo' END;

  UPDATE public.track_now_execution_items
  SET current_count = v_new_count,
      status = v_next_status,
      updated_at = now()
  WHERE id = p_item_id;

  -- Synchronize completion log
  IF v_will_be_done AND NOT v_was_done THEN
    INSERT INTO public.track_now_item_completions (item_id, user_id, completed_date)
    VALUES (p_item_id, p_user_id, p_completed_date)
    ON CONFLICT (item_id, completed_date) DO NOTHING;
  ELSIF NOT v_will_be_done AND v_was_done THEN
    DELETE FROM public.track_now_item_completions
    WHERE item_id = p_item_id AND completed_date = p_completed_date;
  END IF;

  SELECT row_to_json(t)::jsonb INTO v_res
  FROM (
    SELECT i.*, 
      (SELECT json_agg(s.*) FROM public.track_now_item_schedules s WHERE s.item_id = i.id) AS track_now_item_schedules
    FROM public.track_now_execution_items i
    WHERE i.id = p_item_id
  ) t;

  RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

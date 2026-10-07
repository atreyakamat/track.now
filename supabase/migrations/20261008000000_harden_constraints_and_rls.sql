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

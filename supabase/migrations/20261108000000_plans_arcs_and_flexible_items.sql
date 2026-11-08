-- ==============================================================================
-- TRACK.NOW: Plans/Arcs lifecycle + flexible execution items (2026-11-08)
--
-- Additive only. Every new column is nullable (or has a default), so existing rows,
-- older app builds and the counter RPC keep working unchanged. Idempotent.
--
-- Plans / Arcs
--   * status gains 'draft' and 'paused' (lifecycle: draft → active → paused → completed → archived).
--   * plan_kind: 'time_bound' | 'ongoing' | 'recurring' (NULL = legacy row; the app derives
--     time_bound when end_date is set, otherwise ongoing).
--   * outcome / success_criteria: what the Plan is for.
--   * completed_at + result_notes / lessons_learned / next_decision: the Plan completion
--     review, stored with the Plan so it is synchronised across devices.
--
-- Execution items
--   * start_date: an item (e.g. a habit) can begin later than its Plan. Before it, the item is
--     "upcoming" and never counts against progress or streaks.
--   * checklist_entries: ordered checklist steps [{ "id", "label", "done" }] (max 50).
--
-- Schedules
--   * times_per_week: flexible weekly habits ("3 runs a week, any day"). NULL = fixed days.
--
-- Does not touch tracked_profiles, rls_auto_enable() or any other non-Track.now object.
-- ==============================================================================

-- 1. Plan status values ---------------------------------------------------------
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.track_now_plans'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND conname <> 'chk_track_now_plans_status'
  LOOP
    EXECUTE format('ALTER TABLE public.track_now_plans DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.track_now_plans DROP CONSTRAINT IF EXISTS chk_track_now_plans_status;
ALTER TABLE public.track_now_plans
  ADD CONSTRAINT chk_track_now_plans_status
  CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived'));

-- 2. Plan fields ------------------------------------------------------------------
ALTER TABLE public.track_now_plans ADD COLUMN IF NOT EXISTS plan_kind text;
ALTER TABLE public.track_now_plans ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE public.track_now_plans ADD COLUMN IF NOT EXISTS success_criteria text;
ALTER TABLE public.track_now_plans ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.track_now_plans ADD COLUMN IF NOT EXISTS result_notes text;
ALTER TABLE public.track_now_plans ADD COLUMN IF NOT EXISTS lessons_learned text;
ALTER TABLE public.track_now_plans ADD COLUMN IF NOT EXISTS next_decision text;

ALTER TABLE public.track_now_plans DROP CONSTRAINT IF EXISTS chk_track_now_plans_kind;
ALTER TABLE public.track_now_plans
  ADD CONSTRAINT chk_track_now_plans_kind
  CHECK (plan_kind IS NULL OR plan_kind IN ('time_bound', 'ongoing', 'recurring'));

ALTER TABLE public.track_now_plans DROP CONSTRAINT IF EXISTS chk_track_now_plans_dates;
ALTER TABLE public.track_now_plans
  ADD CONSTRAINT chk_track_now_plans_dates
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date) NOT VALID;

ALTER TABLE public.track_now_plans DROP CONSTRAINT IF EXISTS chk_track_now_plans_text_lengths;
ALTER TABLE public.track_now_plans
  ADD CONSTRAINT chk_track_now_plans_text_lengths
  CHECK (
    coalesce(length(outcome), 0) <= 2000
    AND coalesce(length(success_criteria), 0) <= 4000
    AND coalesce(length(result_notes), 0) <= 4000
    AND coalesce(length(lessons_learned), 0) <= 4000
    AND coalesce(length(next_decision), 0) <= 2000
  );

-- 3. Execution item fields ----------------------------------------------------
ALTER TABLE public.track_now_execution_items ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.track_now_execution_items ADD COLUMN IF NOT EXISTS checklist_entries jsonb;

ALTER TABLE public.track_now_execution_items DROP CONSTRAINT IF EXISTS chk_track_now_items_checklist_entries;
ALTER TABLE public.track_now_execution_items
  ADD CONSTRAINT chk_track_now_items_checklist_entries
  CHECK (
    checklist_entries IS NULL
    OR (jsonb_typeof(checklist_entries) = 'array' AND jsonb_array_length(checklist_entries) <= 50)
  );

-- 4. Flexible weekly habits ---------------------------------------------------
ALTER TABLE public.track_now_item_schedules ADD COLUMN IF NOT EXISTS times_per_week smallint;

ALTER TABLE public.track_now_item_schedules DROP CONSTRAINT IF EXISTS chk_track_now_schedules_times_per_week;
ALTER TABLE public.track_now_item_schedules
  ADD CONSTRAINT chk_track_now_schedules_times_per_week
  CHECK (times_per_week IS NULL OR times_per_week BETWEEN 1 AND 7);

-- 5. Make PostgREST see the new columns immediately.
NOTIFY pgrst, 'reload schema';

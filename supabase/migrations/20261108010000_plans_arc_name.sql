-- ==============================================================================
-- TRACK.NOW: Arc grouping for Plans (2026-11-08, follow-up to 20261108000000)
--
-- arc_name: optional label that groups Plans from different Tracks into one Arc
-- (e.g. "Winter Arc 2026" spanning Health, Work, Money…). Plain text owned by the row;
-- the Arc page and retention are derived client-side. RLS unchanged.
-- Additive, nullable, idempotent.
-- ==============================================================================

ALTER TABLE public.track_now_plans ADD COLUMN IF NOT EXISTS arc_name text;

ALTER TABLE public.track_now_plans DROP CONSTRAINT IF EXISTS chk_track_now_plans_arc_name;
ALTER TABLE public.track_now_plans
  ADD CONSTRAINT chk_track_now_plans_arc_name
  CHECK (arc_name IS NULL OR length(arc_name) <= 80);

NOTIFY pgrst, 'reload schema';

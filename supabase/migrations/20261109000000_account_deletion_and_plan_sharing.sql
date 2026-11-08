-- ==============================================================================
-- TRACK.NOW: account deletion + read-only Plan sharing (2026-11-09)
--
-- 1. track_now_delete_my_account(): the signed-in user deletes their own account and every
--    row they own. SECURITY DEFINER, acts only on auth.uid(), callable by authenticated only.
-- 2. track_now_plan_shares: owner-created share links (random token) for one Plan.
--    RLS: only the owner sees or changes their shares.
-- 3. track_now_get_shared_plan(share_token): public read of ONE Plan (name, dates, outcome,
--    items, last 90 days of completions, owner display name) for a valid, unrevoked token.
--    Never exposes ids of other rows, emails, or anything outside that Plan.
-- Additive and idempotent.
-- ==============================================================================

-- 1. Delete my account ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_now_delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.track_now_item_completions WHERE user_id = uid;
  DELETE FROM public.track_now_item_schedules
    WHERE item_id IN (SELECT id FROM public.track_now_execution_items WHERE user_id = uid);
  DELETE FROM public.track_now_execution_items WHERE user_id = uid;
  DELETE FROM public.track_now_plans WHERE user_id = uid;
  DELETE FROM public.track_now_tracks WHERE user_id = uid;
  DELETE FROM public.track_now_profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.track_now_delete_my_account() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.track_now_delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.track_now_delete_my_account() TO authenticated;

-- 2. Plan shares ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.track_now_plan_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.track_now_plans(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (length(token) BETWEEN 32 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS track_now_plan_shares_plan_idx ON public.track_now_plan_shares(plan_id);
ALTER TABLE public.track_now_plan_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS track_now_plan_shares_owner_select ON public.track_now_plan_shares;
CREATE POLICY track_now_plan_shares_owner_select ON public.track_now_plan_shares
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS track_now_plan_shares_owner_insert ON public.track_now_plan_shares;
CREATE POLICY track_now_plan_shares_owner_insert ON public.track_now_plan_shares
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.track_now_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS track_now_plan_shares_owner_update ON public.track_now_plan_shares;
CREATE POLICY track_now_plan_shares_owner_update ON public.track_now_plan_shares
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS track_now_plan_shares_owner_delete ON public.track_now_plan_shares;
CREATE POLICY track_now_plan_shares_owner_delete ON public.track_now_plan_shares
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.track_now_plan_shares FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.track_now_plan_shares TO authenticated;

-- 3. Public read of one shared Plan -------------------------------------------
CREATE OR REPLACE FUNCTION public.track_now_get_shared_plan(share_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.track_now_plan_shares%ROWTYPE;
  result jsonb;
BEGIN
  IF share_token IS NULL OR length(share_token) < 32 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO s FROM public.track_now_plan_shares WHERE token = share_token AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object(
    'plan', jsonb_build_object(
      'name', p.name, 'description', p.description, 'start_date', p.start_date, 'end_date', p.end_date,
      'status', p.status, 'outcome', p.outcome, 'success_criteria', p.success_criteria, 'arc_name', p.arc_name),
    'track', (SELECT jsonb_build_object('name', t.name, 'color', t.color, 'icon', t.icon) FROM public.track_now_tracks t WHERE t.id = p.track_id),
    'owner_name', (SELECT coalesce(pr.display_name, pr.full_name) FROM public.track_now_profiles pr WHERE pr.id = p.user_id),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'type', i.type, 'status', i.status, 'due_date', i.due_date, 'start_date', i.start_date,
        'schedule', (SELECT jsonb_build_object('frequency', sc.frequency, 'days_of_week', sc.days_of_week, 'times_per_week', sc.times_per_week)
                     FROM public.track_now_item_schedules sc WHERE sc.item_id = i.id LIMIT 1)
      ) ORDER BY i.created_at)
      FROM public.track_now_execution_items i WHERE i.plan_id = p.id AND i.status <> 'archived'), '[]'::jsonb),
    'completions', coalesce((
      SELECT jsonb_agg(jsonb_build_object('item_id', c.item_id, 'completed_date', c.completed_date) ORDER BY c.completed_date)
      FROM public.track_now_item_completions c
      JOIN public.track_now_execution_items i ON i.id = c.item_id
      WHERE i.plan_id = p.id AND c.completed_date >= (current_date - 90)), '[]'::jsonb)
  ) INTO result
  FROM public.track_now_plans p WHERE p.id = s.plan_id;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.track_now_get_shared_plan(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_now_get_shared_plan(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

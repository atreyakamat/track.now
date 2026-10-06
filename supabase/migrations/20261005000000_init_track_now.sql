-- ==============================================================================
-- TRACK.NOW AUTHORITATIVE INITIAL SCHEMA (2026-10-05)
-- Completely isolated from existing tables (e.g. tracked_profiles).
-- Uses explicit `track_now_*` prefix for all tables, functions, triggers, and constraints.
-- ==============================================================================

-- 1. Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_track_now_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Track.now User Profiles (Linked exclusively to auth.users, NOT tracked_profiles)
CREATE TABLE IF NOT EXISTS public.track_now_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  display_name TEXT GENERATED ALWAYS AS (COALESCE(full_name, email)) STORED,
  avatar_url TEXT,
  theme_preference TEXT DEFAULT 'system' CHECK (theme_preference IN ('system', 'light', 'dark')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.track_now_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "track_now_profiles_select_own" ON public.track_now_profiles;
CREATE POLICY "track_now_profiles_select_own"
  ON public.track_now_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "track_now_profiles_update_own" ON public.track_now_profiles;
CREATE POLICY "track_now_profiles_update_own"
  ON public.track_now_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "track_now_profiles_insert_own" ON public.track_now_profiles;
CREATE POLICY "track_now_profiles_insert_own"
  ON public.track_now_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS tr_track_now_profiles_updated_at ON public.track_now_profiles;
CREATE TRIGGER tr_track_now_profiles_updated_at
  BEFORE UPDATE ON public.track_now_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_track_now_updated_at();

-- 3. Automatic Profile Creation on Supabase Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_track_now_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.track_now_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_track_now ON auth.users;
CREATE TRIGGER on_auth_user_created_track_now
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_track_now_user();

-- 4. Track Templates (Catalog of predefined templates)
CREATE TABLE IF NOT EXISTS public.track_now_track_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  default_items JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.track_now_track_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "track_now_templates_public_read" ON public.track_now_track_templates;
CREATE POLICY "track_now_templates_public_read"
  ON public.track_now_track_templates FOR SELECT
  USING (true);

-- 5. User Tracks
CREATE TABLE IF NOT EXISTS public.track_now_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder' NOT NULL,
  color TEXT DEFAULT '#ffbe0b' NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')) NOT NULL,
  is_template BOOLEAN DEFAULT false NOT NULL,
  template_key TEXT,
  position INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_track_now_tracks_user_status
  ON public.track_now_tracks(user_id, status);

ALTER TABLE public.track_now_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "track_now_tracks_user_isolation" ON public.track_now_tracks;
CREATE POLICY "track_now_tracks_user_isolation"
  ON public.track_now_tracks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS tr_track_now_tracks_updated_at ON public.track_now_tracks;
CREATE TRIGGER tr_track_now_tracks_updated_at
  BEFORE UPDATE ON public.track_now_tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_track_now_updated_at();

-- 6. Plans / Arcs (Nested beneath a Track)
CREATE TABLE IF NOT EXISTS public.track_now_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  track_id UUID REFERENCES public.track_now_tracks(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  title TEXT GENERATED ALWAYS AS (name) STORED,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')) NOT NULL,
  start_date DATE,
  end_date DATE,
  position INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_track_now_plans_track_status
  ON public.track_now_plans(track_id, status);
CREATE INDEX IF NOT EXISTS idx_track_now_plans_user_status
  ON public.track_now_plans(user_id, status);

ALTER TABLE public.track_now_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "track_now_plans_user_isolation" ON public.track_now_plans;
CREATE POLICY "track_now_plans_user_isolation"
  ON public.track_now_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS tr_track_now_plans_updated_at ON public.track_now_plans;
CREATE TRIGGER tr_track_now_plans_updated_at
  BEFORE UPDATE ON public.track_now_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_track_now_updated_at();

-- 7. Execution Items (Habit, Task, Checklist, Milestone, Project)
CREATE TABLE IF NOT EXISTS public.track_now_execution_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.track_now_plans(id) ON DELETE CASCADE NOT NULL,
  track_id UUID REFERENCES public.track_now_tracks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('habit', 'task', 'checklist', 'milestone', 'project')),
  name TEXT NOT NULL,
  title TEXT GENERATED ALWAYS AS (name) STORED,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'archived')) NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')) NOT NULL,
  due_date DATE,
  target_count INTEGER DEFAULT 1 NOT NULL,
  current_count INTEGER DEFAULT 0 NOT NULL,
  unit TEXT,
  position INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_track_now_items_plan_status
  ON public.track_now_execution_items(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_track_now_items_user_due
  ON public.track_now_execution_items(user_id, due_date);

ALTER TABLE public.track_now_execution_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "track_now_items_user_isolation" ON public.track_now_execution_items;
CREATE POLICY "track_now_items_user_isolation"
  ON public.track_now_execution_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS tr_track_now_items_updated_at ON public.track_now_execution_items;
CREATE TRIGGER tr_track_now_items_updated_at
  BEFORE UPDATE ON public.track_now_execution_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_track_now_updated_at();

-- 8. Item Schedules
CREATE TABLE IF NOT EXISTS public.track_now_item_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.track_now_execution_items(id) ON DELETE CASCADE NOT NULL,
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')) NOT NULL,
  days_of_week INTEGER[],
  time_of_day TEXT CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'anytime')),
  reminder_time TIME,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.track_now_item_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "track_now_schedules_user_isolation" ON public.track_now_item_schedules;
CREATE POLICY "track_now_schedules_user_isolation"
  ON public.track_now_item_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.track_now_execution_items
      WHERE public.track_now_execution_items.id = public.track_now_item_schedules.item_id
        AND public.track_now_execution_items.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.track_now_execution_items
      WHERE public.track_now_execution_items.id = public.track_now_item_schedules.item_id
        AND public.track_now_execution_items.user_id = auth.uid()
    )
  );

-- 9. Item Completions Log (with database-level unique constraint)
CREATE TABLE IF NOT EXISTS public.track_now_item_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.track_now_execution_items(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  completed_date DATE DEFAULT CURRENT_DATE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  notes TEXT
);

-- Unique index to guarantee one completion per item per calendar date at the database level
CREATE UNIQUE INDEX IF NOT EXISTS uq_track_now_completions_item_date
  ON public.track_now_item_completions(item_id, completed_date);

ALTER TABLE public.track_now_item_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "track_now_completions_user_isolation" ON public.track_now_item_completions;
CREATE POLICY "track_now_completions_user_isolation"
  ON public.track_now_item_completions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. Seed Predefined Track Templates
INSERT INTO public.track_now_track_templates (key, name, description, icon, color, default_items)
VALUES
  (
    'fitness',
    'Fitness',
    'Physical conditioning, training splits, nutrition habits, and endurance milestones.',
    'activity',
    '#06d6a0',
    '[
      {"title": "Morning mobility & stretch", "type": "habit"},
      {"title": "Hydration target: 3L water", "type": "habit"},
      {"title": "Complete 4 weekly resistance workouts", "type": "milestone"}
    ]'::jsonb
  ),
  (
    'finance',
    'Finance',
    'Budget tracking, investment reviews, debt elimination arcs, and savings goals.',
    'wallet',
    '#ffbe0b',
    '[
      {"title": "Log daily expenditures", "type": "habit"},
      {"title": "Weekly budget balance review", "type": "task"},
      {"title": "Fund emergency buffer", "type": "milestone"}
    ]'::jsonb
  ),
  (
    'career',
    'Career',
    'Role advancement, portfolio building, networking targets, and quarterly deliverables.',
    'briefcase',
    '#3a86ff',
    '[
      {"title": "Deep work block (90 min)", "type": "habit"},
      {"title": "Review quarterly OKRs", "type": "task"},
      {"title": "Ship core feature deliverable", "type": "project"}
    ]'::jsonb
  ),
  (
    'learning',
    'Learning & Productivity',
    'Skill acquisition, reading lists, study sprints, and system workflows.',
    'book-open',
    '#8338ec',
    '[
      {"title": "Read 20 pages", "type": "habit"},
      {"title": "Synthesize weekly knowledge notes", "type": "task"},
      {"title": "Complete certification module", "type": "milestone"}
    ]'::jsonb
  ),
  (
    'business',
    'Business',
    'Revenue milestones, product launches, client acquisition, and operational hygiene.',
    'building-2',
    '#ff006e',
    '[
      {"title": "Reach out to 5 prospective clients", "type": "habit"},
      {"title": "Weekly revenue & runway check", "type": "task"},
      {"title": "Launch product V1 release", "type": "milestone"}
    ]'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  default_items = EXCLUDED.default_items;

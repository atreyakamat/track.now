# Track.now — Database & Storage Specification

This document provides the complete database schema, indexing strategy, Row Level Security (RLS) policies, and entity relationships for **Track.now**'s PostgreSQL backend on Supabase.

> [!IMPORTANT]
> **Coexistence & Isolation Notice:**
> Track.now shares a Supabase project with other applications (such as `tracked_profiles`). To ensure total database independence and eliminate collision risk, all Track.now database objects strictly use the **`track_now_*`** prefix.
> Existing tables belonging to other applications are untouched and unreferenced.

---

## 1. Schema Overview

Track.now uses a fully isolated relational PostgreSQL schema designed for multi-tenancy, referential integrity, and cascading lifecycle management.

```
                               auth.users
                                   │ (1:1)
                                   ▼
                      public.track_now_profiles
                                   │
                 ┌─────────────────┴─────────────────┐
                 │ (1:N)                             │ (1:N)
                 ▼                                   ▼
      public.track_now_tracks               public.track_now_plans
                 │ (1:N)                             │ (1:N)
                 └─────────────────┬─────────────────┘
                                   │
                                   ▼
                    public.track_now_execution_items
                                   │
                 ┌─────────────────┴─────────────────┐
                 │ (1:1)                             │ (1:N)
                 ▼                                   ▼
    public.track_now_item_schedules     public.track_now_item_completions
```

---

## 2. Table Specifications

### 2.1 `public.track_now_profiles`
Stores extended user account information linked directly to `auth.users(id)`. Completely independent from existing external profile tables.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY, REFERENCES auth.users(id) ON DELETE CASCADE` | Linked auth user ID |
| `email` | `text` | `NOT NULL` | User email address |
| `full_name` | `text` | `NULL` | User display name |
| `display_name` | `text` | `GENERATED ALWAYS AS (COALESCE(full_name, email)) STORED` | Fallback display name |
| `avatar_url` | `text` | `NULL` | Public avatar URL |
| `theme_preference` | `text` | `DEFAULT 'system' CHECK IN ('system','light','dark')` | UI theme preference |
| `created_at` | `timestamptz` | `DEFAULT now() NOT NULL` | Creation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT now() NOT NULL` | Last update timestamp |

### 2.2 `public.track_now_track_templates`
System-provided catalog of starter track presets (Fitness, Finance, Career, Learning & Productivity, Business).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Template unique ID |
| `key` | `text` | `UNIQUE NOT NULL` | Machine key (`fitness`, `finance`, etc.) |
| `name` | `text` | `NOT NULL` | Display title |
| `description` | `text` | `NOT NULL` | Explanatory subtitle |
| `icon` | `text` | `NOT NULL` | Lucide icon identifier |
| `color` | `text` | `NOT NULL` | Hex color code |
| `default_items` | `jsonb` | `DEFAULT '[]'::jsonb NOT NULL` | Starter item blueprints |
| `created_at` | `timestamptz` | `DEFAULT now() NOT NULL` | Creation timestamp |

### 2.3 `public.track_now_tracks`
User-owned major life domains.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Track unique ID |
| `user_id` | `uuid` | `REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL` | Owner ID |
| `name` | `text` | `NOT NULL` | Track name |
| `description` | `text` | `NULL` | Optional description |
| `icon` | `text` | `DEFAULT 'folder' NOT NULL` | Lucide icon identifier |
| `color` | `text` | `DEFAULT '#ffbe0b' NOT NULL` | Hex color code |
| `status` | `text` | `DEFAULT 'active' CHECK IN ('active', 'archived')` | Lifecycle status |
| `is_template` | `boolean` | `DEFAULT false NOT NULL` | Instantiated from template flag |
| `template_key` | `text` | `NULL` | Original template key reference |
| `position` | `integer` | `DEFAULT 0 NOT NULL` | Sort order rank |
| `created_at` | `timestamptz` | `DEFAULT now() NOT NULL` | Creation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT now() NOT NULL` | Last update timestamp |

### 2.4 `public.track_now_plans`
Time-bound execution arcs or sub-goals nested beneath a Track.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Plan unique ID |
| `user_id` | `uuid` | `REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL` | Owner ID |
| `track_id` | `uuid` | `REFERENCES public.track_now_tracks(id) ON DELETE CASCADE NOT NULL` | Parent Track ID |
| `name` | `text` | `NOT NULL` | Plan name |
| `title` | `text` | `GENERATED ALWAYS AS (name) STORED` | Title alias |
| `description` | `text` | `NULL` | Detailed notes |
| `status` | `text` | `DEFAULT 'active' CHECK IN ('active', 'archived', 'completed')` | Lifecycle status |
| `start_date` | `date` | `NULL` | Target start date |
| `end_date` | `date` | `NULL` | Target end date |
| `position` | `integer` | `DEFAULT 0 NOT NULL` | Display ordering rank |
| `created_at` | `timestamptz` | `DEFAULT now() NOT NULL` | Creation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT now() NOT NULL` | Last update timestamp |

### 2.5 `public.track_now_execution_items`
Atomic actionable units attached to a Plan.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Item unique ID |
| `user_id` | `uuid` | `REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL` | Owner ID |
| `plan_id` | `uuid` | `REFERENCES public.track_now_plans(id) ON DELETE CASCADE NOT NULL` | Parent Plan ID |
| `track_id` | `uuid` | `REFERENCES public.track_now_tracks(id) ON DELETE CASCADE NULL` | Parent Track ID |
| `type` | `text` | `NOT NULL CHECK IN ('habit','task','checklist','milestone','project')` | Item category |
| `name` | `text` | `NOT NULL` | Item title |
| `title` | `text` | `GENERATED ALWAYS AS (name) STORED` | Title alias |
| `description` | `text` | `NULL` | Additional context |
| `status` | `text` | `DEFAULT 'todo' CHECK IN ('todo','in_progress','done','archived')` | Execution state |
| `priority` | `text` | `DEFAULT 'medium' CHECK IN ('low','medium','high','urgent')` | Priority rating |
| `due_date` | `date` | `NULL` | Target completion date |
| `target_count` | `integer` | `DEFAULT 1 NOT NULL` | Target repetitions |
| `current_count`| `integer` | `DEFAULT 0 NOT NULL` | Completed repetitions |
| `unit` | `text` | `NULL` | Metric unit (`reps`, `pages`, `$`) |
| `position` | `integer` | `DEFAULT 0 NOT NULL` | Ordering rank in plan |
| `created_at` | `timestamptz` | `DEFAULT now() NOT NULL` | Creation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT now() NOT NULL` | Last update timestamp |

### 2.6 `public.track_now_item_schedules`
Recurrence and time-of-day configuration for habits and recurring tasks.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Schedule ID |
| `item_id` | `uuid` | `REFERENCES public.track_now_execution_items(id) ON DELETE CASCADE NOT NULL` | Target item |
| `frequency` | `text` | `DEFAULT 'daily' CHECK IN ('daily','weekly','monthly','custom')` | Cadence |
| `days_of_week` | `integer[]`| `NULL` | 0=Sun, 1=Mon, ..., 6=Sat |
| `time_of_day` | `text` | `NULL CHECK IN ('morning','afternoon','evening','anytime')` | Routine block |
| `reminder_time`| `time` | `NULL` | Notification time |
| `created_at` | `timestamptz` | `DEFAULT now() NOT NULL` | Creation timestamp |

### 2.7 `public.track_now_item_completions`
Immutable audit log of every completion event (enabling streak tracking and historical analytics). Enforces one completion per item per calendar date at the database level.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Completion log ID |
| `item_id` | `uuid` | `REFERENCES public.track_now_execution_items(id) ON DELETE CASCADE NOT NULL` | Target item |
| `user_id` | `uuid` | `REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL` | User ID |
| `completed_date`| `date` | `DEFAULT CURRENT_DATE NOT NULL` | Local date of execution |
| `completed_at`| `timestamptz`| `DEFAULT now() NOT NULL` | Precise timestamp |
| `notes` | `text` | `NULL` | Optional log reflection |

**Unique Constraint / Index:**
- `uq_track_now_completions_item_date` ON `(item_id, completed_date)` guarantees idempotency and prevents duplicate completion records. The application service layer gracefully handles unique-constraint conflicts (PostgreSQL code `23505`).

---

## 3. Database Triggers & Automations

### 3.1 Automated Timestamp Updates
All mutable tables utilize a dedicated trigger function to update `updated_at`:
```sql
CREATE OR REPLACE FUNCTION public.handle_track_now_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
Bound to `track_now_profiles`, `track_now_tracks`, `track_now_plans`, and `track_now_execution_items`.

### 3.2 User Provisioning on Auth Signup
When a user registers via Supabase Auth, a corresponding row in `public.track_now_profiles` is inserted automatically without touching any external tables:
```sql
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
```

---

## 4. Row Level Security (RLS) Matrix

Every Track.now table enables Row Level Security with strict ownership verification:

| Table | Permitted Roles | Condition (`USING` / `WITH CHECK`) |
| :--- | :--- | :--- |
| `track_now_profiles` | `authenticated` | `auth.uid() = id` |
| `track_now_track_templates` | `anon, authenticated` | `true` (Public read-only catalog) |
| `track_now_tracks` | `authenticated` | `auth.uid() = user_id` |
| `track_now_plans` | `authenticated` | `auth.uid() = user_id` |
| `track_now_execution_items` | `authenticated` | `auth.uid() = user_id` |
| `track_now_item_schedules` | `authenticated` | `EXISTS (SELECT 1 FROM track_now_execution_items WHERE id = item_id AND user_id = auth.uid())` |
| `track_now_item_completions`| `authenticated` | `auth.uid() = user_id` |

---

## 5. Performance Indexes & Authoritative Migration

Authoritative initial migration file:
`supabase/migrations/20261005000000_init_track_now.sql`

```sql
CREATE INDEX idx_track_now_tracks_user_status ON public.track_now_tracks(user_id, status);
CREATE INDEX idx_track_now_plans_track_status ON public.track_now_plans(track_id, status);
CREATE INDEX idx_track_now_plans_user_status ON public.track_now_plans(user_id, status);
CREATE INDEX idx_track_now_items_plan_status ON public.track_now_execution_items(plan_id, status);
CREATE INDEX idx_track_now_items_user_due ON public.track_now_execution_items(user_id, due_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_track_now_completions_item_date ON public.track_now_item_completions(item_id, completed_date);
```

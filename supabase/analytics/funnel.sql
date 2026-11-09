-- ==============================================================================
-- TRACK.NOW: funnel, onboarding and error queries (READ-ONLY: SELECT only)
--
-- Paste one query at a time into the Supabase SQL editor (it runs as the owner, so RLS
-- does not hide other users' rows). Nothing here creates or changes anything; the only
-- write is the retention DELETE at the bottom, which is commented out.
--
-- Section (a) needs no client events: it works on any database, today.
-- Sections (b) and (c) need migration 20261110000000_client_events.sql and only cover
-- users who left "Share usage and error reports" on (the default) since that release.
-- Deleted accounts are gone from every query (their rows cascade away).
-- ==============================================================================

-- (a) Weekly signup cohorts: of the people who signed up in a week (Monday start, UTC),
--     what share created a first Plan, completed anything at all, and were still
--     completing things 7 or more days after signing up.
--     Cohorts younger than 7 days cannot have come back yet: read their last column as
--     "not known yet", not as zero. Un-completing an item deletes its completion row, so
--     these are slightly conservative.
WITH signups AS (
  SELECT id AS user_id,
         created_at,
         date_trunc('week', created_at)::date AS cohort_week
  FROM public.track_now_profiles
),
first_plan AS (
  SELECT user_id, min(created_at) AS first_plan_at
  FROM public.track_now_plans
  GROUP BY user_id
),
activity AS (
  SELECT user_id,
         min(completed_at) AS first_completion_at,
         max(completed_at) AS last_completion_at
  FROM public.track_now_item_completions
  GROUP BY user_id
)
SELECT s.cohort_week,
       count(*)                                                        AS signups,
       round(100.0 * count(fp.user_id) / count(*), 1)                  AS pct_created_plan,
       round(100.0 * count(a.user_id) / count(*), 1)                   AS pct_completed_anything,
       round(100.0 * count(*) FILTER (WHERE a.last_completion_at >= s.created_at + interval '7 days') / count(*), 1)
                                                                       AS pct_back_day_7_plus,
       round((avg(extract(epoch FROM fp.first_plan_at - s.created_at)) / 3600)::numeric, 1)
                                                                       AS avg_hours_to_first_plan
FROM signups s
LEFT JOIN first_plan fp USING (user_id)
LEFT JOIN activity a USING (user_id)
GROUP BY s.cohort_week
ORDER BY s.cohort_week DESC;

-- (b1) Tour: how many people opened it and how many reached the last screen, per week.
SELECT date_trunc('week', created_at)::date                              AS week,
       count(DISTINCT user_id) FILTER (WHERE name = 'tour_started')      AS users_started,
       count(DISTINCT user_id) FILTER (WHERE name = 'tour_finished')     AS users_finished,
       round(100.0 * count(DISTINCT user_id) FILTER (WHERE name = 'tour_finished')
             / nullif(count(DISTINCT user_id) FILTER (WHERE name = 'tour_started'), 0), 1) AS pct_finished
FROM public.track_now_client_events
WHERE kind = 'event' AND name IN ('tour_started', 'tour_finished')
GROUP BY 1
ORDER BY 1 DESC;

-- (b2) Quests: which getting-started quests people actually click.
SELECT props ->> 'quest'       AS quest,
       app,
       count(*)                AS clicks,
       count(DISTINCT user_id) AS users
FROM public.track_now_client_events
WHERE kind = 'event' AND name = 'quest_clicked'
GROUP BY 1, 2
ORDER BY clicks DESC;

-- (b3) Templates: which ready-made setups get used (start page, goal planner, library).
SELECT props ->> 'template'    AS template,
       app,
       count(*)                AS uses,
       count(DISTINCT user_id) AS users
FROM public.track_now_client_events
WHERE kind = 'event' AND name = 'template_used'
GROUP BY 1, 2
ORDER BY uses DESC;

-- (b4) Every event in the last 30 days, to see what else is being used.
SELECT name,
       app,
       count(*)                   AS events,
       count(DISTINCT user_id)    AS users,
       count(DISTINCT session_id) AS sessions
FROM public.track_now_client_events
WHERE kind = 'event' AND created_at >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY events DESC;

-- (c) Top errors in the last 7 days by error name and app version. The apps send each
--     distinct error at most 3 times per session, so rank by sessions/users, not reports.
SELECT name,
       app,
       app_version,
       count(*)                     AS reports,
       count(DISTINCT session_id)   AS sessions,
       count(DISTINCT user_id)      AS users,
       max(created_at)              AS last_seen,
       min(props ->> 'where')       AS sample_where,
       min(props ->> 'message')     AS sample_message
FROM public.track_now_client_events
WHERE kind = 'error' AND created_at >= now() - interval '7 days'
GROUP BY name, app, app_version
ORDER BY sessions DESC, reports DESC
LIMIT 50;

-- (c2) The stack traces behind one error from (c): put its name in the filter.
SELECT created_at, app, app_version, props ->> 'where' AS error_where, props ->> 'message' AS message, props ->> 'stack' AS stack
FROM public.track_now_client_events
WHERE kind = 'error' AND name = 'TypeError' AND created_at >= now() - interval '7 days'
ORDER BY created_at DESC
LIMIT 20;

-- (d) Retention. Nothing deletes old rows automatically. The table only needs recent
--     history (the cohort query above does not use it), so clear rows older than 90 days
--     now and then. This is the one statement here that changes data: remove the leading
--     dashes and run it on its own.
-- DELETE FROM public.track_now_client_events WHERE created_at < now() - interval '90 days';

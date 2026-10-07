/** Domain types mirroring supabase/migrations with track_now_* prefix. */

export type TrackStatus = 'active' | 'archived' | 'paused' | 'completed' | 'cancelled'
export type PlanStatus = 'active' | 'archived' | 'paused' | 'completed' | 'cancelled'
export type TemplateType = 'fitness' | 'finance' | 'career' | 'learning' | 'business' | 'custom'
export type ItemType = 'habit' | 'task' | 'checklist' | 'milestone' | 'project'
export type ItemStatus = 'todo' | 'in_progress' | 'done' | 'archived'
export type ItemPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Profile {
  id: string
  email?: string
  full_name?: string | null
  display_name: string | null
  avatar_url: string | null
  timezone?: string
  theme_preference?: 'system' | 'light' | 'dark'
  created_at: string
  updated_at: string
}

export interface TrackTemplate {
  id: string
  key?: TemplateType
  template_type: TemplateType
  name: string
  description: string
  icon: string
  color: string
  default_items?: Array<{ title: string; type: ItemType }>
  suggested_areas: string[]
}

export interface Track {
  id: string
  user_id: string
  name: string
  description: string | null
  template_type?: TemplateType
  template_key?: string | null
  icon: string
  color: string
  status: TrackStatus
  is_template?: boolean
  position?: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface Plan {
  id: string
  track_id: string
  user_id: string
  name: string
  title?: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: PlanStatus
  position?: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface ExecutionItem {
  id: string
  plan_id: string
  track_id?: string
  user_id: string
  type: ItemType
  name: string
  title?: string
  description: string | null
  status: ItemStatus
  priority: ItemPriority
  start_date: string | null
  due_date: string | null
  target_count?: number
  current_count?: number
  unit?: string | null
  position?: number
  metadata?: Record<string, unknown>
  schedule?: ItemSchedule | null
  created_at: string
  updated_at: string
}

/** Lightweight projection used for progress calculation and activity tracking. */
export interface ExecutionItemSummary {
  id: string
  plan_id: string
  track_id?: string
  type: ItemType
  title?: string
  name?: string
  status: ItemStatus
  updated_at: string
}

export interface ItemSchedule {
  id: string
  item_id: string
  user_id?: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  days_of_week: number[] | null
  time_of_day: string | null
  reminder_time?: string | null
  created_at: string
}

export interface ItemCompletion {
  id: string
  item_id: string
  user_id: string
  completed_date: string
  completed_at: string
  notes: string | null
}

export interface NewTrackInput {
  name: string
  description: string | null
  template_type?: TemplateType
  template_key?: string | null
  icon: string
  color: string
}

export interface NewPlanInput {
  track_id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
}

export interface NewItemScheduleInput {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  days_of_week?: number[] | null
  time_of_day?: 'morning' | 'afternoon' | 'evening' | 'anytime' | null
  reminder_time?: string | null
}

export interface NewExecutionItemInput {
  plan_id: string
  track_id?: string
  type: ItemType
  name: string
  description?: string | null
  priority?: ItemPriority
  due_date?: string | null
  start_date?: string | null
  status?: ItemStatus
  target_count?: number
  current_count?: number
  unit?: string | null
  schedule?: NewItemScheduleInput | null
}

export interface UpdateExecutionItemInput {
  name?: string
  description?: string | null
  type?: ItemType
  priority?: ItemPriority
  due_date?: string | null
  start_date?: string | null
  target_count?: number
  current_count?: number
  unit?: string | null
  schedule?: NewItemScheduleInput | null
}

export interface Progress {
  total: number
  done: number
  /** Whole number 0–100. 0 when there is nothing to complete (never faked). */
  percent: number
}

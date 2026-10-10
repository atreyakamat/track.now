/**
 * Native Home-Screen Widget Data Contract.
 * Strict Security Rules:
 * - NO Supabase keys, auth tokens, passwords, or sensitive account fields.
 * - Minimal, versioned, read-only projection for at-a-glance dashboard display.
 */

export interface WidgetItemSummary {
  id: string
  name: string
  title: string // Alias for Swift and Android JSON parsing
  type: string
  priority?: string
  time?: string | null // e.g. "07:30" or "Morning"
  isDone: boolean
  isOverdue: boolean
  overdue: boolean // Alias for Swift and Android JSON parsing
  planId: string
  planTitle?: string
  trackColor?: string
}

export interface WidgetTodayProgress {
  date: string // YYYY-MM-DD
  total: number
  totalItems: number
  done: number
  completedItems: number
  percent: number // 0-100
  activeStreakDays: number
  statusText: string // e.g. "3 of 7 done"
}

export interface WidgetDataPayload {
  version: 1
  userId: string
  updatedAt: string // ISO 8601
  lastUpdated: string // Alias for Swift and Android JSON parsing
  today: WidgetTodayProgress
  progress: WidgetTodayProgress // Alias for Swift and Android JSON parsing
  nextActivity: WidgetItemSummary | null
  upcomingItems: WidgetItemSummary[]
  items: WidgetItemSummary[] // Array of upcoming items for Android / iOS widgets
}

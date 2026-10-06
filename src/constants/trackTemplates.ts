import type { TemplateType, TrackTemplate } from '@/types/domain'

export interface TrackColorOption {
  key: string
  label: string
  value: string
}

export const TRACK_COLORS: TrackColorOption[] = [
  { key: 'lime', label: 'Lime', value: '#c8f169' },
  { key: 'lilac', label: 'Lilac', value: '#b9a7ff' },
  { key: 'peach', label: 'Peach', value: '#ffb98f' },
  { key: 'sky', label: 'Sky', value: '#9fd3ff' },
  { key: 'rose', label: 'Rose', value: '#ffa9c4' },
  { key: 'mint', label: 'Mint', value: '#9eeccd' },
]

export const TRACK_ICONS = [
  'Activity',
  'Wallet',
  'Briefcase',
  'BookOpen',
  'TrendingUp',
  'Target',
  'Zap',
  'Flame',
  'Compass',
  'Award',
  'Cpu',
  'Dumbbell',
] as const

export const DEFAULT_TRACK_TEMPLATES: Omit<TrackTemplate, 'id'>[] = [
  {
    template_type: 'fitness',
    name: 'Fitness',
    description: 'Physical health, routines, workouts, sleep, and nutrition.',
    icon: 'Activity',
    color: '#c8f169',
    suggested_areas: [
      'workouts',
      'steps',
      'running',
      'swimming',
      'sleep',
      'water',
      'nutrition',
      'routines',
    ],
  },
  {
    template_type: 'finance',
    name: 'Finance',
    description: 'Money management, savings goals, budgeting, and wealth building.',
    icon: 'Wallet',
    color: '#9fd3ff',
    suggested_areas: [
      'income',
      'expenses',
      'savings',
      'budgets',
      'financial goals',
      'spending habits',
    ],
  },
  {
    template_type: 'career',
    name: 'Career',
    description: 'Professional growth, skills development, interview prep, and career evidence.',
    icon: 'Briefcase',
    color: '#ffb98f',
    suggested_areas: [
      'job preparation',
      'applications',
      'interviews',
      'skills',
      'networking',
      'career goals',
      'evidence',
    ],
  },
  {
    template_type: 'learning',
    name: 'Learning & Productivity',
    description: 'Study sessions, focused work, skill acquisition, and intellectual sprints.',
    icon: 'BookOpen',
    color: '#b9a7ff',
    suggested_areas: [
      'learning topics',
      'study sessions',
      'projects',
      'notes',
      'revision',
      'focused work',
      'productivity routines',
    ],
  },
  {
    template_type: 'business',
    name: 'Business',
    description: 'Ventures, deliverables, sales, marketing, operations, and business execution.',
    icon: 'TrendingUp',
    color: '#ffa9c4',
    suggested_areas: [
      'business tasks',
      'projects',
      'sales',
      'marketing',
      'operations',
      'goals',
      'deliverables',
    ],
  },
]

export function getTemplateMeta(templateType: TemplateType) {
  return DEFAULT_TRACK_TEMPLATES.find((t) => t.template_type === templateType)
}

export const DAY_OPTIONS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' }
]

export const CATEGORY_OPTIONS = [
  {
    value: 'general',
    label: 'General',
    identity: 'Steady Builder',
    description: 'For routines that keep your day grounded.',
    accent: '#4c5f73',
    soft: '#edf2f7'
  },
  {
    value: 'fitness',
    label: 'Fitness',
    identity: 'Resilient Athlete',
    description: 'Movement, energy, and physical momentum.',
    accent: '#d97745',
    soft: '#fff1e8'
  },
  {
    value: 'mindfulness',
    label: 'Mindfulness',
    identity: 'Calm Mind',
    description: 'Breathing room, reflection, and presence.',
    accent: '#3f7d73',
    soft: '#e8f5f1'
  },
  {
    value: 'study',
    label: 'Learning',
    identity: 'Disciplined Learner',
    description: 'Study, reading, skill-building, and focus.',
    accent: '#4361a6',
    soft: '#eaf0ff'
  },
  {
    value: 'nutrition',
    label: 'Nutrition',
    identity: 'Intentional Nourisher',
    description: 'Fueling your body with better defaults.',
    accent: '#618534',
    soft: '#eef6e6'
  },
  {
    value: 'social',
    label: 'Relationships',
    identity: 'Present Friend',
    description: 'Family, friendships, and meaningful connection.',
    accent: '#9a5f80',
    soft: '#f9edf4'
  },
  {
    value: 'creativity',
    label: 'Creativity',
    identity: 'Curious Maker',
    description: 'Writing, art, music, and original work.',
    accent: '#8a5a2d',
    soft: '#f7eee6'
  },
  {
    value: 'finance',
    label: 'Finance',
    identity: 'Thoughtful Planner',
    description: 'Money habits that create long-term calm.',
    accent: '#2f6b6f',
    soft: '#e5f4f5'
  }
]

export const CATEGORY_META = Object.fromEntries(
  CATEGORY_OPTIONS.map((option) => [option.value, option])
)

export const DURATION_OPTIONS = [
  {
    value: 21,
    label: '21 days',
    description: 'A fast reset for one new routine.'
  },
  {
    value: 45,
    label: '45 days',
    description: 'Long enough to make the pattern stick.'
  },
  {
    value: 90,
    label: '90 days',
    description: 'A deeper mission for identity-level change.'
  }
]

export const DURATION_META = Object.fromEntries(
  DURATION_OPTIONS.map((option) => [option.value, option])
)

export const DIFFICULTY_OPTIONS = [
  {
    value: 'easy',
    label: 'Easy',
    description: 'Low friction and great for consistency.'
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Balanced challenge for most habits.'
  },
  {
    value: 'hard',
    label: 'Hard',
    description: 'Higher effort with more intention required.'
  }
]

export const DIFFICULTY_META = Object.fromEntries(
  DIFFICULTY_OPTIONS.map((option) => [option.value, option])
)

export const DEFAULT_HABIT_FORM = {
  name: '',
  emoji: '🌱',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  reminderTimes: ['08:00'],
  category: 'general',
  durationDays: 21,
  difficulty: 'medium'
}

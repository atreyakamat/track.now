export const TASK_CATEGORY_OPTIONS = [
  { value: 'general', label: 'General', color: '#4c5f73' },
  { value: 'work', label: 'Work', color: '#4361a6' },
  { value: 'personal', label: 'Personal', color: '#3f7d73' },
  { value: 'health', label: 'Health', color: '#618534' },
  { value: 'learning', label: 'Learning', color: '#8a5a2d' },
  { value: 'finance', label: 'Finance', color: '#2f6b6f' },
  { value: 'shopping', label: 'Shopping', color: '#d97745' },
  { value: 'family', label: 'Family', color: '#9a5f80' }
]

export const TASK_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#64748b' },
  { value: 'medium', label: 'Medium', color: '#245c68' },
  { value: 'high', label: 'High', color: '#b45309' },
  { value: 'urgent', label: 'Urgent', color: '#b91c1c' }
]

export const TASK_SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'voice', label: 'Voice' }
]

export const TASK_DEFAULTS = {
  title: '',
  notes: '',
  category: 'general',
  priority: 'medium',
  dueDate: '',
  dueTime: '',
  completed: false,
  source: 'manual'
}

export const TASK_CATEGORY_META = Object.fromEntries(
  TASK_CATEGORY_OPTIONS.map((item) => [item.value, item])
)

export const TASK_PRIORITY_META = Object.fromEntries(
  TASK_PRIORITY_OPTIONS.map((item) => [item.value, item])
)

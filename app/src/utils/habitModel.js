import {
  CATEGORY_META,
  DAY_OPTIONS,
  DIFFICULTY_META,
  DURATION_META
} from 'src/constants/habitMeta'

const DAY_INDEX = Object.fromEntries(DAY_OPTIONS.map((day, index) => [day.value, index]))
const DAY_KEY_BY_NATIVE_INDEX = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const CATEGORY_ALIASES = {
  learning: 'study',
  relationships: 'social'
}

export function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDateFromKey(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function shiftDate(value, amount) {
  const date = typeof value === 'string' ? getDateFromKey(value) : new Date(value)
  date.setDate(date.getDate() + amount)
  return date
}

export function getDayKey(date = new Date()) {
  return DAY_KEY_BY_NATIVE_INDEX[date.getDay()]
}

export function sortDays(days = []) {
  return [...new Set(days)]
    .filter((day) => day in DAY_INDEX)
    .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])
}

export function formatTimeLabel(time) {
  if (!TIME_PATTERN.test(time || '')) {
    return 'Anytime'
  }

  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function normalizeReminderTimes(reminderTimes = [], fallbackTime = '09:00') {
  const initialTimes = Array.isArray(reminderTimes) && reminderTimes.length > 0
    ? reminderTimes
    : [fallbackTime]

  const normalized = [...new Set(initialTimes.filter((time) => TIME_PATTERN.test(time || '')))].sort()

  return normalized.length > 0 ? normalized : ['09:00']
}

export function getReminderSummary(habit) {
  const reminderTimes = normalizeReminderTimes(habit.reminderTimes, habit.time)

  if (reminderTimes.length === 1) {
    return formatTimeLabel(reminderTimes[0])
  }

  return `${formatTimeLabel(reminderTimes[0])} +${reminderTimes.length - 1} more`
}

export function getReminderListLabel(habit) {
  return normalizeReminderTimes(habit.reminderTimes, habit.time)
    .map((time) => formatTimeLabel(time))
    .join(', ')
}

export function getCategoryMeta(category = 'general') {
  return CATEGORY_META[CATEGORY_ALIASES[category] || category] || CATEGORY_META.general
}

export function getDifficultyMeta(difficulty = 'medium') {
  return DIFFICULTY_META[difficulty] || DIFFICULTY_META.medium
}

export function getDurationMeta(durationDays = 21) {
  return DURATION_META[Number(durationDays)] || DURATION_META[21]
}

export function getGraceLimit(durationDays = 21) {
  const days = Number(durationDays) || 21

  if (days >= 90) return 4
  if (days >= 45) return 2
  return 1
}

export function normalizeHabit(habit = {}) {
  const category = getCategoryMeta(habit.category).value
  const durationDays = getDurationMeta(habit.durationDays).value
  const difficulty = getDifficultyMeta(habit.difficulty).value
  const reminderTimes = normalizeReminderTimes(habit.reminderTimes, habit.time)

  return {
    ...habit,
    category,
    difficulty,
    durationDays,
    days: sortDays(habit.days || []),
    graceLimit: Number.isFinite(Number(habit.graceLimit))
      ? Number(habit.graceLimit)
      : getGraceLimit(durationDays),
    reminderTimes,
    time: reminderTimes[0]
  }
}

export function isHabitScheduledForDate(habit, date = new Date()) {
  const normalizedHabit = normalizeHabit(habit)
  return normalizedHabit.days.includes(getDayKey(date))
}

export function getCompletionDatesForHabit(habitId, completions = []) {
  return [...new Set(
    completions
      .filter((completion) => completion.habitId === habitId && completion.completed !== false)
      .map((completion) => completion.date)
  )]
}

export function getMissionProgress(habit, completions = []) {
  const normalizedHabit = normalizeHabit(habit)
  const completionDates = getCompletionDatesForHabit(normalizedHabit.id, completions)
  const completedSessions = completionDates.length
  const missionDone = completedSessions >= normalizedHabit.durationDays
  const displayDay = missionDone
    ? normalizedHabit.durationDays
    : Math.min(completedSessions + 1, normalizedHabit.durationDays)

  return {
    completedSessions,
    completionDates,
    displayDay,
    durationDays: normalizedHabit.durationDays,
    remainingSessions: Math.max(normalizedHabit.durationDays - completedSessions, 0),
    progress: Math.min(completedSessions / normalizedHabit.durationDays, 1),
    missionDone
  }
}

export function getCompletionMap(completions = []) {
  const map = new Set()

  completions.forEach((completion) => {
    if (completion.completed === false) return
    map.add(`${completion.habitId}:${completion.date}`)
  })

  return map
}

export function calculateMomentum(habits = [], completions = [], windowDays = 7) {
  const normalizedHabits = habits.map((habit) => normalizeHabit(habit))
  const completionMap = getCompletionMap(completions)
  let scheduledCount = 0
  let completedCount = 0

  for (let offset = 0; offset < windowDays; offset++) {
    const targetDate = shiftDate(new Date(), -offset)
    const dateKey = getDateKey(targetDate)

    normalizedHabits.forEach((habit) => {
      if (!isHabitScheduledForDate(habit, targetDate)) return
      scheduledCount++

      if (completionMap.has(`${habit.id}:${dateKey}`)) {
        completedCount++
      }
    })
  }

  return {
    completedCount,
    scheduledCount,
    percentage: scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0
  }
}

export function buildIdentityInsight(habits = [], completions = [], windowDays = 7) {
  const normalizedHabits = habits.map((habit) => normalizeHabit(habit))
  const completionMap = getCompletionMap(completions)
  const categorySummary = new Map()

  normalizedHabits.forEach((habit) => {
    if (!categorySummary.has(habit.category)) {
      categorySummary.set(habit.category, {
        category: habit.category,
        scheduledCount: 0,
        completedCount: 0,
        habitCount: 0
      })
    }

    categorySummary.get(habit.category).habitCount++
  })

  for (let offset = 0; offset < windowDays; offset++) {
    const targetDate = shiftDate(new Date(), -offset)
    const dateKey = getDateKey(targetDate)

    normalizedHabits.forEach((habit) => {
      if (!isHabitScheduledForDate(habit, targetDate)) return

      const summary = categorySummary.get(habit.category)
      summary.scheduledCount++

      if (completionMap.has(`${habit.id}:${dateKey}`)) {
        summary.completedCount++
      }
    })
  }

  const ranked = [...categorySummary.values()]
    .map((summary) => ({
      ...summary,
      meta: getCategoryMeta(summary.category),
      score: summary.scheduledCount > 0
        ? Math.round((summary.completedCount / summary.scheduledCount) * 100)
        : 0
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount
      return b.habitCount - a.habitCount
    })

  return ranked[0] || null
}

export function getTodayHeadline(totalHabits, pendingCount, allDone) {
  if (totalHabits === 0) {
    return 'Build your first mission'
  }

  if (allDone) {
    return 'Everything important for today is done'
  }

  if (pendingCount === 1) {
    return 'One meaningful action is still open'
  }

  return `${pendingCount} actions are still shaping today`
}

export function formatDayList(days = []) {
  const labels = sortDays(days)
    .map((day) => DAY_OPTIONS.find((option) => option.value === day)?.label)
    .filter(Boolean)

  if (labels.length === 0) return 'No days selected'
  if (labels.length === 7) return 'Every day'
  if (labels.length === 5 && !labels.includes('Sat') && !labels.includes('Sun')) return 'Weekdays'

  return labels.join(', ')
}

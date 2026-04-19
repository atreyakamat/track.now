<template>
  <q-page class="planner-view-page">
    <div class="grain-overlay" />

    <div class="planner-shell">
      <header class="planner-top" data-reveal>
        <div class="brand-wrap">
          <q-icon name="radio_button_checked" size="18px" />
          <h1>Track.now</h1>
        </div>
        <div class="profile-chip">{{ avatarInitial }}</div>
      </header>

      <q-inner-loading :showing="loading">
        <q-spinner color="white" size="56px" />
      </q-inner-loading>

      <main v-if="!loading" class="planner-main">
        <section data-reveal>
          <div class="week-strip hide-scrollbar">
            <button
              v-for="day in weeklyDays"
              :key="day.key"
              type="button"
              class="day-pill"
              :class="{
                active: selectedDayKey === day.key,
                quiet: selectedDayKey !== day.key && (dayStatsMap[day.key]?.total || 0) === 0
              }"
              @click="selectedDayKey = day.key"
            >
              <span>{{ day.short }}</span>
              <strong>{{ day.dayNumber }}</strong>
            </button>
          </div>
        </section>

        <section class="horizon-card pro-card" data-reveal>
          <div class="horizon-content">
            <div class="horizon-head">
              <div>
                <h2>Horizon View</h2>
                <p>{{ selectedDateLabel }}</p>
              </div>
              <div class="load-dot" :class="{ danger: isHeavyDay }" />
            </div>

            <div class="stress-wrap">
              <div class="stress-labels">
                <span>Stress load</span>
                <span>{{ stressLoad }}%</span>
              </div>
              <div class="stress-track">
                <div class="stress-fill" :style="{ width: `${stressLoad}%` }" />
              </div>
              <p class="stress-note">{{ stressMessage }}</p>
            </div>
          </div>
          <div class="horizon-glow" />
        </section>

        <section class="schedule-section" data-reveal>
          <div v-for="period in periods" :key="period.key" class="period-block">
            <h3>{{ period.label }}</h3>

            <div v-if="groupedEntries[period.key].length === 0" class="period-empty">
              No scheduled items.
            </div>

            <transition-group v-else name="timeline" tag="div" class="period-list">
              <div
                v-for="entry in groupedEntries[period.key]"
                :key="entry.id"
                class="timeline-row"
                :class="{ done: entry.completed }"
              >
                <span class="timeline-time">{{ entry.timeLabel }}</span>

                <button type="button" class="timeline-card pro-card" @click="openEntry(entry)">
                  <div class="timeline-head">
                    <div>
                      <h4 :class="{ strike: entry.completed }">{{ entry.title }}</h4>
                      <p>{{ entry.subtitle }}</p>
                    </div>

                    <div class="timeline-icons">
                      <span v-if="entry.isCritical" class="alert-dot" />
                      <q-icon
                        :name="entry.entityType === 'habit' ? 'repeat' : 'assignment'"
                        size="18px"
                        color="grey-5"
                      />
                    </div>
                  </div>
                </button>
              </div>
            </transition-group>
          </div>
        </section>

        <section v-if="allEntries.length === 0" class="planner-empty-board" data-reveal>
          <h3>Quiet horizon</h3>
          <p>No habits or tasks are scheduled for this day yet.</p>
          <q-btn unelevated no-caps icon="add" label="Add mission" to="/add" class="add-btn" />
        </section>
      </main>
    </div>
  </q-page>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import { useTasksStore } from 'src/stores/tasks'
import {
  formatTimeLabel,
  getCategoryMeta,
  getDateFromKey,
  getDateKey,
  isHabitCompleteOnDate,
  isHabitScheduledForDate,
  shiftDate
} from 'src/utils/habitModel'
import { TASK_PRIORITY_META, TASK_PRIORITY_OPTIONS } from 'src/constants/taskMeta'
import { toDisplayTime } from 'src/utils/taskModel'

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const PERIOD_ORDER = { morning: 0, afternoon: 1, evening: 2 }

const periods = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' }
]

const router = useRouter()
const authStore = useAuthStore()
const habitsStore = useHabitsStore()
const tasksStore = useTasksStore()
const completionsStore = useCompletionsStore()

let revealObserver = null

const loading = computed(() => habitsStore.loading || tasksStore.loading || completionsStore.loading)

const avatarInitial = computed(() => {
  const seed = String(authStore.displayName || authStore.user?.email || 'T').trim()
  return (seed[0] || 'T').toUpperCase()
})

const todayKey = computed(() => getDateKey())
const selectedDayKey = ref(todayKey.value)

const weeklyDays = computed(() => {
  const now = new Date()
  const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay()
  const weekStart = shiftDate(now, mondayOffset)

  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(weekStart, index)
    const key = getDateKey(date)
    return {
      key,
      short: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: String(date.getDate()),
      date
    }
  })
})

watch(weeklyDays, (days) => {
  if (days.some((day) => day.key === selectedDayKey.value)) return

  const today = days.find((day) => day.key === todayKey.value)
  selectedDayKey.value = today?.key || days[0]?.key || todayKey.value
}, { immediate: true })

const selectedDate = computed(() => getDateFromKey(selectedDayKey.value))
const selectedDateLabel = computed(() => {
  return selectedDate.value.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
})

const habitsForSelectedDay = computed(() => {
  return habitsStore.habits
    .filter((habit) => isHabitScheduledForDate(habit, selectedDate.value))
    .map((habit) => {
      const time = Array.isArray(habit.reminderTimes) && habit.reminderTimes.length > 0
        ? habit.reminderTimes[0]
        : habit.time

      return {
        id: `habit-${habit.id}`,
        entityType: 'habit',
        entityId: habit.id,
        title: habit.name,
        subtitle: `${getCategoryMeta(habit.category).label} mission`,
        time: TIME_PATTERN.test(time || '') ? time : '',
        timeLabel: formatTimeLabel(time),
        period: getPeriodFromTime(time),
        completed: isHabitCompleteOnDate(habit, completionsStore.completions, selectedDayKey.value),
        isCritical: false
      }
    })
})

const tasksForSelectedDay = computed(() => {
  return tasksStore.tasks
    .filter((task) => task.dueDate === selectedDayKey.value)
    .map((task) => {
      const priorityMeta = TASK_PRIORITY_META[task.priority] || TASK_PRIORITY_OPTIONS[1]
      const dueTime = TIME_PATTERN.test(task.dueTime || '') ? task.dueTime : ''

      return {
        id: `task-${task.id}`,
        entityType: 'task',
        entityId: task.id,
        title: task.title,
        subtitle: task.notes || `${priorityMeta.label} priority task`,
        time: dueTime,
        timeLabel: dueTime ? toDisplayTime(dueTime) : 'Anytime',
        period: getPeriodFromTime(dueTime),
        completed: task.completed,
        isCritical: !task.completed && ['high', 'urgent'].includes(task.priority)
      }
    })
})

const allEntries = computed(() => {
  return [...habitsForSelectedDay.value, ...tasksForSelectedDay.value]
    .sort((a, b) => {
      const periodDiff = PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period]
      if (periodDiff !== 0) return periodDiff

      const timeDiff = getTimeSortValue(a.time) - getTimeSortValue(b.time)
      if (timeDiff !== 0) return timeDiff

      return a.title.localeCompare(b.title)
    })
})

const groupedEntries = computed(() => {
  const groups = {
    morning: [],
    afternoon: [],
    evening: []
  }

  allEntries.value.forEach((entry) => {
    groups[entry.period].push(entry)
  })

  return groups
})

const dayStatsMap = computed(() => {
  const summary = {}

  weeklyDays.value.forEach((day) => {
    const dayHabits = habitsStore.habits.filter((habit) => isHabitScheduledForDate(habit, day.date))
    const dayTasks = tasksStore.tasks.filter((task) => task.dueDate === day.key)

    const completedHabits = dayHabits.filter((habit) => {
      return isHabitCompleteOnDate(habit, completionsStore.completions, day.key)
    }).length
    const completedTasks = dayTasks.filter((task) => task.completed).length

    summary[day.key] = {
      total: dayHabits.length + dayTasks.length,
      completed: completedHabits + completedTasks
    }
  })

  return summary
})

const stressLoad = computed(() => {
  if (allEntries.value.length === 0) return 0

  const openEntries = allEntries.value.filter((entry) => !entry.completed).length
  const completedEntries = allEntries.value.length - openEntries
  const criticalTasks = tasksForSelectedDay.value.filter((task) => task.isCritical).length

  const rawScore = (openEntries * 18) + (criticalTasks * 10) + (habitsForSelectedDay.value.length * 4) - (completedEntries * 6)
  return Math.max(8, Math.min(100, Math.round(rawScore)))
})

const isHeavyDay = computed(() => stressLoad.value >= 75)

const stressMessage = computed(() => {
  if (allEntries.value.length === 0) {
    return 'This day is clear. You can schedule deep work blocks.'
  }

  if (stressLoad.value >= 75) {
    return 'This day looks heavy. Prioritize deep work.'
  }

  if (stressLoad.value >= 50) {
    return 'Moderate load. Protect one focus block.'
  }

  return 'Load is balanced. Keep momentum steady.'
})

onMounted(async () => {
  await completionsStore.fetchLast90Days()
  await nextTick()
  initRevealObserver()
})

onUnmounted(() => {
  if (revealObserver) {
    revealObserver.disconnect()
    revealObserver = null
  }
})

function openEntry(entry) {
  if (entry.entityType === 'habit') {
    router.push(`/habit/${entry.entityId}`)
    return
  }

  router.push('/tasks')
}

function getPeriodFromTime(value) {
  if (!TIME_PATTERN.test(value || '')) return 'afternoon'

  const [hours] = value.split(':').map(Number)
  if (hours < 12) return 'morning'
  if (hours < 17) return 'afternoon'
  return 'evening'
}

function getTimeSortValue(value) {
  if (!TIME_PATTERN.test(value || '')) return 9999
  const [hours, minutes] = value.split(':').map(Number)
  return (hours * 60) + minutes
}

function initRevealObserver() {
  const targets = Array.from(document.querySelectorAll('.planner-view-page [data-reveal]'))
  if (!targets.length) return

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    targets.forEach((target) => target.classList.add('is-visible'))
    return
  }

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      revealObserver?.unobserve(entry.target)
    })
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -10% 0px'
  })

  targets.forEach((target, index) => {
    target.classList.add('reveal-target')
    target.style.transitionDelay = `${Math.min((index % 6) * 70, 280)}ms`
    revealObserver?.observe(target)
  })
}
</script>

<style scoped lang="scss">
.planner-view-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #e5e2e1;
  padding-bottom: 118px;
  overflow: hidden;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
}

.planner-shell {
  position: relative;
  z-index: 1;
  width: min(980px, calc(100% - 28px));
  margin: 0 auto;
  padding-top: 18px;
}

.planner-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;

  h1 {
    margin: 0;
    font-size: 1.08rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.05em;
    color: #fff;
  }
}

.profile-chip {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: grid;
  place-items: center;
  background: #2a2a2a;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.planner-main {
  display: grid;
  gap: 32px;
}

.week-strip {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.day-pill {
  border: 0;
  background: #1b1b1c;
  color: #b6b6bc;
  border-radius: 999px;
  width: 56px;
  height: 96px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s ease, color 0.2s ease;

  span {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.8;
  }

  strong {
    font-size: 1.24rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  &:active {
    transform: scale(0.97);
  }
}

.day-pill.active {
  background: #fff;
  color: #000;
}

.day-pill.quiet {
  color: #6f6f74;
}

.horizon-card {
  position: relative;
  border-radius: 18px;
  background: #1b1b1c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px;
  overflow: hidden;
}

.horizon-content {
  position: relative;
  z-index: 1;
}

.horizon-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;

  h2 {
    margin: 0;
    font-size: 1.75rem;
    letter-spacing: -0.02em;
    color: #fff;
  }

  p {
    margin: 4px 0 0;
    color: #7f7f84;
    font-size: 0.88rem;
  }
}

.load-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
}

.load-dot.danger {
  background: #ff3b30;
}

.stress-wrap {
  display: grid;
  gap: 8px;
}

.stress-labels {
  display: flex;
  justify-content: space-between;

  span {
    font-size: 0.66rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #9f9fa5;
    font-weight: 700;
  }
}

.stress-track {
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: #353535;
}

.stress-fill {
  height: 100%;
  background: #fff;
  transition: width 0.3s ease;
}

.stress-note {
  margin: 0;
  color: #f3f3f3;
  opacity: 0.9;
  font-size: 0.92rem;
  font-style: italic;
}

.horizon-glow {
  position: absolute;
  top: -44px;
  right: -54px;
  width: 200px;
  height: 200px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  filter: blur(34px);
}

.schedule-section {
  display: grid;
  gap: 28px;
}

.period-block h3 {
  margin: 0 0 10px;
  color: #67676d;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-weight: 900;
}

.period-list {
  display: grid;
  gap: 10px;
}

.period-empty {
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  color: #75757a;
  padding: 12px;
  font-size: 0.82rem;
}

.timeline-row {
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 12px;
  align-items: start;
}

.timeline-time {
  padding-top: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  font-size: 0.74rem;
  color: #7b7b80;
  text-align: right;
}

.timeline-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: #1b1b1c;
  color: inherit;
  padding: 13px 14px;
  text-align: left;
  cursor: pointer;
}

.timeline-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;

  h4 {
    margin: 0;
    color: #fff;
    font-size: 0.95rem;
    letter-spacing: -0.01em;
  }

  p {
    margin: 3px 0 0;
    color: #7f7f85;
    font-size: 0.72rem;
  }
}

.timeline-icons {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.alert-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #ff3b30;
  box-shadow: 0 0 8px rgba(255, 59, 48, 0.9);
}

.timeline-row.done {
  opacity: 0.55;
}

.strike {
  text-decoration: line-through;
}

.planner-empty-board {
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  padding: 22px;
  text-align: center;

  h3 {
    margin: 0;
    font-size: 1.2rem;
    color: #fff;
  }

  p {
    margin: 8px 0 16px;
    color: #8e8e94;
  }
}

.add-btn {
  border-radius: 999px;
  background: #fff !important;
  color: #000 !important;
}

.pro-card {
  transition: transform 0.22s ease, box-shadow 0.22s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.35);
  }
}

.reveal-target {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.reveal-target.is-visible {
  opacity: 1;
  transform: none;
}

.timeline-enter-active,
.timeline-leave-active {
  transition: all 0.28s ease;
}

.timeline-enter-from,
.timeline-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 760px) {
  .planner-shell {
    width: calc(100% - 20px);
  }

  .timeline-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .timeline-time {
    text-align: left;
    padding-top: 0;
    padding-left: 4px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-target,
  .reveal-target.is-visible,
  .pro-card,
  .pro-card:hover {
    transition: none;
    transform: none;
  }
}
</style>

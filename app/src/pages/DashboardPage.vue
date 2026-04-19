<template>
  <q-page class="mission-dashboard-page">
    <div class="grain-overlay" />

    <div class="dashboard-shell">
      <header class="dashboard-top">
        <div class="brand-wrap">
          <q-icon name="radio_button_checked" size="18px" />
          <span>Track.now</span>
        </div>
        <q-btn no-caps unelevated class="today-btn" icon="today" label="Open Today" to="/today" />
      </header>

      <q-inner-loading :showing="loading">
        <q-spinner color="white" size="50px" />
      </q-inner-loading>

      <main v-if="!loading" class="dashboard-main">
        <section class="hero-card pro-card">
          <div class="hero-copy">
            <p class="hero-kicker">Dashboard</p>
            <h1>{{ identityInsight ? identityInsight.meta.identity : 'Your next identity is waiting' }}</h1>
            <p>
              {{ identityInsight
                ? `${identityInsight.meta.label} is leading your week with ${identityInsight.score}% consistency.`
                : 'Once you complete a few scheduled habits, the strongest identity signal will appear here.' }}
            </p>
          </div>
          <div class="hero-plan">
            <span>Current plan</span>
            <strong>{{ currentPlan }}</strong>
          </div>
        </section>

        <section class="summary-grid">
          <article class="summary-card pro-card">
            <span>Momentum</span>
            <strong>{{ momentum.percentage }}%</strong>
            <small>{{ momentum.completedCount }}/{{ momentum.scheduledCount }} sessions in 7 days</small>
          </article>

          <article class="summary-card pro-card">
            <span>Today Complete</span>
            <strong>{{ completedToday }}/{{ todayHabits.length }}</strong>
            <small>Clear measure of what is left right now</small>
          </article>

          <article class="summary-card pro-card">
            <span>Active Missions</span>
            <strong>{{ habits.length }}</strong>
            <small>Finite missions with explicit finish lines</small>
          </article>

          <article class="summary-card pro-card">
            <span>Finishing Soon</span>
            <strong>{{ nearFinish.length }}</strong>
            <small>Missions with fewer than seven days left</small>
          </article>

          <article class="summary-card pro-card">
            <span>Open Tasks</span>
            <strong>{{ openTasksCount }}</strong>
            <small>{{ todayTasksCount }} due today in task manager</small>
          </article>
        </section>

        <section class="board-grid">
          <div class="left-column">
            <article class="content-card pro-card">
              <div class="section-head">
                <div>
                  <h2>Today Focus</h2>
                  <p>Ordered by time so the next action stays obvious.</p>
                </div>
                <q-btn flat no-caps label="Planner" icon="event" class="link-btn" to="/planner" />
              </div>

              <div v-if="todayFocus.length === 0" class="empty-copy">
                No habits scheduled today yet. Add a mission and your focus list will appear here.
              </div>

              <div v-else class="column q-gutter-sm">
                <button
                  v-for="item in todayFocus"
                  :key="item.id"
                  type="button"
                  class="focus-row"
                  @click="router.push(`/habit/${item.id}`)"
                >
                  <div class="focus-emoji" :style="{ background: item.categoryMeta.soft, color: item.categoryMeta.accent }">
                    {{ item.emoji }}
                  </div>
                  <div class="col text-left">
                    <div class="text-body1 text-weight-bold">{{ item.name }}</div>
                    <div class="focus-meta">{{ item.reminderSummary }} - {{ item.categoryMeta.identity }}</div>
                  </div>
                  <div class="focus-progress">
                    <div>{{ item.missionProgress.completedSessions }}/{{ item.missionProgress.durationDays }}</div>
                    <small>{{ item.completed ? 'Done today' : 'Pending' }}</small>
                  </div>
                </button>
              </div>
            </article>

            <article class="content-card pro-card">
              <div class="section-head compact">
                <h2>Category Pulse</h2>
              </div>

              <div v-if="categoryBreakdown.length === 0" class="empty-copy">
                Category insights will appear after you track a few habits.
              </div>

              <div v-else class="column q-gutter-md">
                <div v-for="category in categoryBreakdown" :key="category.category">
                  <div class="row items-center q-mb-xs">
                    <div class="pulse-label">{{ category.meta.label }}</div>
                    <q-space />
                    <div class="pulse-label">{{ category.score }}%</div>
                  </div>
                  <q-linear-progress
                    :value="category.score / 100"
                    rounded
                    size="9px"
                    :color="category.meta.accent"
                    track-color="grey-9"
                  />
                </div>
              </div>
            </article>
          </div>

          <div class="right-column">
            <article class="content-card pro-card">
              <div class="section-head">
                <div>
                  <h2>Today Task Queue</h2>
                  <p>Voice or manual tasks that need action now.</p>
                </div>
                <q-btn flat no-caps icon="task_alt" label="Open tasks" class="link-btn" to="/tasks" />
              </div>

              <div v-if="todayTaskPreview.length === 0" class="empty-copy">
                No tasks due today. Add one from the task page or voice capture.
              </div>

              <div v-else class="column q-gutter-sm">
                <div v-for="task in todayTaskPreview" :key="task.id" class="tile-row">
                  <div class="row items-center">
                    <div class="col">
                      <div class="text-body2 text-weight-bold text-white">{{ task.title }}</div>
                      <div class="tile-meta">{{ task.dueTime ? `Due at ${task.displayTime}` : 'Due today' }}</div>
                    </div>
                    <div class="col-auto">
                      <q-chip dense square :style="{ background: task.priorityColor + '22', color: task.priorityColor }">
                        {{ task.priorityLabel }}
                      </q-chip>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article class="content-card pro-card">
              <div class="section-head compact">
                <h2>Closing Soon</h2>
              </div>

              <div v-if="nearFinish.length === 0" class="empty-copy">
                Your mission queue is healthy. Nothing is near the finish line yet.
              </div>

              <div v-else class="column q-gutter-md">
                <div v-for="habit in nearFinish" :key="habit.id" class="tile-row">
                  <div class="row items-center q-mb-sm">
                    <div class="text-h6 q-mr-sm">{{ habit.emoji }}</div>
                    <div class="col">
                      <div class="text-body2 text-weight-bold text-white">{{ habit.name }}</div>
                      <div class="tile-meta">{{ habit.remainingSessions }} days left</div>
                    </div>
                  </div>
                  <q-linear-progress :value="habit.progress" rounded size="8px" :color="habit.categoryMeta.accent" track-color="grey-9" />
                </div>
              </div>
            </article>

            <article class="content-card pro-card">
              <div class="section-head compact">
                <h2>Accountability</h2>
              </div>
              <div class="column q-gutter-sm">
                <q-btn outline no-caps align="left" icon="people" color="grey-5" label="Friends" to="/friends" />
                <q-btn outline no-caps align="left" icon="group" color="grey-5" label="Groups" to="/groups" />
                <q-btn outline no-caps align="left" icon="family_restroom" color="grey-5" label="Family Plan" to="/family" />
              </div>
              <p class="accountability-note">
                Social surfaces stay optional so the core product remains quiet and focused.
              </p>
            </article>
          </div>
        </section>
      </main>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import { useTasksStore } from 'src/stores/tasks'
import { TASK_PRIORITY_META } from 'src/constants/taskMeta'
import { toDisplayTime } from 'src/utils/taskModel'
import {
  buildCategoryBreakdown,
  buildIdentityInsight,
  calculateMomentum,
  getCategoryMeta,
  isHabitCompleteOnDate,
  getMissionProgress,
  getReminderSummary
} from 'src/utils/habitModel'

const router = useRouter()
const authStore = useAuthStore()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()
const tasksStore = useTasksStore()
const loading = ref(true)

const habits = computed(() => habitsStore.habits)
const todayHabits = computed(() => habitsStore.todayHabits)
const completedToday = computed(() => {
  return todayHabits.value.filter((habit) => isHabitCompleteOnDate(habit, completionsStore.completions)).length
})
const currentPlan = computed(() => authStore.currentPlan)
const openTasksCount = computed(() => tasksStore.openTasks.length)
const todayTasksCount = computed(() => tasksStore.todayTasks.length)
const todayTaskPreview = computed(() => tasksStore.todayTasks.slice(0, 4).map((task) => ({
  ...task,
  displayTime: toDisplayTime(task.dueTime),
  priorityLabel: TASK_PRIORITY_META[task.priority]?.label || 'Medium',
  priorityColor: TASK_PRIORITY_META[task.priority]?.color || '#245c68'
})))

const momentum = computed(() => calculateMomentum(habits.value, completionsStore.completions))
const identityInsight = computed(() => buildIdentityInsight(habits.value, completionsStore.completions))
const categoryBreakdown = computed(() => buildCategoryBreakdown(habits.value, completionsStore.completions, 14).slice(0, 4))

const todayFocus = computed(() => todayHabits.value.map((habit) => {
  const missionProgress = getMissionProgress(habit, completionsStore.completions)
  return {
    ...habit,
    completed: isHabitCompleteOnDate(habit, completionsStore.completions),
    missionProgress,
    reminderSummary: getReminderSummary(habit),
    categoryMeta: getCategoryMeta(habit.category)
  }
}))

const nearFinish = computed(() => habits.value
  .map((habit) => {
    const missionProgress = getMissionProgress(habit, completionsStore.completions)
    return {
      ...habit,
      ...missionProgress,
      categoryMeta: getCategoryMeta(habit.category)
    }
  })
  .filter((habit) => !habit.missionDone && habit.remainingSessions <= 7)
  .sort((a, b) => a.remainingSessions - b.remainingSessions)
  .slice(0, 4))

onMounted(async () => {
  await Promise.all([
    authStore.loadProfile(),
    completionsStore.fetchLast90Days()
  ])
  loading.value = false
})
</script>

<style scoped lang="scss">
.mission-dashboard-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #e5e2e1;
  padding-bottom: 118px;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
}

.dashboard-shell {
  position: relative;
  z-index: 1;
  max-width: 1100px;
  margin: 0 auto;
  padding: clamp(16px, 2vw, 28px);
}

.dashboard-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.today-btn {
  border-radius: 12px;
  background: #fff;
  color: #000;
  font-weight: 700;
}

.dashboard-main {
  display: grid;
  gap: 14px;
}

.hero-card {
  padding: 18px;
  border-radius: 20px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14px;
  align-items: center;
}

.hero-kicker {
  margin: 0;
  color: #8f8f95;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.hero-copy h1 {
  margin: 8px 0 0;
  color: #fff;
  font-size: clamp(1.4rem, 3.4vw, 2rem);
  font-weight: 900;
  letter-spacing: -0.03em;
}

.hero-copy p {
  margin: 8px 0 0;
  color: #a8a8ad;
  line-height: 1.45;
  font-size: 0.9rem;
}

.hero-plan {
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.03);
  border-radius: 14px;
  padding: 10px 12px;
  min-width: 130px;
}

.hero-plan span {
  display: block;
  color: #8f8f95;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.hero-plan strong {
  display: block;
  margin-top: 4px;
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  text-transform: uppercase;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.summary-card {
  padding: 12px;
  border-radius: 16px;
  display: grid;
  gap: 6px;
}

.summary-card span {
  color: #8f8f95;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
}

.summary-card strong {
  color: #fff;
  font-size: 1.3rem;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.summary-card small {
  color: #9f9fa5;
  font-size: 0.76rem;
  line-height: 1.35;
}

.board-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 12px;
}

.left-column,
.right-column {
  display: grid;
  gap: 12px;
}

.content-card {
  border-radius: 18px;
  padding: 14px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.section-head.compact {
  margin-bottom: 10px;
}

.section-head h2 {
  margin: 0;
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.section-head p {
  margin: 4px 0 0;
  color: #98989e;
  font-size: 0.8rem;
}

.link-btn {
  color: #c4c4c9;
}

.empty-copy {
  color: #9999a0;
  font-size: 0.84rem;
}

.focus-row {
  width: 100%;
  display: grid;
  grid-template-columns: 52px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 11px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(22, 22, 22, 0.95);
  color: #fff;
}

.focus-emoji {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.focus-meta {
  margin-top: 1px;
  color: #98989e;
  font-size: 0.74rem;
}

.focus-progress {
  text-align: right;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.focus-progress small {
  display: block;
  margin-top: 1px;
  color: #9c9ca1;
  font-size: 0.67rem;
  font-weight: 500;
}

.pulse-label {
  color: #dadade;
  font-size: 0.76rem;
  font-weight: 600;
}

.tile-row {
  padding: 11px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(22, 22, 22, 0.95);
}

.tile-meta {
  color: #9999a0;
  font-size: 0.73rem;
}

.accountability-note {
  margin: 12px 0 0;
  color: #9a9aa0;
  font-size: 0.8rem;
  line-height: 1.42;
}

@media (max-width: 980px) {
  .board-grid {
    grid-template-columns: 1fr;
  }

  .hero-card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .focus-row {
    grid-template-columns: 42px 1fr;
  }

  .focus-progress {
    grid-column: span 2;
    text-align: left;
    padding-left: 52px;
  }
}
</style>

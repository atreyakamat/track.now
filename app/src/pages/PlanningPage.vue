<template>
  <q-page class="page-container planning-page">
    <div class="row items-end q-col-gutter-md q-mb-lg">
      <div class="col">
        <div class="text-overline text-primary section-kicker">Planner</div>
        <div class="text-h4 text-weight-bold">Plan the week before it gets noisy</div>
        <div class="text-body2 text-grey-7 q-mt-sm">
          This page turns your habits into a weekly map so you can see load, timing, and finish lines at a glance.
        </div>
      </div>
      <div class="col-auto">
        <q-btn label="Create mission" icon="add" color="primary" unelevated no-caps to="/add" />
      </div>
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading">
      <div class="summary-grid q-mb-lg">
        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Scheduled this week</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ totalSessionsThisWeek }}</div>
            <div class="text-body2 text-grey-7 q-mt-sm">Every repeated session visible in one place.</div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Busiest day</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ busiestDay?.label || 'None' }}</div>
            <div class="text-body2 text-grey-7 q-mt-sm">{{ busiestDay ? `${busiestDay.habits.length} scheduled habits` : 'Add habits to build your week.' }}</div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Average load</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ averageSessions }}</div>
            <div class="text-body2 text-grey-7 q-mt-sm">Average scheduled sessions per day this week.</div>
          </q-card-section>
        </q-card>
      </div>

      <q-card flat bordered class="planner-card q-mb-lg">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">Weekly map</div>
              <div class="text-caption text-grey-7">Scroll horizontally on mobile to inspect each day clearly.</div>
            </div>
          </div>

          <div v-if="weeklySchedule.every((day) => day.habits.length === 0)" class="text-body2 text-grey-7">
            No habits exist yet. Add a mission and the planner will show its weekly rhythm here.
          </div>

          <div v-else class="planner-scroll">
            <div class="planner-grid">
              <div v-for="day in weeklySchedule" :key="day.value" class="planner-day">
                <div class="planner-day-header">
                  <div class="text-subtitle2 text-weight-bold">{{ day.label }}</div>
                  <div class="text-caption text-grey-6">{{ formatDate(day.date) }}</div>
                </div>

                <div class="column q-gutter-sm">
                  <div v-if="day.habits.length === 0" class="planner-empty">Light day</div>

                  <button
                    v-for="habit in day.habits"
                    :key="`${day.value}-${habit.id}`"
                    type="button"
                    class="planner-mission"
                    @click="router.push(`/habit/${habit.id}`)"
                  >
                    <div class="row items-center q-col-gutter-sm no-wrap">
                      <div class="col-auto">
                        <div
                          class="planner-emoji"
                          :style="{ background: getCategoryMeta(habit.category).soft, color: getCategoryMeta(habit.category).accent }"
                        >
                          {{ habit.emoji }}
                        </div>
                      </div>
                      <div class="col">
                        <div class="text-caption text-grey-7">{{ formatTimeLabel(habit.time) }}</div>
                        <div class="text-body2 text-weight-medium ellipsis">{{ habit.name }}</div>
                      </div>
                    </div>
                    <div class="text-caption text-grey-7 q-mt-sm">
                      {{ habit.completed ? 'Completed for this day' : 'Scheduled session' }}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="planner-card">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">Mission queue</div>
              <div class="text-caption text-grey-7">Useful for deciding what to protect this week.</div>
            </div>
          </div>

          <div v-if="missionQueue.length === 0" class="text-body2 text-grey-7">
            Your queue is empty until you create a habit.
          </div>

          <div v-else class="column q-gutter-md">
            <div v-for="habit in missionQueue" :key="habit.id" class="queue-card">
              <div class="row items-center q-col-gutter-md">
                <div class="col-auto">
                  <div
                    class="planner-emoji"
                    :style="{ background: habit.categoryMeta.soft, color: habit.categoryMeta.accent }"
                  >
                    {{ habit.emoji }}
                  </div>
                </div>
                <div class="col">
                  <div class="row items-center">
                    <div class="text-body1 text-weight-bold">{{ habit.name }}</div>
                    <q-space />
                    <div class="text-caption text-grey-7">{{ habit.reminderSummary }}</div>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    {{ habit.dayLabel }} • {{ habit.remainingSessions }} days left
                  </div>
                  <q-linear-progress
                    class="q-mt-sm"
                    :value="habit.progress"
                    rounded
                    size="8px"
                    :color="habit.categoryMeta.accent"
                    track-color="grey-3"
                  />
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import {
  buildWeeklySchedule,
  formatDayList,
  formatTimeLabel,
  getCategoryMeta,
  getDateFromKey,
  getMissionProgress,
  getReminderSummary
} from 'src/utils/habitModel'

const router = useRouter()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()
const loading = ref(true)

const weeklySchedule = computed(() => buildWeeklySchedule(habitsStore.habits, completionsStore.completions))
const totalSessionsThisWeek = computed(() => weeklySchedule.value.reduce((sum, day) => sum + day.habits.length, 0))
const busiestDay = computed(() => {
  return [...weeklySchedule.value].sort((a, b) => b.habits.length - a.habits.length)[0]
})
const averageSessions = computed(() => {
  return totalSessionsThisWeek.value === 0 ? 0 : Math.round((totalSessionsThisWeek.value / 7) * 10) / 10
})

const missionQueue = computed(() => habitsStore.habits
  .map((habit) => {
    const missionProgress = getMissionProgress(habit, completionsStore.completions)
    return {
      ...habit,
      ...missionProgress,
      categoryMeta: getCategoryMeta(habit.category),
      reminderSummary: getReminderSummary(habit),
      dayLabel: formatDayList(habit.days)
    }
  })
  .sort((a, b) => a.remainingSessions - b.remainingSessions))

onMounted(async () => {
  await completionsStore.fetchLast90Days()
  loading.value = false
})

function formatDate(dateKey) {
  return getDateFromKey(dateKey).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}
</script>

<style scoped lang="scss">
.section-kicker {
  letter-spacing: 0.12em;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.summary-card,
.planner-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.planner-scroll {
  overflow-x: auto;
  padding-bottom: 8px;
}

.planner-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(180px, 1fr));
  gap: 12px;
  min-width: 1000px;
}

.planner-day {
  padding: 12px;
  border-radius: 18px;
  background: #fbfcfd;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.planner-day-header {
  margin-bottom: 12px;
}

.planner-empty {
  padding: 12px;
  border-radius: 14px;
  background: rgba(148, 163, 184, 0.08);
  color: #64748b;
  font-size: 0.82rem;
}

.planner-mission,
.queue-card {
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: #ffffff;
  text-align: left;
}

.planner-emoji {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}
</style>

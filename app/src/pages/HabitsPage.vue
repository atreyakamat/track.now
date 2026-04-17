<template>
  <q-page class="page-container habits-page">
    <div class="row items-end q-col-gutter-md q-mb-lg">
      <div class="col">
        <div class="text-overline text-primary section-kicker">Mission library</div>
        <div class="text-h4 text-weight-bold">My habits</div>
        <div class="text-body2 text-grey-7 q-mt-sm">
          This is where Track.now turns routines into finite missions with clear timing and focus.
        </div>
      </div>
      <div class="col-auto">
        <q-btn label="New mission" icon="add" color="primary" unelevated no-caps to="/add" />
      </div>
    </div>

    <div class="summary-grid q-mb-lg">
      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Total missions</div>
          <div class="text-h5 text-weight-bold q-mt-xs">{{ habits.length }}</div>
          <div class="text-body2 text-grey-7 q-mt-sm">Each one has a category, cadence, and finish line.</div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Active today</div>
          <div class="text-h5 text-weight-bold q-mt-xs">{{ todayCount }}</div>
          <div class="text-body2 text-grey-7 q-mt-sm">The habits waiting on the Today screen right now.</div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Closing soon</div>
          <div class="text-h5 text-weight-bold q-mt-xs">{{ closingSoonCount }}</div>
          <div class="text-body2 text-grey-7 q-mt-sm">Missions with seven days or fewer left to finish.</div>
        </q-card-section>
      </q-card>
    </div>

    <q-tabs
      v-model="tab"
      active-color="primary"
      indicator-color="primary"
      align="left"
      class="q-mb-md"
      no-caps
    >
      <q-tab name="all" label="All" />
      <q-tab name="today" label="Today" />
      <q-tab name="closing" label="Closing soon" />
    </q-tabs>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading && filteredHabits.length === 0" class="text-center q-py-xl empty-state">
      <div class="text-h3 q-mb-md">🌱</div>
      <div class="text-h6 text-weight-bold q-mb-sm">
        {{ habits.length === 0 ? 'No missions yet' : 'Nothing in this view right now' }}
      </div>
      <div class="text-body2 text-grey-7 q-mb-lg">
        {{ habits.length === 0
          ? 'Create a habit with a duration, reminder time, and category to start shaping the daily flow.'
          : 'Try another filter or add a new mission.' }}
      </div>
      <q-btn label="Create mission" color="primary" unelevated icon="add" to="/add" />
    </div>

    <div v-else class="column q-gutter-md">
      <q-card
        v-for="habit in filteredHabits"
        :key="habit.id"
        flat
        bordered
        class="mission-card"
        clickable
        @click="router.push(`/habit/${habit.id}`)"
      >
        <q-card-section>
          <div class="row items-start no-wrap q-col-gutter-md">
            <div class="col-auto">
              <div
                class="mission-emoji"
                :style="{ background: habit.categoryMeta.soft, color: habit.categoryMeta.accent }"
              >
                {{ habit.emoji }}
              </div>
            </div>

            <div class="col">
              <div class="row items-start no-wrap">
                <div class="col">
                  <div class="row items-center q-gutter-sm">
                    <div class="text-subtitle1 text-weight-bold">{{ habit.name }}</div>
                    <span
                      class="category-pill"
                      :style="{ background: habit.categoryMeta.soft, color: habit.categoryMeta.accent }"
                    >
                      {{ habit.categoryMeta.label }}
                    </span>
                  </div>

                  <div class="text-caption text-grey-7 q-mt-xs">
                    {{ habit.categoryMeta.identity }} • {{ habit.difficultyMeta.label }} effort
                  </div>
                </div>

                <div class="col-auto">
                  <div class="row q-gutter-xs">
                    <q-btn flat round dense icon="edit" size="sm" color="grey-7" @click.stop="editHabit(habit)" />
                    <q-btn flat round dense icon="delete" size="sm" color="negative" @click.stop="confirmDelete(habit)" />
                  </div>
                </div>
              </div>

              <div class="mission-meta q-mt-md">
                <span class="mission-meta-item">
                  <q-icon name="calendar_month" size="14px" />
                  {{ habit.dayLabel }}
                </span>
                <span class="mission-meta-item">
                  <q-icon name="schedule" size="14px" />
                  {{ habit.reminderSummary }}
                </span>
                <span class="mission-meta-item">
                  <q-icon name="flag" size="14px" />
                  {{ habit.durationMeta.label }}
                </span>
              </div>

              <div class="q-mt-md">
                <div class="row items-center q-mb-xs">
                  <div class="text-caption text-weight-medium">
                    {{ habit.missionProgress.missionDone
                      ? 'Mission complete'
                      : `Day ${habit.missionProgress.displayDay} / ${habit.missionProgress.durationDays}` }}
                  </div>
                  <q-space />
                  <div class="text-caption text-grey-6">
                    {{ habit.missionProgress.missionDone
                      ? 'Ready to archive or replace'
                      : `${habit.missionProgress.remainingSessions} days left` }}
                  </div>
                </div>
                <div class="mission-track">
                  <div
                    class="mission-track-fill"
                    :style="{
                      width: `${Math.max(habit.missionProgress.progress * 100, habit.missionProgress.progress > 0 ? 10 : 0)}%`,
                      background: habit.categoryMeta.accent
                    }"
                  />
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 320px">
        <q-card-section>
          <div class="text-h6">Delete habit</div>
          <div class="q-mt-sm">
            Remove "{{ habitToDelete?.name }}" and its mission setup? Completion history will remain untouched.
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated label="Delete" color="negative" @click="handleDelete" :loading="deleting" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import {
  formatDayList,
  getCategoryMeta,
  getDifficultyMeta,
  getDurationMeta,
  getMissionProgress,
  getReminderSummary
} from 'src/utils/habitModel'

const router = useRouter()
const $q = useQuasar()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()

const tab = ref('all')
const deleteDialog = ref(false)
const habitToDelete = ref(null)
const deleting = ref(false)

const loading = computed(() => habitsStore.loading || completionsStore.loading)
const habits = computed(() => habitsStore.habits)
const todayCount = computed(() => habitsStore.todayHabits.length)

const decoratedHabits = computed(() => habits.value.map((habit) => ({
  ...habit,
  categoryMeta: getCategoryMeta(habit.category),
  difficultyMeta: getDifficultyMeta(habit.difficulty),
  durationMeta: getDurationMeta(habit.durationDays),
  reminderSummary: getReminderSummary(habit),
  dayLabel: formatDayList(habit.days),
  missionProgress: getMissionProgress(habit, completionsStore.completions)
})))

const closingSoonCount = computed(() => decoratedHabits.value.filter((habit) => {
  return !habit.missionProgress.missionDone && habit.missionProgress.remainingSessions <= 7
}).length)

const filteredHabits = computed(() => {
  if (tab.value === 'today') {
    const todayIds = new Set(habitsStore.todayHabits.map((habit) => habit.id))
    return decoratedHabits.value.filter((habit) => todayIds.has(habit.id))
  }

  if (tab.value === 'closing') {
    return decoratedHabits.value.filter((habit) => {
      return !habit.missionProgress.missionDone && habit.missionProgress.remainingSessions <= 7
    })
  }

  return decoratedHabits.value
})

onMounted(async () => {
  if (completionsStore.completions.length > 0) return
  await completionsStore.fetchLast90Days()
})

function editHabit(habit) {
  router.push({ path: '/add', query: { edit: habit.id } })
}

function confirmDelete(habit) {
  habitToDelete.value = habit
  deleteDialog.value = true
}

async function handleDelete() {
  deleting.value = true

  try {
    await habitsStore.deleteHabit(habitToDelete.value.id)
    deleteDialog.value = false
    $q.notify({ message: 'Habit deleted', color: 'positive' })
  } catch {
    $q.notify({ message: 'Failed to delete', color: 'negative' })
  } finally {
    deleting.value = false
  }
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
.mission-card {
  border-radius: 22px;
  border-color: rgba(148, 163, 184, 0.18);
}

.summary-card {
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.04);
}

.mission-card {
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
}

.mission-emoji {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
}

.category-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}

.mission-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mission-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
  color: #475569;
  font-size: 0.74rem;
}

.mission-track {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  overflow: hidden;
}

.mission-track-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.25s ease;
}

.empty-state {
  border-radius: 22px;
}
</style>

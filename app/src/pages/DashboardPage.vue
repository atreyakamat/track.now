<template>
  <q-page class="page-container dashboard-page">
    <div class="row items-end q-col-gutter-md q-mb-lg">
      <div class="col">
        <div class="text-overline text-primary section-kicker">Overview</div>
        <div class="text-h4 text-weight-bold">A calmer view of your system</div>
        <div class="text-body2 text-grey-7 q-mt-sm">
          Track.now keeps the dashboard useful but lightweight so it never steals focus from Today.
        </div>
      </div>
      <div class="col-auto">
        <q-btn label="Open today" color="primary" unelevated no-caps to="/today" />
      </div>
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading">
      <q-card flat class="dashboard-hero q-mb-lg">
        <q-card-section class="row q-col-gutter-lg items-center">
          <div class="col">
            <div class="text-overline text-primary">This week</div>
            <div class="text-h5 text-weight-bold q-mt-xs">
              {{ identityInsight ? identityInsight.meta.identity : 'Your next identity is waiting' }}
            </div>
            <div class="text-body2 text-grey-7 q-mt-sm">
              {{ identityInsight
                ? `${identityInsight.meta.label} is leading your week with ${identityInsight.score}% consistency.`
                : 'Once you complete a few scheduled habits, the strongest identity signal will appear here.' }}
            </div>
          </div>
          <div class="col-auto">
            <div class="plan-badge">
              <div class="text-caption text-grey-7">Plan</div>
              <div class="text-subtitle1 text-weight-bold text-uppercase">{{ currentPlan }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <div class="summary-grid q-mb-lg">
        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Momentum</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ momentum.percentage }}%</div>
            <div class="text-body2 text-grey-7 q-mt-sm">{{ momentum.completedCount }}/{{ momentum.scheduledCount }} sessions over 7 days.</div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Today complete</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ completedToday }}/{{ todayHabits.length }}</div>
            <div class="text-body2 text-grey-7 q-mt-sm">A concise measure of what still needs attention right now.</div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Active missions</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ habits.length }}</div>
            <div class="text-body2 text-grey-7 q-mt-sm">Every mission has a fixed finish line instead of endless streak pressure.</div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Finishing soon</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ nearFinish.length }}</div>
            <div class="text-body2 text-grey-7 q-mt-sm">Missions with fewer than seven sessions left.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="row q-col-gutter-lg">
        <div class="col-12 col-lg-7">
          <q-card flat bordered class="content-card q-mb-lg">
            <q-card-section>
              <div class="row items-center q-mb-md">
                <div class="col">
                  <div class="text-subtitle1 text-weight-bold">Today’s focus</div>
                  <div class="text-caption text-grey-7">Ordered by time so the next action is always obvious.</div>
                </div>
                <div class="col-auto">
                  <q-btn flat no-caps label="Planner" icon="view_week" to="/planner" />
                </div>
              </div>

              <div v-if="todayFocus.length === 0" class="text-body2 text-grey-7">
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
                  <div
                    class="focus-emoji"
                    :style="{ background: item.categoryMeta.soft, color: item.categoryMeta.accent }"
                  >
                    {{ item.emoji }}
                  </div>
                  <div class="col text-left">
                    <div class="text-subtitle2 text-weight-bold">{{ item.name }}</div>
                    <div class="text-caption text-grey-7">
                      {{ item.reminderSummary }} • {{ item.categoryMeta.identity }}
                    </div>
                  </div>
                  <div class="focus-progress text-right">
                    <div class="text-caption text-weight-medium">
                      {{ item.missionProgress.completedSessions }}/{{ item.missionProgress.durationDays }}
                    </div>
                    <div class="text-caption text-grey-6">
                      {{ item.completed ? 'Done today' : 'Pending' }}
                    </div>
                  </div>
                </button>
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="content-card">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold q-mb-md">Category pulse</div>
              <div v-if="categoryBreakdown.length === 0" class="text-body2 text-grey-7">
                Category insights will appear after you track a few habits.
              </div>
              <div v-else class="column q-gutter-md">
                <div v-for="category in categoryBreakdown" :key="category.category">
                  <div class="row items-center q-mb-xs">
                    <div class="text-body2 text-weight-medium">{{ category.meta.label }}</div>
                    <q-space />
                    <div class="text-caption text-grey-7">{{ category.score }}%</div>
                  </div>
                  <q-linear-progress
                    :value="category.score / 100"
                    rounded
                    size="10px"
                    :color="category.meta.accent"
                    track-color="grey-3"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-lg-5">
          <q-card flat bordered class="content-card q-mb-lg">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold q-mb-md">Closing soon</div>
              <div v-if="nearFinish.length === 0" class="text-body2 text-grey-7">
                Your mission queue is healthy. Nothing is near the finish line yet.
              </div>
              <div v-else class="column q-gutter-md">
                <div v-for="habit in nearFinish" :key="habit.id" class="finish-card">
                  <div class="row items-center q-mb-sm">
                    <div class="text-h6 q-mr-sm">{{ habit.emoji }}</div>
                    <div class="col">
                      <div class="text-body2 text-weight-bold">{{ habit.name }}</div>
                      <div class="text-caption text-grey-7">{{ habit.remainingSessions }} sessions left</div>
                    </div>
                  </div>
                  <q-linear-progress :value="habit.progress" rounded size="8px" :color="habit.categoryMeta.accent" track-color="grey-3" />
                </div>
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="content-card">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold q-mb-md">Accountability</div>
              <div class="column q-gutter-sm">
                <q-btn outline no-caps align="left" icon="people" label="Friends" to="/friends" />
                <q-btn outline no-caps align="left" icon="group" label="Groups" to="/groups" />
                <q-btn outline no-caps align="left" icon="family_restroom" label="Family plan" to="/family" />
              </div>
              <div class="text-body2 text-grey-7 q-mt-md">
                Social surfaces stay optional so the core product remains quiet and focused.
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import {
  buildCategoryBreakdown,
  buildIdentityInsight,
  calculateMomentum,
  getCategoryMeta,
  getMissionProgress,
  getReminderSummary
} from 'src/utils/habitModel'

const router = useRouter()
const authStore = useAuthStore()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()
const loading = ref(true)

const habits = computed(() => habitsStore.habits)
const todayHabits = computed(() => habitsStore.todayHabits)
const completedIds = computed(() => completionsStore.completedHabitIds)
const completedToday = computed(() => todayHabits.value.filter((habit) => completedIds.value.has(habit.id)).length)
const currentPlan = computed(() => authStore.currentPlan)

const momentum = computed(() => calculateMomentum(habits.value, completionsStore.completions))
const identityInsight = computed(() => buildIdentityInsight(habits.value, completionsStore.completions))
const categoryBreakdown = computed(() => buildCategoryBreakdown(habits.value, completionsStore.completions, 14).slice(0, 4))

const todayFocus = computed(() => todayHabits.value.map((habit) => {
  const missionProgress = getMissionProgress(habit, completionsStore.completions)
  return {
    ...habit,
    completed: completedIds.value.has(habit.id),
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
.section-kicker {
  letter-spacing: 0.12em;
}

.dashboard-hero,
.content-card,
.summary-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.dashboard-hero {
  background:
    radial-gradient(circle at top left, rgba(36, 92, 104, 0.12), transparent 46%),
    #ffffff;
}

.plan-badge {
  min-width: 110px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(36, 92, 104, 0.08);
  text-align: center;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.focus-row {
  width: 100%;
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: #fbfcfd;
}

.focus-emoji {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.finish-card {
  padding: 12px;
  border-radius: 18px;
  background: #fbfcfd;
  border: 1px solid rgba(148, 163, 184, 0.12);
}
</style>

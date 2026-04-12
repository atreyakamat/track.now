<template>
  <q-page class="page-container habit-detail-page">
    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading && !habit" class="empty-detail text-center">
      <div class="text-h3 q-mb-md">🧭</div>
      <div class="text-h6 text-weight-bold q-mb-sm">Habit not found</div>
      <div class="text-body2 text-grey-7 q-mb-lg">The mission may have been deleted or never existed in this account.</div>
      <q-btn label="Back to habits" color="primary" unelevated to="/habits" />
    </div>

    <div v-else-if="habit">
      <div class="row items-start q-col-gutter-lg q-mb-lg">
        <div class="col">
          <div class="text-overline" :style="{ color: categoryMeta.accent }">Mission detail</div>
          <div class="row items-center q-gutter-md q-mt-sm">
            <div
              class="detail-emoji"
              :style="{ background: categoryMeta.soft, color: categoryMeta.accent }"
            >
              {{ habit.emoji }}
            </div>
            <div>
              <div class="text-h4 text-weight-bold">{{ habit.name }}</div>
              <div class="text-body2 text-grey-7 q-mt-xs">
                {{ categoryMeta.identity }} • {{ difficultyMeta.label }} effort
              </div>
            </div>
          </div>
        </div>

        <div class="col-auto">
          <div class="row q-gutter-sm">
            <q-btn flat no-caps icon="share" label="Share" @click="shareHabit" />
            <q-btn color="primary" unelevated no-caps icon="edit" label="Edit" @click="router.push({ path: '/add', query: { edit: habit.id } })" />
          </div>
        </div>
      </div>

      <div class="row q-col-gutter-lg">
        <div class="col-12 col-lg-7">
          <q-card flat class="detail-hero q-mb-lg">
            <q-card-section class="row q-col-gutter-lg items-center">
              <div class="col-auto">
                <q-circular-progress
                  show-value
                  size="112px"
                  :value="Math.round(missionProgress.progress * 100)"
                  :thickness="0.16"
                  color="primary"
                  track-color="grey-3"
                >
                  <div class="text-subtitle1 text-weight-bold">{{ missionProgress.completedSessions }}</div>
                  <div class="text-caption">done</div>
                </q-circular-progress>
              </div>
              <div class="col">
                <div class="text-h6 text-weight-bold">
                  {{ missionProgress.missionDone ? 'Mission complete' : `Day ${missionProgress.displayDay} / ${missionProgress.durationDays}` }}
                </div>
                <div class="text-body2 text-grey-7 q-mt-sm">
                  {{ missionProgress.missionDone
                    ? 'This mission has reached its finish line. You can now archive it or replace it with a new one.'
                    : `${missionProgress.remainingSessions} days remain in this arc.` }}
                </div>
                <div class="row q-gutter-sm q-mt-md">
                  <q-chip dense square class="meta-chip">{{ durationMeta.label }}</q-chip>
                  <q-chip dense square class="meta-chip">{{ reminderListLabel }}</q-chip>
                  <q-chip dense square class="meta-chip">{{ dayLabel }}</q-chip>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="detail-card q-mb-lg">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold q-mb-md">Recent activity</div>
              <div v-if="activityFeed.length === 0" class="text-body2 text-grey-7">
                No completion history yet. The first completed session will appear here.
              </div>
              <q-list v-else separator>
                <q-item v-for="item in activityFeed" :key="item.date">
                  <q-item-section avatar>
                    <q-avatar :style="{ background: categoryMeta.soft, color: categoryMeta.accent }">
                      {{ habit.emoji }}
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ item.label }}</q-item-label>
                    <q-item-label caption>{{ item.subtitle }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-lg-5">
          <q-card flat bordered class="detail-card q-mb-lg">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold q-mb-md">Mission setup</div>
              <div class="column q-gutter-sm">
                <div class="detail-meta-row">
                  <span class="text-grey-7">Category</span>
                  <span class="text-weight-medium">{{ categoryMeta.label }}</span>
                </div>
                <div class="detail-meta-row">
                  <span class="text-grey-7">Identity</span>
                  <span class="text-weight-medium">{{ categoryMeta.identity }}</span>
                </div>
                <div class="detail-meta-row">
                  <span class="text-grey-7">Difficulty</span>
                  <span class="text-weight-medium">{{ difficultyMeta.label }}</span>
                </div>
                <div class="detail-meta-row">
                  <span class="text-grey-7">Duration</span>
                  <span class="text-weight-medium">{{ durationMeta.label }}</span>
                </div>
                <div class="detail-meta-row">
                  <span class="text-grey-7">Schedule</span>
                  <span class="text-weight-medium">{{ dayLabel }}</span>
                </div>
                <div class="detail-meta-row">
                  <span class="text-grey-7">Reminders</span>
                  <span class="text-weight-medium">{{ reminderListLabel }}</span>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="detail-card">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold q-mb-md">Actions</div>
              <div class="column q-gutter-sm">
                <q-btn outline no-caps align="left" icon="today" label="Open Today view" to="/today" />
                <q-btn outline no-caps align="left" icon="bar_chart" label="View analytics" to="/analytics" />
                <q-btn outline no-caps align="left" icon="share" label="Share via WhatsApp" @click="shareHabit" />
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
import { useRoute, useRouter } from 'vue-router'
import { whatsappService } from 'src/services/whatsappService'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import {
  formatDayList,
  getCategoryMeta,
  getCompletionDatesForHabit,
  getDateFromKey,
  getDifficultyMeta,
  getDurationMeta,
  getMissionProgress,
  getReminderListLabel,
  getRelativeDayLabel
} from 'src/utils/habitModel'

const route = useRoute()
const router = useRouter()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()
const loading = ref(true)

const habit = computed(() => habitsStore.habits.find((item) => item.id === route.params.id))
const categoryMeta = computed(() => getCategoryMeta(habit.value?.category))
const difficultyMeta = computed(() => getDifficultyMeta(habit.value?.difficulty))
const durationMeta = computed(() => getDurationMeta(habit.value?.durationDays))
const missionProgress = computed(() => habit.value ? getMissionProgress(habit.value, completionsStore.completions) : {
  progress: 0,
  completedSessions: 0,
  durationDays: 21,
  displayDay: 1,
  remainingSessions: 21,
  missionDone: false
})
const reminderListLabel = computed(() => habit.value ? getReminderListLabel(habit.value) : '')
const dayLabel = computed(() => habit.value ? formatDayList(habit.value.days) : '')

const activityFeed = computed(() => {
  if (!habit.value) return []

  return getCompletionDatesForHabit(habit.value.id, completionsStore.completions)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 8)
    .map((date) => ({
      date,
      label: getRelativeDayLabel(date),
      subtitle: getDateFromKey(date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      })
    }))
})

onMounted(async () => {
  await completionsStore.fetchLast90Days()
  loading.value = false
})

function shareHabit() {
  if (!habit.value) return

  whatsappService.shareAchievement(
    `I'm building "${habit.value.name}" on Track.now. ${missionProgress.value.completedSessions}/${missionProgress.value.durationDays} mission days complete so far.`
  )
}
</script>

<style scoped lang="scss">
.habit-detail-page {
  padding-bottom: 96px;
}

.detail-hero,
.detail-card,
.empty-detail {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.detail-hero {
  background:
    radial-gradient(circle at top left, rgba(36, 92, 104, 0.12), transparent 50%),
    #ffffff;
}

.detail-emoji {
  width: 72px;
  height: 72px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
}

.meta-chip {
  background: rgba(76, 95, 115, 0.08);
  color: #334155;
}

.detail-meta-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.detail-meta-row:last-child {
  border-bottom: 0;
}

.empty-detail {
  padding: 48px 24px;
  background: #ffffff;
}
</style>

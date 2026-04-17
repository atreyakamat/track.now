<template>
  <q-card class="habit-card q-mb-md" :class="{ 'completed-card': isCompleted }" flat bordered v-ripple>
    <q-card-section class="habit-card-section">
      <div class="row items-start no-wrap q-col-gutter-md">
        <div class="col-auto">
          <div
            class="habit-emoji"
            :style="{ background: categoryMeta.soft, color: categoryMeta.accent }"
          >
            {{ habit.emoji || '✅' }}
          </div>
        </div>

        <div class="col">
          <div class="row items-start no-wrap">
            <div class="col">
              <div class="row items-center q-gutter-sm">
                <div class="text-subtitle1 text-weight-bold">
                  {{ habit.name }}
                </div>
                <span
                  class="category-pill"
                  :style="{ background: categoryMeta.soft, color: categoryMeta.accent }"
                >
                  {{ categoryMeta.label }}
                </span>
              </div>

              <div class="text-caption text-grey-7 q-mt-xs">
                {{ categoryMeta.identity }} • {{ difficultyMeta.label }} effort
              </div>
            </div>

            <div class="col-auto">
              <q-btn
                v-if="!isCompleted"
                round
                unelevated
                color="primary"
                icon="check"
                size="sm"
                @click="handleComplete"
                :loading="completing"
              />
              <q-btn
                v-else
                round
                unelevated
                color="positive"
                icon="check_circle"
                size="sm"
                class="complete-animation"
                @click="handleUncomplete"
              />
            </div>
          </div>

          <div class="habit-meta q-mt-md">
            <span class="habit-meta-item">
              <q-icon name="calendar_month" size="14px" />
              {{ dayLabel }}
            </span>
            <span class="habit-meta-item">
              <q-icon name="schedule" size="14px" />
              {{ reminderSummary }}
            </span>
            <span class="habit-meta-item">
              <q-icon name="task_alt" size="14px" />
              {{ todaySessionProgress.completedSessions }}/{{ todaySessionProgress.totalSessions }} today
            </span>
            <span class="habit-meta-item">
              <q-icon name="flag" size="14px" />
              {{ missionProgress.completedSessions }}/{{ missionProgress.durationDays }} mission days
            </span>
          </div>

          <div class="q-mt-md">
            <div class="row items-center q-mb-xs">
              <div class="text-caption text-weight-medium">
                {{ missionHeadline }}
              </div>
              <q-space />
              <div class="text-caption text-grey-6">
                {{ missionSupport }}
              </div>
            </div>
            <div class="mission-track">
              <div
                class="mission-track-fill"
                :style="{
                  width: `${Math.max(missionProgress.progress * 100, missionProgress.progress > 0 ? 10 : 0)}%`,
                  background: categoryMeta.accent
                }"
              />
            </div>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useCompletionsStore } from 'src/stores/completions'
import {
  formatTimeLabel,
  formatDayList,
  getCategoryMeta,
  getDifficultyMeta,
  getHabitSessionProgressForDate,
  getMissionProgress,
  getReminderSummary
} from 'src/utils/habitModel'

const props = defineProps({
  habit: { type: Object, required: true },
  isCompleted: { type: Boolean, default: false }
})

const emit = defineEmits(['completed', 'uncompleted'])
const $q = useQuasar()
const completionsStore = useCompletionsStore()
const completing = ref(false)

const categoryMeta = computed(() => getCategoryMeta(props.habit.category))
const difficultyMeta = computed(() => getDifficultyMeta(props.habit.difficulty))
const reminderSummary = computed(() => getReminderSummary(props.habit))
const dayLabel = computed(() => formatDayList(props.habit.days))
const missionProgress = computed(() => getMissionProgress(props.habit, completionsStore.completions))
const todaySessionProgress = computed(() => getHabitSessionProgressForDate(props.habit, completionsStore.completions))
const missionHeadline = computed(() => {
  if (missionProgress.value.missionDone) return 'Mission complete'
  return `Day ${missionProgress.value.displayDay} / ${missionProgress.value.durationDays}`
})
const missionSupport = computed(() => {
  if (missionProgress.value.missionDone) return 'Ready for a new mission'
  if (todaySessionProgress.value.completed) {
    return `${missionProgress.value.remainingSessions} mission days to go`
  }
  return `Next session at ${formatTimeLabel(todaySessionProgress.value.nextSessionId || props.habit.time)}`
})

async function handleComplete() {
  const sessionStatus = todaySessionProgress.value
  const targetSessionId = sessionStatus.nextSessionId
  if (sessionStatus.completed || !targetSessionId) return

  completing.value = true
  try {
    await completionsStore.markComplete(props.habit.id, targetSessionId)
    emit('completed', props.habit.id)

    const afterCount = Math.min(sessionStatus.completedSessions + 1, sessionStatus.totalSessions)
    const dayCompleted = afterCount >= sessionStatus.totalSessions

    $q.notify({
      message: dayCompleted
        ? `${props.habit.emoji} ${props.habit.name} completed for today`
        : `${props.habit.emoji} ${props.habit.name}: session ${afterCount}/${sessionStatus.totalSessions}`,
      color: 'positive',
      icon: 'check_circle',
      timeout: 2000
    })
  } catch {
    $q.notify({ message: 'Failed to mark complete', color: 'negative' })
  } finally {
    completing.value = false
  }
}

async function handleUncomplete() {
  try {
    await completionsStore.unmarkComplete(props.habit.id)
    emit('uncompleted', props.habit.id)
    $q.notify({ message: 'Last session undone', color: 'info' })
  } catch {
    $q.notify({ message: 'Failed to update', color: 'negative' })
  }
}
</script>

<style scoped lang="scss">
.habit-card {
  border-radius: 22px;
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.04);
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;

  &:hover {
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.07);
    transform: translateY(-1px);
  }
}

.habit-card-section {
  padding: 18px;
}

.completed-card {
  opacity: 0.76;

  .body--dark & {
    opacity: 0.62;
  }
}

.habit-emoji {
  font-size: 1.75rem;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.category-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}

.habit-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.habit-meta-item {
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
</style>

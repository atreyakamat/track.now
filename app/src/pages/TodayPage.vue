<template>
  <q-page class="page-container today-page">
    <div class="q-mb-lg">
      <div class="text-caption text-grey-7">{{ formattedDate }}</div>
      <div class="text-h4 text-weight-bold q-mt-xs">{{ greeting }}, {{ firstName }}</div>
      <div class="text-body2 text-grey-7 q-mt-sm">
        Track.now keeps today calm on purpose: fewer decisions, clearer action.
      </div>
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading">
      <q-card flat class="today-hero-card q-mb-lg">
        <q-card-section class="row items-center q-col-gutter-lg">
          <div class="col-auto">
            <q-circular-progress
              show-value
              size="104px"
              :value="Math.round(completionRate * 100)"
              :thickness="0.16"
              color="primary"
              track-color="grey-3"
              class="hero-ring"
            >
              <div class="text-subtitle1 text-weight-bold">{{ Math.round(completionRate * 100) }}%</div>
              <div class="text-caption">today</div>
            </q-circular-progress>
          </div>

          <div class="col">
            <div class="text-overline text-primary hero-kicker">Right now</div>
            <div class="text-h6 text-weight-bold">{{ headline }}</div>
            <div class="text-body2 text-grey-7 q-mt-sm">
              {{ supportText }}
            </div>

            <div class="row q-gutter-sm q-mt-md">
              <q-chip dense square class="hero-chip">
                {{ completedCount }}/{{ todayHabits.length }} done
              </q-chip>
              <q-chip dense square class="hero-chip">
                Momentum {{ momentum.percentage }}%
              </q-chip>
              <q-chip dense square class="hero-chip">
                {{ nextReminderLabel }}
              </q-chip>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <div class="insight-grid q-mb-lg">
        <q-card flat bordered class="insight-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Identity in motion</div>
            <div class="text-subtitle1 text-weight-bold q-mt-xs">
              {{ identityInsight ? identityInsight.meta.identity : 'Choose your first area' }}
            </div>
            <div class="text-body2 text-grey-7 q-mt-sm">
              {{ identityInsight
                ? `${identityInsight.meta.label} leads this week at ${identityInsight.score}% consistency.`
                : 'Once you add habits, Track.now will reflect the identity they are reinforcing.' }}
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="insight-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Grace-friendly progress</div>
            <div class="text-subtitle1 text-weight-bold q-mt-xs">Progress is volume-based</div>
            <div class="text-body2 text-grey-7 q-mt-sm">
              Missing a day does not erase mission progress. Completion history keeps the larger arc intact.
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div v-if="todayHabits.length === 0" class="empty-state text-center q-py-xl">
        <div class="text-h3 q-mb-md">🌱</div>
        <div class="text-h6 text-weight-bold q-mb-sm">No habits scheduled for today</div>
        <div class="text-body2 text-grey-7 q-mb-lg">
          Add one small mission and the Today view will stay focused on exactly what matters next.
        </div>
        <q-btn label="Create mission" color="primary" unelevated icon="add" to="/add" />
      </div>

      <div v-else>
        <div class="row items-center q-mb-md">
          <div class="col">
            <div class="text-subtitle1 text-weight-bold">Up next</div>
            <div class="text-caption text-grey-7">
              Complete the next habit when the moment arrives.
            </div>
          </div>
        </div>

        <div v-if="allDone" class="empty-state text-center q-py-xl q-mb-lg">
          <div class="text-h3 q-mb-md">✓</div>
          <div class="text-h6 text-weight-bold q-mb-sm">Everything for today is complete</div>
          <div class="text-body2 text-grey-7 q-mb-lg">
            You can review the mission arc in analytics or simply leave the rest of the day uncluttered.
          </div>
          <q-btn label="View analytics" color="primary" unelevated icon="bar_chart" to="/analytics" />
        </div>

        <HabitCard
          v-for="habit in pendingHabits"
          :key="habit.id"
          :habit="habit"
          :is-completed="false"
          @completed="onCompleted"
        />

        <div v-if="completedHabits.length > 0" class="q-mt-xl">
          <div class="row items-center q-mb-md">
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">Completed today</div>
              <div class="text-caption text-grey-7">Tappable if you need to undo a completion.</div>
            </div>
          </div>

          <HabitCard
            v-for="habit in completedHabits"
            :key="habit.id"
            :habit="habit"
            :is-completed="true"
            @uncompleted="onUncompleted"
          />
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import HabitCard from 'src/components/HabitCard.vue'
import { useAuthStore } from 'src/stores/auth'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import {
  buildIdentityInsight,
  calculateMomentum,
  getReminderSummary,
  getTodayHeadline
} from 'src/utils/habitModel'

const authStore = useAuthStore()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()

const loading = ref(true)

const firstName = computed(() => {
  const name = authStore.displayName
  return name ? name.split(' ')[0] : 'there'
})

const formattedDate = computed(() => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
})

const todayHabits = computed(() => habitsStore.todayHabits)
const completedHabitIds = computed(() => completionsStore.completedHabitIds)

const pendingHabits = computed(() => {
  return todayHabits.value.filter((habit) => !completedHabitIds.value.has(habit.id))
})

const completedHabits = computed(() => {
  return todayHabits.value.filter((habit) => completedHabitIds.value.has(habit.id))
})

const completedCount = computed(() => completedHabits.value.length)
const completionRate = computed(() => {
  return todayHabits.value.length > 0 ? completedCount.value / todayHabits.value.length : 0
})
const allDone = computed(() => todayHabits.value.length > 0 && pendingHabits.value.length === 0)

const momentum = computed(() => {
  return calculateMomentum(habitsStore.habits, completionsStore.completions)
})

const identityInsight = computed(() => {
  return buildIdentityInsight(habitsStore.habits, completionsStore.completions)
})

const headline = computed(() => {
  return getTodayHeadline(todayHabits.value.length, pendingHabits.value.length, allDone.value)
})

const nextReminderLabel = computed(() => {
  if (pendingHabits.value.length === 0) return 'Nothing left today'
  return `Next: ${getReminderSummary(pendingHabits.value[0])}`
})

const supportText = computed(() => {
  if (todayHabits.value.length === 0) {
    return 'The Today screen will stay quiet until you add a mission with an actual schedule.'
  }

  if (allDone.value) {
    return 'Today is clear. The mission model keeps your long-term progress intact without relying on endless streaks.'
  }

  if (identityInsight.value) {
    return `You are reinforcing the ${identityInsight.value.meta.identity} identity with ${momentum.value.percentage}% momentum over the last 7 days.`
  }

  return 'One clear action at a time is enough.'
})

onMounted(async () => {
  await completionsStore.fetchLast90Days()
  loading.value = false
})

function onCompleted() {}
function onUncompleted() {}
</script>

<style scoped lang="scss">
.today-page {
  padding-bottom: 96px;
}

.today-hero-card {
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(36, 92, 104, 0.14), transparent 50%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(245, 247, 250, 0.98));
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.05);
}

.hero-ring {
  background: rgba(255, 255, 255, 0.72);
  border-radius: 999px;
}

.hero-kicker {
  letter-spacing: 0.12em;
}

.hero-chip {
  background: rgba(76, 95, 115, 0.08);
  color: #334155;
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.insight-card,
.empty-state {
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: #ffffff;
}
</style>

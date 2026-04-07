<template>
  <q-page class="page-container">
    <div class="q-mb-lg">
      <div class="text-caption text-grey">{{ formattedDate }}</div>
      <div class="text-h5 text-weight-bold">{{ greeting }}, {{ firstName }} 👋</div>
      <div class="q-mt-xs">
        <q-linear-progress
          :value="completionRate"
          color="positive"
          track-color="grey-3"
          rounded
          size="8px"
          class="q-mb-xs"
        />
        <span class="text-caption text-grey">{{ completedCount }}/{{ todayHabits.length }} habits done</span>
      </div>
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading">
      <div v-if="todayHabits.length === 0" class="empty-state text-center q-py-xl">
        <div class="text-h3 q-mb-md">📅</div>
        <div class="text-h6 text-weight-bold q-mb-sm">No habits for today</div>
        <div class="text-grey q-mb-lg">Add a habit to get started!</div>
        <q-btn label="Add Habit" color="primary" unelevated icon="add" to="/add" />
      </div>

      <div v-else-if="allDone" class="empty-state text-center q-py-xl">
        <div class="text-h2 q-mb-md">🎉</div>
        <div class="text-h6 text-weight-bold q-mb-sm">All done for today!</div>
        <div class="text-grey q-mb-lg">Amazing work! You crushed all your habits.</div>
        <q-btn label="View Stats" color="primary" unelevated icon="bar_chart" to="/analytics" />
      </div>

      <div v-else>
        <div class="text-subtitle2 text-grey q-mb-md">Today's habits</div>
        <HabitCard
          v-for="habit in pendingHabits"
          :key="habit.id"
          :habit="habit"
          :is-completed="completedHabitIds.has(habit.id)"
          @completed="onCompleted"
        />
        <div v-if="completedHabits.length > 0" class="q-mt-lg">
          <div class="text-subtitle2 text-grey q-mb-md">Completed ✅</div>
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
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useHabitsStore } from 'src/stores/habits'
import { useCompletionsStore } from 'src/stores/completions'
import HabitCard from 'src/components/HabitCard.vue'

const authStore = useAuthStore()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()

const loading = ref(true)

const firstName = computed(() => {
  const name = authStore.displayName
  return name ? name.split(' ')[0] : 'there'
})

const formattedDate = computed(() => {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
})

const todayHabits = computed(() => habitsStore.todayHabits)
const completedHabitIds = computed(() => completionsStore.completedHabitIds)

const pendingHabits = computed(() => todayHabits.value.filter(h => !completedHabitIds.value.has(h.id)))
const completedHabits = computed(() => todayHabits.value.filter(h => completedHabitIds.value.has(h.id)))
const completedCount = computed(() => completedHabits.value.length)
const completionRate = computed(() => todayHabits.value.length > 0 ? completedCount.value / todayHabits.value.length : 0)
const allDone = computed(() => todayHabits.value.length > 0 && pendingHabits.value.length === 0)

onMounted(async () => {
  await completionsStore.fetchToday()
  loading.value = false
})

function onCompleted() {}
function onUncompleted() {}
</script>

<template>
  <q-page class="page-container">
    <div class="text-h5 text-weight-bold q-mb-sm">Analytics</div>
    <div class="text-caption text-grey q-mb-lg">Track your progress over time</div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading">
      <div class="row q-gutter-md q-mb-lg">
        <q-card flat bordered class="col stats-card">
          <q-card-section class="text-center">
            <div class="text-h3">🔥</div>
            <div class="text-h5 text-weight-bold text-primary">{{ bestStreak }}</div>
            <div class="text-caption text-grey">Best streak</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="col stats-card">
          <q-card-section class="text-center">
            <div class="text-h3">✅</div>
            <div class="text-h5 text-weight-bold text-positive">{{ totalCompletions }}</div>
            <div class="text-caption text-grey">Total done</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="col stats-card">
          <q-card-section class="text-center">
            <div class="text-h3">📅</div>
            <div class="text-h5 text-weight-bold text-info">{{ weeklyAverage }}</div>
            <div class="text-caption text-grey">Weekly avg</div>
          </q-card-section>
        </q-card>
      </div>

      <q-card flat bordered class="q-mb-lg">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-md">Habit Performance</div>
          <div v-for="habit in habitStats" :key="habit.id" class="q-mb-md">
            <div class="row items-center q-mb-xs">
              <span class="q-mr-sm">{{ habit.emoji }}</span>
              <span class="text-body2">{{ habit.name }}</span>
              <q-space />
              <span class="text-caption text-grey">{{ habit.completionRate }}%</span>
            </div>
            <q-linear-progress
              :value="habit.completionRate / 100"
              :color="habit.completionRate >= 70 ? 'positive' : habit.completionRate >= 40 ? 'warning' : 'negative'"
              track-color="grey-3"
              rounded
              size="8px"
            />
          </div>
          <div v-if="habitStats.length === 0" class="text-center text-grey q-py-md">
            No habits tracked yet
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="q-mb-lg">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-md">Last 7 Days</div>
          <div class="row q-gutter-xs justify-center">
            <div v-for="day in last7Days" :key="day.date" class="day-stat-col text-center">
              <div class="day-bar-wrap">
                <div
                  class="day-bar"
                  :style="{ height: (day.rate * 60) + 'px', background: day.rate > 0 ? '#6366f1' : '#e5e7eb' }"
                />
              </div>
              <div class="text-caption text-grey q-mt-xs">{{ day.label }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useHabitsStore } from 'src/stores/habits'
import { useCompletionsStore } from 'src/stores/completions'
import { completionService } from 'src/services/completionService'

const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()
const loading = ref(true)

const heatmapData = computed(() => completionService.buildHeatmapData(completionsStore.completions))
const totalCompletions = computed(() => Object.values(heatmapData.value).reduce((a, b) => a + b, 0))

const bestStreak = computed(() => {
  const data = heatmapData.value
  const sorted = Object.keys(data).sort()
  let best = 0, current = 0
  for (const d of sorted) {
    if (data[d] > 0) { current++; best = Math.max(best, current) }
    else current = 0
  }
  return best
})

const weeklyAverage = computed(() => {
  const total = totalCompletions.value
  const weeks = 90 / 7
  return Math.round(total / weeks)
})

const habitStats = computed(() => {
  const completions = completionsStore.completions
  return habitsStore.habits.map(h => {
    const count = completions.filter(c => c.habitId === h.id).length
    const rate = Math.min(100, Math.round((count / 90) * 100))
    return { ...h, completionCount: count, completionRate: rate }
  }).sort((a, b) => b.completionRate - a.completionRate)
})

const last7Days = computed(() => {
  const days = []
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const count = heatmapData.value[dateStr] || 0
    const maxHabits = habitsStore.habits.length || 1
    days.push({ date: dateStr, label: dayLabels[d.getDay()], count, rate: Math.min(1, count / maxHabits) })
  }
  return days
})

onMounted(async () => {
  await completionsStore.fetchLast90Days()
  loading.value = false
})
</script>

<style scoped>
.stats-card { min-width: 80px; }
.day-stat-col { width: 36px; }
.day-bar-wrap { height: 60px; display: flex; align-items: flex-end; justify-content: center; }
.day-bar { width: 24px; border-radius: 4px 4px 0 0; transition: height 0.3s ease; min-height: 4px; }
</style>

<template>
  <q-page class="page-container">
    <div class="text-h5 text-weight-bold q-mb-sm">Calendar</div>
    <div class="text-caption text-grey q-mb-lg">Your habit activity over the last 90 days</div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <q-card v-if="!loading" flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-subtitle2 q-mb-md">Activity Heatmap</div>
        <HeatmapCalendar :completion-data="heatmapData" @day-click="onDayClick" />
      </q-card-section>
    </q-card>

    <div v-if="!loading" class="row q-gutter-md q-mb-lg">
      <q-card flat bordered class="col stats-mini-card">
        <q-card-section class="text-center">
          <div class="text-h4 text-weight-bold text-primary">{{ stats.totalCompletions }}</div>
          <div class="text-caption text-grey">Total completions</div>
        </q-card-section>
      </q-card>
      <q-card flat bordered class="col stats-mini-card">
        <q-card-section class="text-center">
          <div class="text-h4 text-weight-bold text-positive">{{ stats.activeDays }}</div>
          <div class="text-caption text-grey">Active days</div>
        </q-card-section>
      </q-card>
      <q-card flat bordered class="col stats-mini-card">
        <q-card-section class="text-center">
          <div class="text-h4 text-weight-bold text-warning">{{ stats.bestStreak }}</div>
          <div class="text-caption text-grey">Best streak</div>
        </q-card-section>
      </q-card>
    </div>

    <q-dialog v-model="dayDialog">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold">{{ selectedDay?.date }}</div>
          <div class="text-caption text-grey q-mb-md">{{ selectedDay?.count }} habit{{ selectedDay?.count !== 1 ? 's' : '' }} completed</div>
          <div v-if="selectedDay?.count === 0" class="text-grey text-center q-py-md">No habits completed this day</div>
          <div v-else class="text-positive">
            <q-icon name="check_circle" />
            {{ selectedDay?.count }} habit{{ selectedDay?.count !== 1 ? 's' : '' }} completed
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCompletionsStore } from 'src/stores/completions'
import HeatmapCalendar from 'src/components/HeatmapCalendar.vue'
import { completionService } from 'src/services/completionService'

const completionsStore = useCompletionsStore()
const loading = ref(true)
const dayDialog = ref(false)
const selectedDay = ref(null)

const heatmapData = computed(() => completionService.buildHeatmapData(completionsStore.completions))

const stats = computed(() => {
  const data = heatmapData.value
  const days = Object.keys(data)
  const activeDays = days.filter(d => data[d] > 0).length
  const totalCompletions = Object.values(data).reduce((a, b) => a + b, 0)

  let bestStreak = 0
  let currentStreak = 0
  const sorted = [...days].sort()
  for (let i = 0; i < sorted.length; i++) {
    if (data[sorted[i]] > 0) {
      currentStreak++
      bestStreak = Math.max(bestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  return { totalCompletions, activeDays, bestStreak }
})

onMounted(async () => {
  await completionsStore.fetchLast90Days()
  loading.value = false
})

function onDayClick(day) {
  selectedDay.value = day
  dayDialog.value = true
}
</script>

<style scoped>
.stats-mini-card {
  min-width: 80px;
}
</style>

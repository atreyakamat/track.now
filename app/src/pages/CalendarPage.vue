<template>
  <q-page class="page-container calendar-page">
    <div class="row items-end q-col-gutter-md q-mb-lg">
      <div class="col">
        <div class="text-overline text-primary section-kicker">Calendar</div>
        <div class="text-h4 text-weight-bold">A visual memory of your consistency</div>
        <div class="text-body2 text-grey-7 q-mt-sm">
          The heatmap helps users see effort across time without drowning them in analytics.
        </div>
      </div>
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading">
      <div class="summary-grid q-mb-lg">
        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Active days</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ stats.activeDays }}</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Total completions</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ stats.totalCompletions }}</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Momentum</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ momentum.percentage }}%</div>
          </q-card-section>
        </q-card>
      </div>

      <q-card flat bordered class="calendar-card q-mb-lg">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-md">Activity heatmap</div>
          <HeatmapCalendar :completion-data="heatmapData" @day-click="onDayClick" />
        </q-card-section>
      </q-card>

      <q-card flat bordered class="calendar-card">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-md">Last 7 days</div>
          <div class="week-grid">
            <div v-for="day in last7Days" :key="day.date" class="week-day">
              <div class="text-caption text-grey-7">{{ day.label }}</div>
              <div class="text-h6 text-weight-bold q-mt-xs">{{ day.count }}</div>
              <div class="text-caption text-grey-6">completions</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <q-dialog v-model="dayDialog">
      <q-card style="min-width: 320px">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold">{{ selectedDay?.label }}</div>
          <div class="text-caption text-grey-7 q-mb-md">{{ selectedDay?.date }}</div>
          <div class="text-body2">
            {{ selectedDay?.count || 0 }} habit{{ selectedDay?.count === 1 ? '' : 's' }} completed on this day.
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
import { computed, onMounted, ref } from 'vue'
import HeatmapCalendar from 'src/components/HeatmapCalendar.vue'
import { completionService } from 'src/services/completionService'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import { calculateMomentum, getCompletionCountForDate, getDateFromKey, getDateKey, shiftDate } from 'src/utils/habitModel'

const completionsStore = useCompletionsStore()
const habitsStore = useHabitsStore()
const loading = ref(true)
const dayDialog = ref(false)
const selectedDay = ref(null)

const heatmapData = computed(() => completionService.buildHeatmapData(completionsStore.completions))
const momentum = computed(() => calculateMomentum(habitsStore.habits, completionsStore.completions))

const stats = computed(() => {
  const data = heatmapData.value
  const activeDays = Object.values(data).filter((count) => count > 0).length
  const totalCompletions = Object.values(data).reduce((sum, count) => sum + count, 0)

  return { activeDays, totalCompletions }
})

const last7Days = computed(() => {
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(new Date(), index - 6)
    const dateKey = getDateKey(date)

    return {
      date: dateKey,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      count: getCompletionCountForDate(dateKey, completionsStore.completions)
    }
  })
})

onMounted(async () => {
  await completionsStore.fetchLast90Days()
  loading.value = false
})

function onDayClick(day) {
  selectedDay.value = {
    ...day,
    label: getDateFromKey(day.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    })
  }
  dayDialog.value = true
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
.calendar-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
}

.week-day {
  padding: 14px;
  border-radius: 18px;
  background: #fbfcfd;
  border: 1px solid rgba(148, 163, 184, 0.12);
  text-align: center;
}
</style>

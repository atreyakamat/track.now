<template>
  <q-page class="mission-calendar-page">
    <div class="grain-overlay" />

    <div class="calendar-shell">
      <AppPageHeader title="Calendar" subtitle="A visual memory of your consistency across time." />

      <q-inner-loading :showing="loading">
        <q-spinner color="white" size="50px" />
      </q-inner-loading>

      <main v-if="!loading" class="calendar-main">
        <section class="summary-grid">
          <article class="summary-card pro-card">
            <span>Active Days</span>
            <strong>{{ stats.activeDays }}</strong>
          </article>

          <article class="summary-card pro-card">
            <span>Total Completions</span>
            <strong>{{ stats.totalCompletions }}</strong>
          </article>

          <article class="summary-card pro-card">
            <span>Momentum</span>
            <strong>{{ momentum.percentage }}%</strong>
          </article>
        </section>

        <section class="calendar-card pro-card">
          <div class="section-head">
            <h2>Consistency Heatmap</h2>
            <p>Click any cell to inspect that day.</p>
          </div>
          <HeatmapCalendar :completion-data="heatmapData" @day-click="onDayClick" />
        </section>

        <section class="calendar-card pro-card">
          <div class="section-head compact">
            <h2>Last 7 Days</h2>
          </div>

          <div class="week-grid">
            <article v-for="day in last7Days" :key="day.date" class="week-day">
              <span>{{ day.label }}</span>
              <strong>{{ day.count }}</strong>
              <small>completions</small>
            </article>
          </div>
        </section>
      </main>
    </div>

    <q-dialog v-model="dayDialog">
      <q-card class="dialog-card app-dialog-card" style="min-width: 320px">
        <q-card-section>
          <div class="dialog-title">{{ selectedDay?.label }}</div>
          <div class="dialog-date">{{ selectedDay?.date }}</div>
          <div class="dialog-copy">
            {{ selectedDay?.count || 0 }} habit{{ selectedDay?.count === 1 ? '' : 's' }} completed on this day.
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" color="grey-5" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import HeatmapCalendar from 'src/components/HeatmapCalendar.vue'
import AppPageHeader from 'src/components/AppPageHeader.vue'
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
.mission-calendar-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #e5e2e1;
  padding-bottom: 118px;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
}

.calendar-shell {
  position: relative;
  z-index: 1;
  max-width: 1040px;
  margin: 0 auto;
  padding: clamp(16px, 2vw, 28px);
}

.calendar-top {
  display: grid;
  gap: 10px;
  margin-bottom: 16px;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.calendar-title h1 {
  margin: 0;
  color: #fff;
  font-size: clamp(1.35rem, 3.3vw, 1.9rem);
  font-weight: 900;
  letter-spacing: -0.03em;
}

.calendar-title p {
  margin: 6px 0 0;
  color: #a0a0a6;
  font-size: 0.86rem;
  line-height: 1.45;
}

.calendar-main {
  display: grid;
  gap: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.summary-card {
  border-radius: 16px;
  padding: 12px;
  display: grid;
  gap: 6px;
}

.summary-card span {
  color: #8f8f95;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
}

.summary-card strong {
  color: #fff;
  font-size: 1.28rem;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.calendar-card {
  border-radius: 18px;
  padding: 14px;
}

.section-head {
  margin-bottom: 12px;
}

.section-head.compact {
  margin-bottom: 10px;
}

.section-head h2 {
  margin: 0;
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.section-head p {
  margin: 4px 0 0;
  color: #9999a0;
  font-size: 0.8rem;
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.week-day {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(19, 19, 19, 0.92);
  padding: 10px;
  text-align: center;
}

.week-day span {
  display: block;
  color: #8f8f95;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.week-day strong {
  display: block;
  margin-top: 5px;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 900;
}

.week-day small {
  display: block;
  margin-top: 2px;
  color: #9f9fa5;
  font-size: 0.68rem;
}

.dialog-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #121212;
  color: #fff;
}

.dialog-title {
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
}

.dialog-date {
  margin-top: 2px;
  color: #9d9da3;
  font-size: 0.76rem;
}

.dialog-copy {
  margin-top: 12px;
  color: #e4e4e8;
  font-size: 0.86rem;
}

@media (max-width: 760px) {
  .week-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 460px) {
  .week-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

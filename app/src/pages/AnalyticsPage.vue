<template>
  <q-page class="analytics-page">
    <div class="grain-overlay" />

    <div class="analytics-shell">
      <AppPageHeader reveal>
        <template #right>
          <div class="top-right">
            <span class="top-label">Analytics</span>
            <div class="avatar-chip">{{ avatarInitial }}</div>
          </div>
        </template>
      </AppPageHeader>

      <q-inner-loading :showing="loading">
        <q-spinner color="white" size="56px" />
      </q-inner-loading>

      <main v-if="!loading" class="analytics-main">
        <section class="hero-block" data-reveal>
          <h2>Missions</h2>
          <p>{{ missionNarrative }}</p>
        </section>

        <section class="chip-row" data-reveal>
          <div class="metric-chip">
            <span class="chip-dot" />
            <span>Completion Rate {{ completionRate90 }}%</span>
          </div>
          <div class="metric-chip">
            <span class="chip-dot" />
            <span>Momentum {{ momentumMultiplierLabel }}</span>
          </div>
          <div class="metric-chip">
            <span class="chip-dot chip-dot-alert" />
            <span>Mission Success {{ completedMissionCount }}</span>
          </div>
        </section>

        <section class="bento-grid" data-reveal>
          <article class="trend-card">
            <div>
              <h3>7-Day Trend</h3>
              <p>Momentum Velocity</p>
            </div>

            <div class="trend-canvas">
              <svg viewBox="0 0 800 220" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trendGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="rgba(255,255,255,0.15)" />
                    <stop offset="100%" stop-color="rgba(255,255,255,0)" />
                  </linearGradient>
                </defs>
                <path :d="trendAreaPath" fill="url(#trendGradient)" />
                <path :d="trendLinePath" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" />
              </svg>

              <div class="axis-row">
                <span v-for="point in trendPoints" :key="point.key">{{ point.label }}</span>
              </div>
            </div>
          </article>

          <div class="side-stack">
            <article class="side-card">
              <p class="side-value">{{ streakDays }}</p>
              <p class="side-label">Day Streak Active</p>
              <div class="side-track">
                <div class="side-fill" :style="{ width: `${streakProgress}%` }" />
              </div>
            </article>

            <article class="side-card">
              <div class="side-head">
                <div>
                  <p class="side-kicker">Peak Focus</p>
                  <p class="side-focus">{{ peakFocusTime }}</p>
                </div>
                <q-icon name="bolt" color="white" size="20px" />
              </div>
            </article>
          </div>
        </section>

        <section class="heatmap-card" data-reveal>
          <div class="heatmap-head">
            <div>
              <h3>Consistency Grid</h3>
              <p>90-Day Mission Log</p>
            </div>

            <div class="legend-row">
              <span>Less</span>
              <div class="legend-cells">
                <div class="legend-cell l0" />
                <div class="legend-cell l1" />
                <div class="legend-cell l2" />
                <div class="legend-cell l3" />
                <div class="legend-cell l4" />
              </div>
              <span>More</span>
            </div>
          </div>

          <div v-if="isNoData" class="heatmap-empty">
            No data yet. Complete a few missions and the consistency grid will light up.
          </div>

          <div v-else class="heatmap-scroll">
            <div class="heatmap-grid" :style="{ gridTemplateColumns: `repeat(${heatmapColumns.length}, minmax(0, 1fr))` }">
              <div v-for="(column, columnIndex) in heatmapColumns" :key="`col-${columnIndex}`" class="heatmap-column">
                <div
                  v-for="cell in column"
                  :key="cell.key"
                  class="heatmap-cell"
                  :class="heatmapClass(cell)"
                  :title="cell.tooltip"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </q-page>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import AppPageHeader from 'src/components/AppPageHeader.vue'
import {
  calculateMomentum,
  formatTimeLabel,
  getDateKey,
  getMissionProgress,
  isHabitCompleteOnDate,
  isHabitScheduledForDate,
  shiftDate
} from 'src/utils/habitModel'
import { setupRevealOnScroll } from 'src/utils/revealMotion'

const ANALYTICS_DAYS_WINDOW = 90
const TREND_DAYS = 7
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

const authStore = useAuthStore()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()

const loading = ref(true)
let cleanupReveal = null

const avatarInitial = computed(() => {
  const source = String(authStore.displayName || authStore.user?.email || 'T').trim()
  return (source[0] || 'T').toUpperCase()
})

const completionCountByDate = computed(() => {
  const map = {}
  completionsStore.completions.forEach((completion) => {
    if (completion.completed === false || !completion.date) return
    map[completion.date] = (map[completion.date] || 0) + 1
  })
  return map
})

const last90DateKeys = computed(() => {
  const dates = []
  for (let offset = ANALYTICS_DAYS_WINDOW - 1; offset >= 0; offset--) {
    dates.push(getDateKey(shiftDate(new Date(), -offset)))
  }
  return dates
})

const completionRate90 = computed(() => {
  if (habitsStore.habits.length === 0) return 0

  let scheduled = 0
  let completed = 0

  last90DateKeys.value.forEach((dateKey) => {
    const date = new Date(dateKey)
    habitsStore.habits.forEach((habit) => {
      if (!isHabitScheduledForDate(habit, date)) return

      scheduled++
      if (isHabitCompleteOnDate(habit, completionsStore.completions, dateKey)) {
        completed++
      }
    })
  })

  if (scheduled === 0) return 0
  return Math.round((completed / scheduled) * 100)
})

const trendPoints = computed(() => {
  const points = []

  for (let offset = TREND_DAYS - 1; offset >= 0; offset--) {
    const date = shiftDate(new Date(), -offset)
    const dateKey = getDateKey(date)

    let scheduled = 0
    let completed = 0

    habitsStore.habits.forEach((habit) => {
      if (!isHabitScheduledForDate(habit, date)) return

      scheduled++
      if (isHabitCompleteOnDate(habit, completionsStore.completions, dateKey)) {
        completed++
      }
    })

    const rate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0
    points.push({
      key: dateKey,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      rate
    })
  }

  return points
})

const trendLinePath = computed(() => buildTrendPaths(trendPoints.value).line)
const trendAreaPath = computed(() => buildTrendPaths(trendPoints.value).area)

const windowCurrent = computed(() => getWindowStats(0, 7))
const windowPrevious = computed(() => getWindowStats(7, 7))

const momentumMultiplier = computed(() => {
  const previousRate = windowPrevious.value.rate
  const currentRate = windowCurrent.value.rate

  if (previousRate <= 0) {
    if (currentRate <= 0) return 1
    return 1 + (currentRate / 100)
  }

  return currentRate / previousRate
})

const momentumMultiplierLabel = computed(() => `${momentumMultiplier.value.toFixed(1)}x`)

const momentum = computed(() => calculateMomentum(habitsStore.habits, completionsStore.completions))

const missionNarrative = computed(() => {
  const start = trendPoints.value[0]?.rate || 0
  const end = trendPoints.value[trendPoints.value.length - 1]?.rate || 0

  if (end > start + 4) {
    return `Momentum is trending upward. You have maintained a ${momentum.value.percentage}% focus rating over the last sequence.`
  }

  if (end < start - 4) {
    return `Momentum dipped to ${momentum.value.percentage}% this week. Tighten your mission sequence and recover the curve.`
  }

  return `Momentum is steady at ${momentum.value.percentage}%. Consistent repetitions are holding your mission baseline.`
})

const completedMissionCount = computed(() => {
  return habitsStore.habits.filter((habit) => getMissionProgress(habit, completionsStore.completions).missionDone).length
})

const streakDays = computed(() => getCompletionStreak(completionsStore.completions))
const streakProgress = computed(() => Math.min(100, Math.round((streakDays.value / 21) * 100)))

const peakFocusTime = computed(() => {
  const counts = new Map()

  completionsStore.completions.forEach((completion) => {
    if (!TIME_PATTERN.test(completion.sessionId || '')) return
    counts.set(completion.sessionId, (counts.get(completion.sessionId) || 0) + 1)
  })

  if (counts.size === 0) {
    const fallback = habitsStore.habits
      .map((habit) => habit.time)
      .find((time) => TIME_PATTERN.test(time || ''))
    return formatTimeLabel(fallback || '')
  }

  const [time] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return formatTimeLabel(time)
})

const heatmapColumns = computed(() => {
  const endDate = new Date()
  const startDate = shiftDate(endDate, -(ANALYTICS_DAYS_WINDOW - 1))
  const gridStart = shiftDate(startDate, -startDate.getDay())
  const gridEnd = shiftDate(endDate, 6 - endDate.getDay())
  const inRangeCounts = []

  const allCells = []
  let cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    const dateKey = getDateKey(cursor)
    const inRange = cursor >= startDate && cursor <= endDate
    const count = inRange ? (completionCountByDate.value[dateKey] || 0) : 0

    if (inRange) {
      inRangeCounts.push(count)
    }

    allCells.push({
      key: dateKey,
      dateKey,
      inRange,
      count,
      tooltip: `${dateKey}: ${count} completions`
    })

    cursor = shiftDate(cursor, 1)
  }

  const maxCount = Math.max(...inRangeCounts, 0)

  const withLevels = allCells.map((cell) => {
    let level = 0
    if (cell.inRange && cell.count > 0 && maxCount > 0) {
      const ratio = cell.count / maxCount
      if (ratio >= 0.85) level = 4
      else if (ratio >= 0.6) level = 3
      else if (ratio >= 0.35) level = 2
      else level = 1
    }
    return { ...cell, level }
  })

  const columns = []
  withLevels.forEach((cell, index) => {
    const columnIndex = Math.floor(index / 7)
    if (!columns[columnIndex]) columns[columnIndex] = []
    columns[columnIndex].push(cell)
  })

  return columns
})

const isNoData = computed(() => {
  return habitsStore.habits.length === 0 && completionsStore.completions.length === 0
})

onMounted(async () => {
  await completionsStore.fetchLast90Days()
  loading.value = false

  await nextTick()
  cleanupReveal = setupRevealOnScroll('.analytics-page', {
    threshold: 0.12,
    rootMargin: '0px 0px -10% 0px'
  })
})

onUnmounted(() => {
  if (cleanupReveal) {
    cleanupReveal()
    cleanupReveal = null
  }
})

function heatmapClass(cell) {
  if (!cell.inRange) return 'out-range'
  return `level-${cell.level}`
}

function buildTrendPaths(points) {
  if (!points || points.length === 0) {
    return {
      line: '',
      area: ''
    }
  }

  const width = 800
  const height = 220
  const topPad = 20
  const bottomPad = 18
  const usableHeight = height - topPad - bottomPad
  const lastIndex = Math.max(points.length - 1, 1)

  const mapped = points.map((point, index) => {
    const x = (width / lastIndex) * index
    const y = topPad + ((100 - point.rate) / 100) * usableHeight
    return [x, y]
  })

  const linePath = mapped.reduce((path, [x, y], index) => {
    return `${path}${index === 0 ? 'M' : ' L'}${x.toFixed(2)},${y.toFixed(2)}`
  }, '')

  const [firstX] = mapped[0]
  const [lastX] = mapped[mapped.length - 1]
  const areaPath = `${linePath} L${lastX.toFixed(2)},${height} L${firstX.toFixed(2)},${height} Z`

  return {
    line: linePath,
    area: areaPath
  }
}

function getWindowStats(startOffset, days) {
  if (habitsStore.habits.length === 0) {
    return { rate: 0, scheduled: 0, completed: 0 }
  }

  let scheduled = 0
  let completed = 0

  for (let offset = startOffset; offset < startOffset + days; offset++) {
    const date = shiftDate(new Date(), -offset)
    const dateKey = getDateKey(date)

    habitsStore.habits.forEach((habit) => {
      if (!isHabitScheduledForDate(habit, date)) return

      scheduled++
      if (isHabitCompleteOnDate(habit, completionsStore.completions, dateKey)) {
        completed++
      }
    })
  }

  const rate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0
  return { rate, scheduled, completed }
}

function getCompletionStreak(completions) {
  const completionDates = new Set(
    completions
      .filter((completion) => completion.completed !== false && completion.date)
      .map((completion) => completion.date)
  )

  if (completionDates.size === 0) return 0

  let streak = 0
  let cursor = new Date()
  let key = getDateKey(cursor)

  while (completionDates.has(key)) {
    streak++
    cursor = shiftDate(cursor, -1)
    key = getDateKey(cursor)
  }

  return streak
}

</script>

<style scoped lang="scss">
.analytics-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #fff;
  padding-bottom: 118px;
  overflow: hidden;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
}

.analytics-shell {
  position: relative;
  z-index: 1;
  width: min(980px, calc(100% - 28px));
  margin: 0 auto;
  padding-top: 18px;
}

.analytics-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;

  h1 {
    margin: 0;
    color: #fff;
    font-size: 1.08rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.05em;
  }
}

.top-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.top-label {
  color: #7f7f84;
  font-size: 0.86rem;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.avatar-chip {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #2a2a2a;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.analytics-main {
  display: grid;
  gap: 24px;
}

.hero-block {
  margin-bottom: 4px;

  h2 {
    margin: 0;
    font-size: clamp(3rem, 12vw, 5.4rem);
    line-height: 0.95;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  p {
    margin: 8px 0 0;
    color: #7f7f84;
    font-size: 1rem;
    max-width: 680px;
  }
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.metric-chip {
  border-radius: 999px;
  background: #1b1b1c;
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 10px 16px;
  display: inline-flex;
  align-items: center;
  gap: 10px;

  span:last-child {
    color: #fff;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #fff;
}

.chip-dot-alert {
  background: #ff3b30;
}

.bento-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 14px;
}

.trend-card,
.side-card,
.heatmap-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: #1b1b1c;
}

.trend-card {
  padding: 22px;
  min-height: 360px;
  display: grid;
  align-content: space-between;

  h3 {
    margin: 0 0 2px;
    color: #7f7f84;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-weight: 700;
  }

  p {
    margin: 0;
    color: #fff;
    font-size: 1.7rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
}

.trend-canvas {
  position: relative;
  height: 260px;
  margin-top: 10px;

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: calc(100% - 24px);
  }
}

.axis-row {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  color: #6b6b70;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.side-stack {
  display: grid;
  gap: 14px;
}

.side-card {
  padding: 22px;
  min-height: 173px;
  display: grid;
  align-content: center;
}

.side-value {
  margin: 0;
  color: #fff;
  font-size: clamp(3.1rem, 8vw, 4.2rem);
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.side-label {
  margin: 6px 0 0;
  color: #7f7f84;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-weight: 700;
}

.side-track {
  width: 100%;
  height: 2px;
  background: #353535;
  margin-top: 18px;
}

.side-fill {
  height: 100%;
  background: #fff;
}

.side-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.side-kicker {
  margin: 0 0 2px;
  color: #7f7f84;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-weight: 700;
}

.side-focus {
  margin: 0;
  color: #fff;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.heatmap-card {
  padding: 22px;
}

.heatmap-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-end;
  margin-bottom: 16px;

  h3 {
    margin: 0 0 2px;
    color: #7f7f84;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-weight: 700;
  }

  p {
    margin: 0;
    color: #fff;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
}

.legend-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #6b6b70;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.legend-cells {
  display: inline-flex;
  gap: 4px;
}

.legend-cell {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.l0 { background: #27272a; }
.l1 { background: #3f3f46; }
.l2 { background: #52525b; }
.l3 { background: #a1a1aa; }
.l4 { background: #ffffff; }

.heatmap-empty {
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: #7f7f84;
  font-size: 0.85rem;
  padding: 14px;
}

.heatmap-scroll {
  overflow-x: auto;
  padding-bottom: 4px;
}

.heatmap-grid {
  display: grid;
  gap: 4px;
  min-width: 560px;
}

.heatmap-column {
  display: grid;
  grid-template-rows: repeat(7, 1fr);
  gap: 4px;
}

.heatmap-cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: #27272a;
}

.heatmap-cell.out-range { background: #111111; }
.heatmap-cell.level-0 { background: #27272a; }
.heatmap-cell.level-1 { background: #3f3f46; }
.heatmap-cell.level-2 { background: #52525b; }
.heatmap-cell.level-3 { background: #a1a1aa; }
.heatmap-cell.level-4 { background: #ffffff; }

.reveal-target {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.reveal-target.is-visible {
  opacity: 1;
  transform: none;
}

@media (max-width: 940px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .analytics-shell {
    width: calc(100% - 20px);
  }

  .top-label {
    display: none;
  }

  .heatmap-head {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-target,
  .reveal-target.is-visible {
    transition: none;
    transform: none;
    opacity: 1;
  }
}
</style>

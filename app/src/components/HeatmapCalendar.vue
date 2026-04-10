<template>
  <div class="heatmap-wrapper">
    <div class="heatmap-months row q-mb-xs">
      <span
        v-for="month in monthLabels"
        :key="month.label + month.week"
        class="month-label text-caption text-grey"
        :style="{ width: month.width + 'px' }"
      >
        {{ month.label }}
      </span>
    </div>
    <div class="heatmap-grid">
      <div v-for="(week, wi) in weeks" :key="wi" class="heatmap-col">
        <div
          v-for="day in week"
          :key="day.date"
          class="heatmap-cell"
          :style="{ background: getCellColor(day.count) }"
          :title="`${day.date}: ${day.count} completions`"
          @click="$emit('day-click', day)"
        />
      </div>
    </div>
    <div class="heatmap-legend row items-center q-mt-sm q-gutter-xs">
      <span class="text-caption text-grey">Less</span>
      <div v-for="n in 5" :key="n" class="heatmap-cell" :style="{ background: getLegendColor(n - 1) }" />
      <span class="text-caption text-grey">More</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getDateKey, shiftDate } from 'src/utils/habitModel'

const props = defineProps({
  completionData: { type: Object, default: () => ({}) }
})

defineEmits(['day-click'])

const colors = ['#ebedf0', '#c6efce', '#6bcb77', '#2da44e', '#196127']

function getCellColor(count) {
  const idx = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4
  return colors[idx]
}

function getLegendColor(idx) {
  return colors[idx]
}

const weeks = computed(() => {
  const result = []
  const end = new Date()
  const start = shiftDate(end, -90)

  const dayOfWeek = start.getDay()
  start.setDate(start.getDate() - dayOfWeek)

  const current = new Date(start)
  let week = []

  while (current <= end) {
    const dateStr = getDateKey(current)
    week.push({
      date: dateStr,
      count: props.completionData[dateStr] || 0,
      dayOfWeek: current.getDay()
    })
    if (current.getDay() === 6) {
      result.push(week)
      week = []
    }
    current.setDate(current.getDate() + 1)
  }
  if (week.length) result.push(week)
  return result
})

const monthLabels = computed(() => {
  const labels = []
  let lastMonth = -1
  weeks.value.forEach((week, i) => {
    const firstDay = week[0]
    if (firstDay) {
      const month = new Date(firstDay.date).getMonth()
      if (month !== lastMonth) {
        labels.push({ label: new Date(firstDay.date).toLocaleString('default', { month: 'short' }), week: i })
        lastMonth = month
      }
    }
  })
  return labels.map((l, i) => ({
    ...l,
    width: ((labels[i + 1]?.week || weeks.value.length) - l.week) * 18
  }))
})
</script>

<style scoped>
.heatmap-grid {
  display: flex;
  gap: 3px;
  overflow-x: auto;
}
.heatmap-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.heatmap-cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  cursor: pointer;
  transition: transform 0.1s;
}
.heatmap-cell:hover {
  transform: scale(1.3);
}
.month-label {
  font-size: 0.65rem;
  display: inline-block;
  overflow: hidden;
}
</style>

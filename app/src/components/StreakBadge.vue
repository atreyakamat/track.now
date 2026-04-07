<template>
  <div class="streak-badge" :class="streakClass">
    <span class="streak-fire">🔥</span>
    <span class="streak-count">{{ streak }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  streak: { type: Number, default: 0 }
})

const streakClass = computed(() => {
  if (props.streak >= 30) return 'streak-legendary'
  if (props.streak >= 14) return 'streak-epic'
  if (props.streak >= 7) return 'streak-great'
  if (props.streak >= 3) return 'streak-good'
  return 'streak-new'
})
</script>

<style scoped lang="scss">
.streak-badge {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
}
.streak-legendary { background: rgba(99, 102, 241, 0.15); color: #6366f1; }
.streak-epic { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
.streak-great { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.streak-good { background: rgba(245, 158, 11, 0.15); color: #d97706; }
.streak-new { background: rgba(107, 114, 128, 0.1); color: #6b7280; }
.streak-fire { font-size: 0.9em; }
</style>

<template>
  <div class="day-selector-wrap">
    <div class="text-caption text-weight-bold text-uppercase q-mb-sm text-grey-6 letter-spacing-05">Schedule</div>
    <div class="day-pill-container glass-card q-pa-xs">
      <button
        v-for="day in days"
        :key="day.value"
        class="day-pill"
        :class="{ active: modelValue.includes(day.value) }"
        type="button"
        @click="toggleDay(day.value)"
      >
        {{ day.label.substring(0, 1) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { DAY_OPTIONS } from 'src/constants/habitMeta'

const props = defineProps({
  modelValue: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const days = DAY_OPTIONS

function toggleDay(day) {
  const current = [...props.modelValue]
  const idx = current.indexOf(day)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(day)
  }
  emit('update:modelValue', current)
}
</script>

<style scoped lang="scss">
.letter-spacing-05 {
  letter-spacing: 0.05em;
}

.day-pill-container {
  display: flex;
  justify-content: space-between;
  border-radius: 999px;
  background: rgba(20, 20, 20, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.day-pill {
  flex: 1;
  border: none;
  background: transparent;
  color: #71717a;
  font-weight: 700;
  font-size: 0.95rem;
  padding: 12px 0;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  text-transform: uppercase;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.05);
  }

  &.active {
    background: #fff;
    color: #000;
    box-shadow: 0 4px 14px rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }
}
</style>

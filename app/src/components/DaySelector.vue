<template>
  <div>
    <div class="text-subtitle2 q-mb-sm">Repeat on</div>
    <div class="row q-gutter-xs">
      <button
        v-for="day in days"
        :key="day.value"
        class="day-pill"
        :class="{ active: modelValue.includes(day.value) }"
        type="button"
        @click="toggleDay(day.value)"
      >
        {{ day.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const days = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' }
]

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

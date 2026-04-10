<template>
  <div>
    <div class="row items-center q-mb-sm">
      <div class="text-subtitle2">Reminder times</div>
      <q-space />
      <q-btn
        flat
        dense
        no-caps
        icon="add"
        label="Add time"
        color="primary"
        type="button"
        @click="addTime"
      />
    </div>

    <div class="text-caption text-grey-7 q-mb-md">
      Track.now can nudge the user before each time and again at the exact moment.
    </div>

    <div class="column q-gutter-sm">
      <div
        v-for="(time, index) in safeValue"
        :key="`${time}-${index}`"
        class="row items-center q-col-gutter-sm"
      >
        <div class="col">
          <q-input
            :model-value="time"
            type="time"
            outlined
            dense
            :label="index === 0 ? 'Primary time' : `Reminder ${index + 1}`"
            @update:model-value="updateTime(index, $event)"
          />
        </div>
        <div class="col-auto">
          <q-btn
            flat
            round
            dense
            type="button"
            icon="close"
            color="grey-7"
            :disable="safeValue.length === 1"
            @click="removeTime(index)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => ['08:00']
  }
})

const emit = defineEmits(['update:modelValue'])

const safeValue = computed(() => props.modelValue.length > 0 ? props.modelValue : ['08:00'])

function updateTime(index, value) {
  const nextTimes = [...safeValue.value]
  nextTimes[index] = value || '08:00'
  emit('update:modelValue', nextTimes)
}

function addTime() {
  const nextTimes = [...safeValue.value]
  const lastTime = nextTimes[nextTimes.length - 1] || '08:00'
  const [hours, minutes] = lastTime.split(':').map(Number)
  const nextHours = String((hours + 4) % 24).padStart(2, '0')

  nextTimes.push(`${nextHours}:${String(minutes || 0).padStart(2, '0')}`)
  emit('update:modelValue', nextTimes)
}

function removeTime(index) {
  if (safeValue.value.length === 1) return

  const nextTimes = safeValue.value.filter((_, currentIndex) => currentIndex !== index)
  emit('update:modelValue', nextTimes)
}
</script>

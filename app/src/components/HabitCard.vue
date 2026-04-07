<template>
  <q-card class="habit-card q-mb-md" :class="{ 'completed-card': isCompleted }">
    <q-card-section class="row items-center no-wrap">
      <div class="habit-emoji q-mr-md">{{ habit.emoji || '✅' }}</div>
      <div class="col">
        <div class="text-subtitle1 text-weight-bold" :class="{ 'text-grey': isCompleted }">
          {{ habit.name }}
        </div>
        <div class="row items-center q-gutter-xs q-mt-xs">
          <q-icon name="schedule" size="14px" color="grey" />
          <span class="text-caption text-grey">{{ habit.time || 'Anytime' }}</span>
          <q-chip v-if="habit.category" dense size="sm" color="primary" text-color="white" class="q-ml-xs">
            {{ habit.category }}
          </q-chip>
        </div>
      </div>
      <div class="column items-end q-gutter-sm">
        <StreakBadge :streak="habit.streak || 0" />
        <q-btn
          v-if="!isCompleted"
          round
          unelevated
          color="primary"
          icon="radio_button_unchecked"
          size="sm"
          @click="handleComplete"
          :loading="completing"
        />
        <q-btn
          v-else
          round
          unelevated
          color="positive"
          icon="check_circle"
          size="sm"
          class="complete-animation"
          @click="handleUncomplete"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import StreakBadge from './StreakBadge.vue'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'

const props = defineProps({
  habit: { type: Object, required: true },
  isCompleted: { type: Boolean, default: false }
})

const emit = defineEmits(['completed', 'uncompleted'])
const $q = useQuasar()
const completionsStore = useCompletionsStore()
const habitsStore = useHabitsStore()
const completing = ref(false)

async function handleComplete() {
  completing.value = true
  try {
    await completionsStore.markComplete(props.habit.id)
    await habitsStore.incrementStreak(props.habit.id)
    emit('completed', props.habit.id)
    $q.notify({ message: `${props.habit.emoji} ${props.habit.name} completed! 🎉`, color: 'positive', icon: 'check_circle', timeout: 2000 })
  } catch {
    $q.notify({ message: 'Failed to mark complete', color: 'negative' })
  } finally {
    completing.value = false
  }
}

async function handleUncomplete() {
  try {
    await completionsStore.unmarkComplete(props.habit.id)
    emit('uncompleted', props.habit.id)
  } catch {
    $q.notify({ message: 'Failed to update', color: 'negative' })
  }
}
</script>

<style scoped lang="scss">
.habit-card {
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  transition: all 0.2s ease;
  &:hover {
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    transform: translateY(-1px);
  }
}
.completed-card {
  opacity: 0.7;
  .body--dark & {
    opacity: 0.5;
  }
}
.habit-emoji {
  font-size: 2rem;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

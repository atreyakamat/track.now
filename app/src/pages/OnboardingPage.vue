<template>
  <q-page class="page-container">
    <div class="text-center q-py-xl">
      <div class="onboarding-emoji q-mb-lg">{{ steps[step].emoji }}</div>
      <div class="text-h5 text-weight-bold q-mb-sm">{{ steps[step].title }}</div>
      <div class="text-body1 text-grey q-mb-xl">{{ steps[step].description }}</div>

      <div v-if="step === 0">
        <q-input
          v-model="habitName"
          label="Name your first habit"
          outlined
          class="q-mb-md"
          placeholder="e.g. Morning meditation"
        />
        <EmojiPicker v-model="habitEmoji" class="q-mb-md" />
      </div>

      <div v-if="step === 1">
        <DaySelector v-model="selectedDays" class="q-mb-md" />
        <q-input v-model="habitTime" type="time" label="What time?" outlined class="q-mb-md" />
      </div>

      <div v-if="step === 2">
        <div class="success-animation q-mb-xl">🎉</div>
        <div class="text-body1 text-grey">You're all set! Start tracking your habits today.</div>
      </div>

      <div class="row q-gutter-md justify-center q-mt-xl">
        <q-btn v-if="step > 0 && step < steps.length - 1" flat label="Back" @click="step--" />
        <q-btn
          :label="step < steps.length - 1 ? 'Next' : 'Get Started'"
          color="primary"
          unelevated
          size="lg"
          :loading="loading"
          @click="handleNext"
        />
      </div>

      <div class="row justify-center q-gutter-xs q-mt-lg">
        <div v-for="i in steps.length" :key="i" class="step-dot" :class="{ active: i - 1 === step }" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useHabitsStore } from 'src/stores/habits'
import EmojiPicker from 'src/components/EmojiPicker.vue'
import DaySelector from 'src/components/DaySelector.vue'
import { DEFAULT_HABIT_FORM } from 'src/constants/habitMeta'

const router = useRouter()
const $q = useQuasar()
const habitsStore = useHabitsStore()

const step = ref(0)
const loading = ref(false)
const habitName = ref('')
const habitEmoji = ref('🏃')
const selectedDays = ref(['mon', 'tue', 'wed', 'thu', 'fri'])
const habitTime = ref('08:00')

const steps = [
  { emoji: '👋', title: 'What habit do you want to build?', description: 'Start with something small and achievable.' },
  { emoji: '📅', title: 'When will you do it?', description: 'Consistency is key. Pick your schedule.' },
  { emoji: '🚀', title: "You're ready to go!", description: 'Build your streak, one day at a time.' }
]

async function handleNext() {
  if (step.value < steps.length - 1) {
    if (step.value === 0 && !habitName.value.trim()) {
      $q.notify({ message: 'Please enter a habit name', color: 'warning' })
      return
    }
    step.value++
  } else {
    loading.value = true
    try {
      if (habitName.value.trim()) {
        await habitsStore.addHabit({
          name: habitName.value,
          emoji: habitEmoji.value,
          days: selectedDays.value,
          reminderTimes: [habitTime.value],
          category: DEFAULT_HABIT_FORM.category,
          durationDays: DEFAULT_HABIT_FORM.durationDays,
          difficulty: 'easy'
        })
      }
      router.push('/today')
    } catch {
      $q.notify({ message: 'Failed to save habit', color: 'negative' })
    } finally {
      loading.value = false
    }
  }
}
</script>

<style scoped lang="scss">
.onboarding-emoji {
  font-size: 5rem;
  animation: bounce 1s ease-in-out infinite alternate;
}
@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-12px); }
}
.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e5e7eb;
  transition: all 0.2s;
  &.active {
    background: #245c68;
    width: 24px;
    border-radius: 4px;
  }
}
.success-animation {
  font-size: 4rem;
  animation: pop 0.5s ease;
}
@keyframes pop {
  0% { transform: scale(0); }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
</style>

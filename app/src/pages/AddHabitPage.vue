<template>
  <q-page class="page-container habit-form-page">
    <div class="q-mb-lg">
      <div class="text-overline text-primary form-kicker">Mission setup</div>
      <div class="text-h4 text-weight-bold">
        {{ isEditing ? 'Refine this habit' : 'Create a new mission' }}
      </div>
      <div class="text-body2 text-grey-7 q-mt-sm">
        Keep it small, clear, and easy to act on the moment the reminder appears.
      </div>
    </div>

    <q-card
      flat
      class="mission-preview q-mb-lg"
      :style="{
        '--category-accent': selectedCategory.accent,
        '--category-soft': selectedCategory.soft
      }"
    >
      <q-card-section class="row items-center no-wrap q-col-gutter-md">
        <div class="col-auto">
          <div class="preview-emoji">{{ form.emoji }}</div>
        </div>
        <div class="col">
          <div class="text-overline" style="color: var(--category-accent)">Identity preview</div>
          <div class="text-h6 text-weight-bold">
            {{ form.name || 'Your next mission' }}
          </div>
          <div class="text-body2 text-grey-7 q-mt-xs">
            This habit supports the {{ selectedCategory.identity }} identity.
          </div>
          <div class="row q-gutter-sm q-mt-md">
            <q-chip dense square class="preview-chip">
              {{ selectedDuration.label }}
            </q-chip>
            <q-chip dense square class="preview-chip">
              {{ selectedDifficulty.label }}
            </q-chip>
            <q-chip dense square class="preview-chip">
              {{ reminderSummary }}
            </q-chip>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-form @submit="handleSubmit" class="q-gutter-lg">
      <q-card flat bordered class="setup-card">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-md">What are you building?</div>
          <q-input
            v-model="form.name"
            label="Habit name"
            outlined
            placeholder="e.g. Read 10 pages"
            :rules="[v => !!v?.trim() || 'Name is required']"
            autofocus
            class="q-mb-lg"
          />
          <EmojiPicker v-model="form.emoji" />
        </q-card-section>
      </q-card>

      <q-card flat bordered class="setup-card">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-md">When should it happen?</div>
          <DaySelector v-model="form.days" class="q-mb-lg" />
          <ReminderTimesInput v-model="form.reminderTimes" />
        </q-card-section>
      </q-card>

      <q-card flat bordered class="setup-card">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-sm">Choose a life area</div>
          <div class="text-body2 text-grey-7 q-mb-md">
            Categories shape the identity feedback shown on the Today screen.
          </div>
          <div class="choice-grid">
            <button
              v-for="category in categories"
              :key="category.value"
              type="button"
              class="choice-card"
              :class="{ active: form.category === category.value }"
              :style="{
                '--choice-accent': category.accent,
                '--choice-soft': category.soft
              }"
              @click="form.category = category.value"
            >
              <span class="text-subtitle2 text-weight-bold">{{ category.label }}</span>
              <span class="text-caption text-grey-7">{{ category.identity }}</span>
            </button>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="setup-card">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-sm">Mission shape</div>
          <div class="text-body2 text-grey-7 q-mb-md">
            Track.now treats habits as missions with a clear finish line.
          </div>

          <div class="choice-grid q-mb-lg">
            <button
              v-for="duration in durations"
              :key="duration.value"
              type="button"
              class="choice-card"
              :class="{ active: form.durationDays === duration.value }"
              @click="form.durationDays = duration.value"
            >
              <span class="text-subtitle2 text-weight-bold">{{ duration.label }}</span>
              <span class="text-caption text-grey-7">{{ duration.description }}</span>
            </button>
          </div>

          <div class="text-subtitle2 q-mb-sm">Difficulty</div>
          <div class="choice-grid">
            <button
              v-for="difficulty in difficulties"
              :key="difficulty.value"
              type="button"
              class="choice-card"
              :class="{ active: form.difficulty === difficulty.value }"
              @click="form.difficulty = difficulty.value"
            >
              <span class="text-subtitle2 text-weight-bold">{{ difficulty.label }}</span>
              <span class="text-caption text-grey-7">{{ difficulty.description }}</span>
            </button>
          </div>
        </q-card-section>
      </q-card>

      <q-btn
        type="submit"
        :label="isEditing ? 'Save changes' : 'Create mission'"
        color="primary"
        unelevated
        class="full-width"
        size="lg"
        :loading="loading"
      />

      <q-btn
        v-if="isEditing"
        flat
        label="Cancel"
        class="full-width"
        type="button"
        @click="$router.back()"
      />
    </q-form>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import EmojiPicker from 'src/components/EmojiPicker.vue'
import DaySelector from 'src/components/DaySelector.vue'
import ReminderTimesInput from 'src/components/ReminderTimesInput.vue'
import {
  CATEGORY_OPTIONS,
  DEFAULT_HABIT_FORM,
  DIFFICULTY_OPTIONS,
  DURATION_OPTIONS
} from 'src/constants/habitMeta'
import { useHabitsStore } from 'src/stores/habits'
import {
  getCategoryMeta,
  getDifficultyMeta,
  getDurationMeta,
  getReminderSummary,
  normalizeHabit,
  normalizeReminderTimes
} from 'src/utils/habitModel'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const habitsStore = useHabitsStore()

const loading = ref(false)
const isEditing = computed(() => !!route.query.edit)

const categories = CATEGORY_OPTIONS
const durations = DURATION_OPTIONS
const difficulties = DIFFICULTY_OPTIONS

const form = ref(createEmptyForm())

const selectedCategory = computed(() => getCategoryMeta(form.value.category))
const selectedDifficulty = computed(() => getDifficultyMeta(form.value.difficulty))
const selectedDuration = computed(() => getDurationMeta(form.value.durationDays))
const reminderSummary = computed(() => getReminderSummary(form.value))

onMounted(() => {
  if (!isEditing.value) return

  const habit = habitsStore.habits.find((item) => item.id === route.query.edit)

  if (!habit) return

  const normalizedHabit = normalizeHabit(habit)
  form.value = {
    name: normalizedHabit.name || '',
    emoji: normalizedHabit.emoji || DEFAULT_HABIT_FORM.emoji,
    days: [...normalizedHabit.days],
    reminderTimes: [...normalizedHabit.reminderTimes],
    category: normalizedHabit.category,
    durationDays: normalizedHabit.durationDays,
    difficulty: normalizedHabit.difficulty
  }
})

function createEmptyForm() {
  return {
    ...DEFAULT_HABIT_FORM,
    days: [...DEFAULT_HABIT_FORM.days],
    reminderTimes: [...DEFAULT_HABIT_FORM.reminderTimes]
  }
}

async function handleSubmit() {
  if (!form.value.name.trim()) {
    $q.notify({ message: 'Please enter a habit name', color: 'warning' })
    return
  }

  if (form.value.days.length === 0) {
    $q.notify({ message: 'Please select at least one day', color: 'warning' })
    return
  }

  loading.value = true

  try {
    const payload = normalizeHabit({
      ...form.value,
      name: form.value.name.trim(),
      reminderTimes: normalizeReminderTimes(form.value.reminderTimes)
    })

    if (isEditing.value) {
      await habitsStore.updateHabit(route.query.edit, payload)
      $q.notify({ message: 'Mission updated', color: 'positive' })
    } else {
      await habitsStore.addHabit(payload)
      $q.notify({ message: `${payload.emoji} Mission created`, color: 'positive' })
    }

    router.push('/habits')
  } catch {
    $q.notify({ message: 'Failed to save habit', color: 'negative' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.habit-form-page {
  padding-bottom: 96px;
}

.form-kicker {
  letter-spacing: 0.12em;
}

.mission-preview {
  border: 1px solid rgba(76, 95, 115, 0.12);
  background:
    radial-gradient(circle at top left, var(--category-soft), transparent 55%),
    #ffffff;
  border-radius: 24px;
}

.preview-emoji {
  width: 72px;
  height: 72px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  background: var(--category-soft);
}

.preview-chip {
  background: rgba(76, 95, 115, 0.08);
  color: #334155;
}

.setup-card {
  border-radius: 20px;
}

.choice-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.choice-card {
  width: 100%;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: #ffffff;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.choice-card.active {
  border-color: var(--choice-accent, #245c68);
  background: var(--choice-soft, #eef5f7);
  box-shadow: 0 14px 28px rgba(36, 92, 104, 0.08);
}

.choice-card:hover {
  transform: translateY(-1px);
}
</style>

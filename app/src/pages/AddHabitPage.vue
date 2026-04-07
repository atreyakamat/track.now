<template>
  <q-page class="page-container">
    <div class="text-h5 text-weight-bold q-mb-lg">
      {{ isEditing ? 'Edit Habit' : 'New Habit' }}
    </div>

    <q-form @submit="handleSubmit" class="q-gutter-lg">
      <q-input
        v-model="form.name"
        label="Habit name"
        outlined
        placeholder="e.g. Morning run"
        :rules="[v => !!v || 'Name is required']"
        autofocus
      />

      <EmojiPicker v-model="form.emoji" />

      <DaySelector v-model="form.days" />

      <q-input
        v-model="form.time"
        type="time"
        label="Time"
        outlined
        hint="When do you want to do this habit?"
      />

      <div>
        <div class="text-subtitle2 q-mb-sm">Category</div>
        <div class="row q-gutter-sm">
          <q-btn
            v-for="cat in categories"
            :key="cat.value"
            :label="cat.label"
            :color="form.category === cat.value ? 'primary' : 'grey-3'"
            :text-color="form.category === cat.value ? 'white' : 'dark'"
            unelevated
            size="sm"
            type="button"
            @click="form.category = cat.value"
          />
        </div>
      </div>

      <q-btn
        type="submit"
        :label="isEditing ? 'Save Changes' : 'Create Habit'"
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
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useHabitsStore } from 'src/stores/habits'
import EmojiPicker from 'src/components/EmojiPicker.vue'
import DaySelector from 'src/components/DaySelector.vue'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const habitsStore = useHabitsStore()

const loading = ref(false)
const isEditing = computed(() => !!route.query.edit)

const form = ref({
  name: '',
  emoji: '🏃',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  time: '08:00',
  category: 'general'
})

const categories = [
  { value: 'general', label: '📋 General' },
  { value: 'fitness', label: '💪 Fitness' },
  { value: 'mindfulness', label: '🧘 Mindfulness' },
  { value: 'study', label: '📚 Study' },
  { value: 'nutrition', label: '🥗 Nutrition' },
  { value: 'social', label: '👥 Social' },
  { value: 'creativity', label: '🎨 Creativity' },
  { value: 'finance', label: '💰 Finance' }
]

onMounted(async () => {
  if (isEditing.value) {
    const habit = habitsStore.habits.find(h => h.id === route.query.edit)
    if (habit) {
      form.value = {
        name: habit.name,
        emoji: habit.emoji,
        days: [...(habit.days || [])],
        time: habit.time,
        category: habit.category
      }
    }
  }
})

async function handleSubmit() {
  if (form.value.days.length === 0) {
    $q.notify({ message: 'Please select at least one day', color: 'warning' })
    return
  }

  loading.value = true
  try {
    if (isEditing.value) {
      await habitsStore.updateHabit(route.query.edit, form.value)
      $q.notify({ message: 'Habit updated! ✅', color: 'positive' })
    } else {
      await habitsStore.addHabit(form.value)
      $q.notify({ message: `${form.value.emoji} Habit created! 🎉`, color: 'positive' })
    }
    router.push('/habits')
  } catch {
    $q.notify({ message: 'Failed to save habit', color: 'negative' })
  } finally {
    loading.value = false
  }
}
</script>

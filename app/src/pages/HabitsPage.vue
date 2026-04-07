<template>
  <q-page class="page-container">
    <div class="row items-center q-mb-lg">
      <div class="col">
        <div class="text-h5 text-weight-bold">My Habits</div>
        <div class="text-caption text-grey">{{ habits.length }} habit{{ habits.length !== 1 ? 's' : '' }} tracked</div>
      </div>
      <q-btn icon="add" color="primary" unelevated round to="/add" />
    </div>

    <q-tabs v-model="tab" active-color="primary" indicator-color="primary" align="left" class="q-mb-md">
      <q-tab name="all" label="All" />
      <q-tab name="daily" label="Daily" />
      <q-tab name="weekly" label="Weekly" />
    </q-tabs>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading && filteredHabits.length === 0" class="text-center q-py-xl">
      <div class="text-h3 q-mb-md">📝</div>
      <div class="text-h6 text-weight-bold q-mb-sm">No habits yet</div>
      <div class="text-grey q-mb-lg">Start building your first habit!</div>
      <q-btn label="Add Habit" color="primary" unelevated icon="add" to="/add" />
    </div>

    <q-list v-else class="q-gutter-sm">
      <q-card
        v-for="habit in filteredHabits"
        :key="habit.id"
        class="habit-card"
        flat
        bordered
      >
        <q-card-section class="row items-center no-wrap">
          <div class="text-h4 q-mr-md">{{ habit.emoji }}</div>
          <div class="col">
            <div class="text-subtitle1 text-weight-bold">{{ habit.name }}</div>
            <div class="row q-gutter-xs items-center">
              <q-badge v-for="day in habit.days" :key="day" color="primary" :label="day" outline />
            </div>
            <div class="text-caption text-grey q-mt-xs">⏰ {{ habit.time || 'Anytime' }}</div>
          </div>
          <div class="column items-end q-gutter-xs">
            <StreakBadge :streak="habit.streak || 0" />
            <div class="row q-gutter-xs">
              <q-btn flat round dense icon="edit" size="sm" color="grey" @click="editHabit(habit)" />
              <q-btn flat round dense icon="delete" size="sm" color="negative" @click="confirmDelete(habit)" />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-list>

    <q-dialog v-model="deleteDialog">
      <q-card>
        <q-card-section>
          <div class="text-h6">Delete Habit</div>
          <div class="q-mt-sm">Are you sure you want to delete "{{ habitToDelete?.name }}"? This cannot be undone.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated label="Delete" color="negative" @click="handleDelete" :loading="deleting" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useHabitsStore } from 'src/stores/habits'
import StreakBadge from 'src/components/StreakBadge.vue'

const router = useRouter()
const $q = useQuasar()
const habitsStore = useHabitsStore()

const tab = ref('all')
const deleteDialog = ref(false)
const habitToDelete = ref(null)
const deleting = ref(false)

const loading = computed(() => habitsStore.loading)
const habits = computed(() => habitsStore.habits)

const filteredHabits = computed(() => {
  if (tab.value === 'daily') return habits.value.filter(h => h.days?.length === 7)
  if (tab.value === 'weekly') return habits.value.filter(h => h.days?.length < 7)
  return habits.value
})

function editHabit(habit) {
  router.push({ path: '/add', query: { edit: habit.id } })
}

function confirmDelete(habit) {
  habitToDelete.value = habit
  deleteDialog.value = true
}

async function handleDelete() {
  deleting.value = true
  try {
    await habitsStore.deleteHabit(habitToDelete.value.id)
    deleteDialog.value = false
    $q.notify({ message: 'Habit deleted', color: 'positive' })
  } catch {
    $q.notify({ message: 'Failed to delete', color: 'negative' })
  } finally {
    deleting.value = false
  }
}
</script>

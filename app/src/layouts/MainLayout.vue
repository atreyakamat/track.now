<template>
  <q-layout view="lHh lpr lFf">
    <q-header class="header-bar">
      <q-toolbar>
        <q-toolbar-title class="brand-lockup text-weight-bold cursor-pointer" @click="$router.push('/dashboard')">
          <span class="brand-mark" />
          <span>Track.now</span>
        </q-toolbar-title>
        <q-btn flat round dense @click="toggleDark">
          <q-icon :name="$q.dark.isActive ? 'light_mode' : 'dark_mode'" />
        </q-btn>
        <NotificationBell />
        <q-btn flat round dense icon="more_vert">
          <q-menu>
            <q-list style="min-width: 220px">
              <q-item clickable v-close-popup @click="$router.push('/dashboard')">
                <q-item-section avatar><q-icon name="dashboard" /></q-item-section>
                <q-item-section>Dashboard</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/planner')">
                <q-item-section avatar><q-icon name="view_week" /></q-item-section>
                <q-item-section>Planner</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/tasks')">
                <q-item-section avatar><q-icon name="task" /></q-item-section>
                <q-item-section>
                  Tasks
                  <q-badge v-if="tasksStore.openTasks.length > 0" color="negative" :label="tasksStore.openTasks.length" />
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/habits')">
                <q-item-section avatar><q-icon name="list" /></q-item-section>
                <q-item-section>My Habits</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/calendar')">
                <q-item-section avatar><q-icon name="calendar_month" /></q-item-section>
                <q-item-section>Calendar</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/analytics')">
                <q-item-section avatar><q-icon name="bar_chart" /></q-item-section>
                <q-item-section>Analytics</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/notifications')">
                <q-item-section avatar><q-icon name="notifications" /></q-item-section>
                <q-item-section>Notifications</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/settings')">
                <q-item-section avatar><q-icon name="settings" /></q-item-section>
                <q-item-section>Settings</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/friends')">
                <q-item-section avatar><q-icon name="people" /></q-item-section>
                <q-item-section>Friends</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/groups')">
                <q-item-section avatar><q-icon name="group" /></q-item-section>
                <q-item-section>Groups</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/family')">
                <q-item-section avatar><q-icon name="family_restroom" /></q-item-section>
                <q-item-section>Family <q-badge color="primary" label="PRO" /></q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/pricing')">
                <q-item-section avatar><q-icon name="sell" /></q-item-section>
                <q-item-section>Pricing</q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable v-close-popup @click="handleLogout">
                <q-item-section avatar><q-icon name="logout" /></q-item-section>
                <q-item-section>Log Out</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-page-container style="padding-bottom: 80px">
      <router-view />
    </q-page-container>

    <div class="bottom-nav row items-center justify-around q-pa-sm">
      <q-btn flat :color="isActive('/today') ? 'primary' : 'grey'" stack no-caps @click="$router.push('/today')">
        <q-icon name="home" size="24px" />
        <span class="text-caption">Today</span>
      </q-btn>
      <q-btn flat :color="isActive('/tasks') ? 'primary' : 'grey'" stack no-caps @click="$router.push('/tasks')">
        <q-icon name="task_alt" size="24px" />
        <span class="text-caption">Tasks</span>
      </q-btn>
      <div class="add-btn-wrap">
        <q-btn class="add-btn-fab" unelevated round icon="add" @click="$router.push('/add')" />
      </div>
      <q-btn flat :color="isActive('/habits') ? 'primary' : 'grey'" stack no-caps @click="$router.push('/habits')">
        <q-icon name="format_list_bulleted" size="24px" />
        <span class="text-caption">Habits</span>
      </q-btn>
      <q-btn flat :color="isActive('/planner') ? 'primary' : 'grey'" stack no-caps @click="$router.push('/planner')">
        <q-icon name="view_week" size="24px" />
        <span class="text-caption">Plan</span>
      </q-btn>
    </div>
  </q-layout>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { notificationService } from 'src/services/notificationService'
import { useAuthStore } from 'src/stores/auth'
import { usePreferencesStore } from 'src/stores/preferences'
import { useHabitsStore } from 'src/stores/habits'
import { useCompletionsStore } from 'src/stores/completions'
import { useTasksStore } from 'src/stores/tasks'
import { computed, onMounted, onUnmounted, watch } from 'vue'
import NotificationBell from 'src/components/NotificationBell.vue'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()
const tasksStore = useTasksStore()
const reminderOptions = computed(() => ({
  preReminder: preferencesStore.preferences.reminderPreview,
  exactReminder: preferencesStore.preferences.exactReminders,
  requestPermission: false,
  completedSessionIdsByHabit: completionsStore.todayCompletions.reduce((map, completion) => {
    if (!completion?.habitId || !completion?.sessionId) return map
    if (!map[completion.habitId]) {
      map[completion.habitId] = []
    }
    map[completion.habitId].push(completion.sessionId)
    return map
  }, {})
}))
const reminderSignature = computed(() => habitsStore.todayHabits
  .map((habit) => `${habit.id}:${(habit.reminderTimes || [habit.time]).join(',')}`)
  .join('|'))
const completionSignature = computed(() => completionsStore.todayCompletions
  .map((completion) => `${completion.habitId}:${completion.sessionId || 'legacy'}`)
  .sort()
  .join('|'))

onMounted(async () => {
  habitsStore.subscribe()
  tasksStore.subscribe()
  await completionsStore.fetchToday()
  await authStore.loadProfile()
})
onUnmounted(() => {
  habitsStore.unsubscribeAll()
  tasksStore.unsubscribeAll()
})

watch(() => [
  reminderSignature.value,
  completionSignature.value,
  reminderOptions.value.preReminder,
  reminderOptions.value.exactReminder
], async () => {
  const todayHabits = habitsStore.todayHabits
  const options = reminderOptions.value
  if (!Array.isArray(todayHabits) || todayHabits.length === 0) {
    habitsStore.habits.forEach((habit) => notificationService.cancelHabitReminder(habit.id))
    return
  }
  await notificationService.scheduleAll(todayHabits, options)
})

function isActive(path) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function toggleDark() {
  $q.dark.toggle()
  localStorage.setItem('dark-mode', $q.dark.isActive)
  preferencesStore.updatePreference('themePreference', $q.dark.isActive ? 'dark' : 'light')
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped lang="scss">
.header-bar {
  background: rgba(255, 255, 255, 0.9);
  color: #111827;
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(36, 92, 104, 0.08);
  .body--dark & {
    background: #1a1a1a;
    color: #f9fafb;
  }
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  background: linear-gradient(135deg, #245c68, #d17a3c);
  box-shadow: 0 0 0 6px rgba(36, 92, 104, 0.08);
}

.add-btn-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

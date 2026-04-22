<template>
  <q-layout view="lHh lpr lFf" class="main-layout-shell">
    <q-header class="common-header" elevated="false">
      <q-toolbar class="toolbar-shell">
        <button type="button" class="brand-button" @click="$router.push('/today')">
          <span class="brand-dot" />
          <span class="brand-text">Track.now</span>
        </button>

        <div class="toolbar-title">{{ currentTitle }}</div>

        <div class="toolbar-actions">
          <q-btn flat round dense class="icon-btn" @click="toggleDark">
            <q-icon :name="$q.dark.isActive ? 'light_mode' : 'dark_mode'" />
          </q-btn>

          <NotificationBell />

          <div class="avatar-chip">{{ avatarInitial }}</div>

          <q-btn flat round dense class="icon-btn" icon="more_horiz">
            <q-menu class="menu-surface">
              <q-list style="min-width: 220px">
                <q-item clickable v-close-popup @click="$router.push('/dashboard')">
                  <q-item-section avatar><q-icon name="dashboard" /></q-item-section>
                  <q-item-section>Dashboard</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="$router.push('/planner')">
                  <q-item-section avatar><q-icon name="event" /></q-item-section>
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
                  <q-item-section avatar><q-icon name="repeat" /></q-item-section>
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
                  <q-item-section avatar><q-icon name="groups" /></q-item-section>
                  <q-item-section>Groups</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="$router.push('/family')">
                  <q-item-section avatar><q-icon name="family_restroom" /></q-item-section>
                  <q-item-section>Family</q-item-section>
                </q-item>

                <q-separator dark />

                <q-item clickable v-close-popup @click="$router.push('/pricing')">
                  <q-item-section avatar><q-icon name="workspace_premium" /></q-item-section>
                  <q-item-section>
                    PRO
                    <q-badge color="primary" :label="String(authStore.currentPlan || 'free').toUpperCase()" />
                  </q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="$router.push('/pricing')">
                  <q-item-section avatar><q-icon name="payments" /></q-item-section>
                  <q-item-section>Pricing</q-item-section>
                </q-item>
                <q-separator dark />
                <q-item clickable v-close-popup @click="handleLogout">
                  <q-item-section avatar><q-icon name="logout" /></q-item-section>
                  <q-item-section>Log Out</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container class="main-page-shell">
      <router-view />
    </q-page-container>

    <div class="common-bottom-nav-wrap">
      <div class="common-bottom-nav row items-end justify-around q-px-sm">
        <q-btn flat no-caps class="nav-entry" :class="{ active: isActive('/today') }" @click="$router.push('/today')">
          <q-icon name="today" size="23px" />
          <span>Today</span>
        </q-btn>

        <q-btn flat no-caps class="nav-entry" :class="{ active: isActive('/tasks') }" @click="$router.push('/tasks')">
          <q-icon name="assignment" size="23px" />
          <span>Tasks</span>
        </q-btn>

        <div class="center-fab-wrap">
          <q-btn class="center-fab" unelevated icon="add" @click="$router.push('/add')" />
        </div>

        <q-btn flat no-caps class="nav-entry" :class="{ active: isActive('/habits') }" @click="$router.push('/habits')">
          <q-icon name="repeat" size="23px" />
          <span>Habits</span>
        </q-btn>

        <q-btn flat no-caps class="nav-entry" :class="{ active: isActive('/planner') }" @click="$router.push('/planner')">
          <q-icon name="event" size="23px" />
          <span>Planner</span>
        </q-btn>
      </div>
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
import { computed, onUnmounted, watch } from 'vue'
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
const routeTitleMap = {
  '/today': 'Today',
  '/tasks': 'Tasks',
  '/add': 'New Mission',
  '/habits': 'My Habits',
  '/planner': 'Planner',
  '/friends': 'Friends',
  '/analytics': 'Analytics',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
  '/groups': 'Groups',
  '/family': 'Family',
  '/dashboard': 'Dashboard',
  '/calendar': 'Calendar',
  '/pricing': 'Pricing'
}

let reminderSyncTimer = null

const currentTitle = computed(() => {
  const matched = Object.entries(routeTitleMap).find(([path]) => {
    return route.path === path || route.path.startsWith(`${path}/`)
  })

  return matched?.[1] || 'Track.now'
})

const avatarInitial = computed(() => {
  const seed = String(authStore.displayName || authStore.user?.email || 'T').trim()
  return (seed[0] || 'T').toUpperCase()
})

async function syncReminders() {
  const todayHabits = habitsStore.todayHabits
  const options = reminderOptions.value

  if (!Array.isArray(todayHabits) || todayHabits.length === 0) {
    habitsStore.habits.forEach((habit) => notificationService.cancelHabitReminder(habit.id))
    return
  }

  await notificationService.scheduleAll(todayHabits, options)
}

onUnmounted(() => {
  if (reminderSyncTimer) {
    clearTimeout(reminderSyncTimer)
    reminderSyncTimer = null
  }
  habitsStore.unsubscribeAll()
  tasksStore.unsubscribeAll()
})

watch(() => authStore.userId, async (userId, previousUserId) => {
  if (previousUserId && previousUserId !== userId) {
    habitsStore.unsubscribeAll()
    tasksStore.unsubscribeAll()
  }

  if (!userId) {
    return
  }

  habitsStore.subscribe()
  tasksStore.subscribe()
  await Promise.all([
    completionsStore.fetchToday(),
    authStore.loadProfile()
  ])
}, {
  immediate: true
})

watch(() => [
  reminderSignature.value,
  completionSignature.value,
  reminderOptions.value.preReminder,
  reminderOptions.value.exactReminder
], () => {
  if (reminderSyncTimer) {
    clearTimeout(reminderSyncTimer)
  }
  reminderSyncTimer = setTimeout(() => {
    void syncReminders()
  }, 120)
}, {
  immediate: true
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
.common-header {
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.toolbar-shell {
  min-height: 62px;
  padding-inline: clamp(8px, 2vw, 14px);
}

.brand-button {
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
}

.brand-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #fff;
}

.brand-text {
  color: #fff;
  font-size: 1rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.05em;
}

.toolbar-title {
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.icon-btn {
  color: #d4d4d4;
}

.avatar-chip {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #1d1d1d;
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 700;
}

.main-page-shell {
  padding-bottom: 96px;
}

.common-bottom-nav-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  padding: 0 12px calc(env(safe-area-inset-bottom) + 8px);
  pointer-events: none;
}

.common-bottom-nav {
  max-width: 560px;
  margin: 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 28px;
  background: rgba(11, 11, 11, 0.82);
  backdrop-filter: blur(18px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  min-height: 76px;
  pointer-events: auto;
}

.nav-entry {
  min-width: 62px;
  color: #777;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding-bottom: 8px;

  span {
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
  }
}

.nav-entry.active {
  color: #fff;
}

.center-fab-wrap {
  transform: translateY(-18px);
}

.center-fab {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: #fff;
  color: #000;
  box-shadow: 0 20px 38px rgba(0, 0, 0, 0.45);
}

.menu-surface :deep(.q-list) {
  background: #0f0f0f;
  color: #fff;
}

@media (max-width: 680px) {
  .toolbar-title {
    display: none;
  }

  .nav-entry span {
    display: none;
  }
}
</style>

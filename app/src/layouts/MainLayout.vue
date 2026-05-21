<template>
  <q-layout view="lHh lpr lFf" class="main-layout-shell">
    <q-header class="main-header" elevated="false">
      <div class="header-floating-pill">
        <button type="button" class="brand-link" @click="$router.push('/today')">
          <div class="brand-dot" />
          <span class="brand-name">Track.now</span>
        </button>

        <div class="header-divider" v-if="currentTitle" />
        <div class="header-page-title" v-if="currentTitle">{{ currentTitle }}</div>

        <div class="header-actions">
          <q-btn flat round dense class="header-btn" @click="toggleDark">
            <q-icon :name="$q.dark.isActive ? 'light_mode' : 'dark_mode'" size="20px" />
          </q-btn>

          <NotificationBell />

          <button class="profile-trigger" @click="$router.push('/settings')">
            <div class="avatar-circle">{{ avatarInitial }}</div>
          </button>

          <q-btn flat round dense class="header-btn" icon="more_horiz">
            <q-menu class="menu-surface glass-card" transition-show="scale" transition-hide="scale">
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
                <q-separator dark class="q-my-xs" />
                <q-item clickable v-close-popup @click="$router.push('/pricing')">
                  <q-item-section avatar><q-icon name="workspace_premium" /></q-item-section>
                  <q-item-section>Premium Protocol</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="handleLogout">
                  <q-item-section avatar><q-icon name="logout" /></q-item-section>
                  <q-item-section>Log Out</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </div>
    </q-header>

    <q-page-container class="main-page-shell">
      <router-view v-slot="{ Component }">
        <transition name="fade-slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </q-page-container>

    <nav class="floating-bottom-nav">
      <div class="nav-pulse-container">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="nav-pulse-item"
          :class="{ active: isActive(item.path) }"
          @click="$router.push(item.path)"
        >
          <div class="item-icon-wrap">
            <q-icon :name="isActive(item.path) ? item.activeIcon : item.icon" size="24px" />
          </div>
          <span class="item-label">{{ item.label }}</span>
          <div class="active-indicator" v-if="isActive(item.path)" />
        </button>

        <div class="nav-pulse-center">
          <q-btn
            round
            unelevated
            class="pulse-fab"
            icon="add"
            @click="$router.push('/add')"
          />
        </div>
      </div>
    </nav>
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

const navItems = [
  { label: 'Today', path: '/today', icon: 'today', activeIcon: 'today' },
  { label: 'Tasks', path: '/tasks', icon: 'assignment_outlined', activeIcon: 'assignment' },
  { label: 'Habits', path: '/habits', icon: 'repeat', activeIcon: 'repeat' },
  { label: 'Planner', path: '/planner', icon: 'event_note', activeIcon: 'event' }
]

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
  '/today': 'Focus',
  '/tasks': 'Mission',
  '/add': 'Command',
  '/habits': 'Protocols',
  '/planner': 'Tactics',
  '/friends': 'Social',
  '/analytics': 'Intelligence',
  '/notifications': 'Alerts',
  '/settings': 'Systems',
  '/groups': 'Units',
  '/family': 'Clan',
  '/dashboard': 'Overview',
  '/calendar': 'Chronos',
  '/pricing': 'Premium'
}

let reminderSyncTimer = null

const currentTitle = computed(() => {
  const matched = Object.entries(routeTitleMap).find(([path]) => {
    return route.path === path || route.path.startsWith(`${path}/`)
  })
  return matched?.[1] || ''
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
  }
  habitsStore.unsubscribeAll()
  tasksStore.unsubscribeAll()
})

watch(() => authStore.userId, async (userId, previousUserId) => {
  if (previousUserId && previousUserId !== userId) {
    habitsStore.unsubscribeAll()
    tasksStore.unsubscribeAll()
  }
  if (!userId) return
  habitsStore.subscribe()
  tasksStore.subscribe()
  await Promise.all([
    completionsStore.fetchToday(),
    authStore.loadProfile()
  ])
}, { immediate: true })

watch(() => [
  reminderSignature.value,
  completionSignature.value,
  reminderOptions.value.preReminder,
  reminderOptions.value.exactReminder
], () => {
  if (reminderSyncTimer) clearTimeout(reminderSyncTimer)
  reminderSyncTimer = setTimeout(() => {
    void syncReminders()
  }, 120)
}, { immediate: true })

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
/* --- Header Styles --- */
.main-header {
  background: transparent !important;
  padding: 12px 16px 0;
  pointer-events: none;
}

.header-floating-pill {
  pointer-events: auto;
  max-width: 1120px;
  margin: 0 auto;
  height: 60px;
  background: rgba(10, 10, 10, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 22px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.brand-link {
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 0;
}

.brand-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.brand-name {
  color: #fff;
  font-size: 0.95rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.04em;
}

.header-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 16px;
}

.header-page-title {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #222;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  display: grid;
  place-items: center;
}

/* --- Navigation Bar - BRUTE FORCE MOBILE FIX --- */
.floating-bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999; /* Max priority */
  pointer-events: none;
  display: flex;
  justify-content: center;
}

.nav-pulse-container {
  pointer-events: auto;
  width: 100%;
  max-width: 600px;
  height: 84px; /* Taller for better hit targets */
  background: #000; /* Solid black for perfect mobile visibility */
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  padding: 0 10px calc(env(safe-area-inset-bottom, 0px) / 2);
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.8);
  
  /* On larger mobile/tablet, make it a floating pill again but with solid bg */
  @media (min-width: 641px) {
    margin: 0 20px 20px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 40px;
    height: 76px;
    padding-bottom: 0;
  }
}

.nav-pulse-item {
  border: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #666; /* High contrast inactive */
  cursor: pointer;
  min-width: 64px;
  transition: all 0.2s ease;
  padding: 8px 0;

  &.active {
    color: #fff;
    .item-icon-wrap {
      transform: scale(1.1);
    }
  }
}

.item-label {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nav-pulse-center {
  position: relative;
  z-index: 10;
  margin-top: -30px; /* Overhang effect */
}

.pulse-fab {
  background: #fff !important;
  color: #000 !important;
  width: 60px;
  height: 60px;
  font-size: 24px;
  border: 4px solid #000;
  box-shadow: 0 10px 25px rgba(255, 255, 255, 0.3);
}

.main-page-shell {
  padding-bottom: 120px; /* Ensure content doesn't get hidden */
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 480px) {
  .nav-pulse-item {
    min-width: 50px;
    .item-label {
      font-size: 0.6rem;
    }
  }
  .pulse-fab {
    width: 54px;
    height: 54px;
  }
}
</style>

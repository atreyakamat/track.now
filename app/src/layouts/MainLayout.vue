<template>
  <q-layout view="lHh lpr lFf">
    <q-header class="header-bar">
      <q-toolbar>
        <q-toolbar-title class="brand-lockup text-weight-bold">
          <span class="brand-mark" />
          <span>Track.now</span>
        </q-toolbar-title>
        <q-btn flat round dense @click="toggleDark">
          <q-icon :name="$q.dark.isActive ? 'light_mode' : 'dark_mode'" />
        </q-btn>
        <NotificationBell />
        <q-btn flat round dense icon="more_vert">
          <q-menu>
            <q-list style="min-width: 180px">
              <q-item clickable v-close-popup @click="$router.push('/habits')">
                <q-item-section avatar><q-icon name="list" /></q-item-section>
                <q-item-section>My Habits</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="$router.push('/analytics')">
                <q-item-section avatar><q-icon name="bar_chart" /></q-item-section>
                <q-item-section>Analytics</q-item-section>
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
      <q-btn flat :color="isActive('/habits') ? 'primary' : 'grey'" stack no-caps @click="$router.push('/habits')">
        <q-icon name="format_list_bulleted" size="24px" />
        <span class="text-caption">Habits</span>
      </q-btn>
      <div class="add-btn-wrap">
        <q-btn class="add-btn-fab" unelevated round icon="add" @click="$router.push('/add')" />
      </div>
      <q-btn flat :color="isActive('/calendar') ? 'primary' : 'grey'" stack no-caps @click="$router.push('/calendar')">
        <q-icon name="calendar_month" size="24px" />
        <span class="text-caption">Calendar</span>
      </q-btn>
      <q-btn flat :color="isActive('/analytics') ? 'primary' : 'grey'" stack no-caps @click="$router.push('/analytics')">
        <q-icon name="bar_chart" size="24px" />
        <span class="text-caption">Stats</span>
      </q-btn>
    </div>
  </q-layout>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'
import { useHabitsStore } from 'src/stores/habits'
import { onMounted, onUnmounted } from 'vue'
import NotificationBell from 'src/components/NotificationBell.vue'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const habitsStore = useHabitsStore()

onMounted(() => habitsStore.subscribe())
onUnmounted(() => habitsStore.unsubscribeAll())

function isActive(path) {
  return route.path === path
}

function toggleDark() {
  $q.dark.toggle()
  localStorage.setItem('dark-mode', $q.dark.isActive)
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

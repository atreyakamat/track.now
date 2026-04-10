<template>
  <q-page class="page-container settings-page">
    <div class="row items-end q-col-gutter-md q-mb-lg">
      <div class="col">
        <div class="text-overline text-primary section-kicker">Settings</div>
        <div class="text-h4 text-weight-bold">Make Track.now feel like yours</div>
        <div class="text-body2 text-grey-7 q-mt-sm">
          Adjust startup behavior, theme preference, and account basics without making the product heavier.
        </div>
      </div>
    </div>

    <div class="row q-col-gutter-lg">
      <div class="col-12 col-lg-5">
        <q-card flat bordered class="settings-card q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Account</div>
            <div class="text-body1 text-weight-bold">{{ authStore.displayName || 'Track.now user' }}</div>
            <div class="text-body2 text-grey-7">{{ authStore.user?.email || 'No email loaded' }}</div>
            <div class="row q-gutter-sm q-mt-md">
              <q-chip dense square class="meta-chip">Plan: {{ authStore.currentPlan }}</q-chip>
              <q-chip dense square class="meta-chip">Start page: {{ preferences.startPage }}</q-chip>
            </div>
            <q-btn class="q-mt-md" flat no-caps icon="credit_card" label="Manage plan" to="/pricing" />
          </q-card-section>
        </q-card>

        <q-card flat bordered class="settings-card">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Accessibility</div>
            <q-toggle
              :model-value="preferences.reduceMotion"
              label="Reduce motion"
              @update:model-value="preferencesStore.updatePreference('reduceMotion', $event)"
            />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-lg-7">
        <q-card flat bordered class="settings-card q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Startup</div>
            <q-btn-toggle
              :model-value="preferences.startPage"
              spread
              no-caps
              unelevated
              toggle-color="primary"
              color="grey-3"
              text-color="dark"
              :options="startPageOptions"
              @update:model-value="preferencesStore.updatePreference('startPage', $event)"
            />
          </q-card-section>
        </q-card>

        <q-card flat bordered class="settings-card q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Theme</div>
            <q-btn-toggle
              :model-value="preferences.themePreference"
              spread
              no-caps
              unelevated
              toggle-color="primary"
              color="grey-3"
              text-color="dark"
              :options="themeOptions"
              @update:model-value="applyTheme"
            />
          </q-card-section>
        </q-card>

        <q-card flat bordered class="settings-card">
          <q-card-section class="row items-center">
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">Session</div>
              <div class="text-body2 text-grey-7 q-mt-sm">
                Sign out safely when switching devices or testing launch builds.
              </div>
            </div>
            <div class="col-auto">
              <q-btn color="negative" unelevated no-caps icon="logout" label="Log out" @click="handleLogout" />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { usePreferencesStore } from 'src/stores/preferences'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

const preferences = computed(() => preferencesStore.preferences)

const startPageOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Planner', value: 'planner' }
]

const themeOptions = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' }
]

onMounted(() => authStore.loadProfile())

function applyTheme(value) {
  preferencesStore.updatePreference('themePreference', value)

  if (value === 'dark') {
    $q.dark.set(true)
    localStorage.setItem('dark-mode', 'true')
    return
  }

  if (value === 'light') {
    $q.dark.set(false)
    localStorage.setItem('dark-mode', 'false')
    return
  }

  localStorage.removeItem('dark-mode')
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  $q.dark.set(prefersDark)
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped lang="scss">
.section-kicker {
  letter-spacing: 0.12em;
}

.settings-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.meta-chip {
  background: rgba(76, 95, 115, 0.08);
  color: #334155;
}
</style>

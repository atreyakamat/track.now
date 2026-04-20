<template>
  <q-page class="profile-home-page">
    <div class="grain-overlay" />

    <div class="profile-shell">
      <AppPageHeader reveal>
        <template #right>
          <div class="avatar-mini">
            <img v-if="profilePhoto" :src="profilePhoto" alt="Profile" />
            <span v-else>{{ avatarInitial }}</span>
          </div>
        </template>
      </AppPageHeader>

      <q-inner-loading :showing="loading">
        <q-spinner color="white" size="56px" />
      </q-inner-loading>

      <main v-if="!loading" class="profile-main">
        <section class="hero-section" data-reveal>
          <div class="hero-avatar-wrap">
            <div class="hero-avatar heavy-shadow">
              <img v-if="profilePhoto" :src="profilePhoto" alt="Profile portrait" />
              <span v-else>{{ avatarInitial }}</span>
            </div>
            <div class="status-dot" />
          </div>

          <div class="hero-copy">
            <h2>{{ displayName }}</h2>
            <p>{{ levelLabel }}</p>
          </div>

          <div class="stats-grid">
            <article class="stat-card">
              <span>Missions</span>
              <strong>{{ missionsCount }}</strong>
            </article>
            <article class="stat-card">
              <span>Streak</span>
              <strong>{{ streakLabel }}</strong>
            </article>
            <article class="stat-card">
              <span>Focus</span>
              <strong>{{ focusLabel }}</strong>
            </article>
            <article class="stat-card">
              <span>Rank</span>
              <strong>{{ rankLabel }}</strong>
            </article>
          </div>
        </section>

        <section class="trophy-section" data-reveal>
          <div class="section-head">
            <h3>Mission Archival</h3>
            <span>{{ unlockedTrophyCount }} Unlocked</span>
          </div>

          <div class="trophy-grid">
            <article class="trophy-card heavy-shadow" :class="{ unlocked: trophyState.spark }">
              <div class="trophy-icon">
                <q-icon name="bolt" size="36px" />
              </div>
              <div class="trophy-copy">
                <h4>The Spark</h4>
                <p>21 Day Mission</p>
              </div>
            </article>

            <article class="trophy-card heavy-shadow" :class="{ unlocked: trophyState.foundation }">
              <div class="trophy-icon trophy-white">
                <q-icon name="workspace_premium" size="36px" />
              </div>
              <div class="trophy-copy">
                <h4>Foundation</h4>
                <p>45 Day Mission</p>
              </div>
            </article>

            <article class="trophy-card heavy-shadow" :class="{ unlocked: trophyState.monolith }">
              <div class="trophy-icon">
                <q-icon name="shield" size="36px" />
              </div>
              <div class="trophy-copy">
                <h4>The Monolith</h4>
                <p>90 Day Mission</p>
              </div>
            </article>
          </div>
        </section>

        <section class="systems-section" data-reveal>
          <h3>Systems Control</h3>

          <div class="systems-card">
            <div class="system-row border-row">
              <div class="system-left">
                <q-icon name="dark_mode" color="grey-5" />
                <div>
                  <strong>Stealth Mode</strong>
                  <small>Deep black interface {{ stealthModeEnabled ? 'active' : 'inactive' }}</small>
                </div>
              </div>
              <button type="button" class="switch" :class="{ active: stealthModeEnabled }" @click="toggleStealthMode">
                <span class="switch-thumb" />
              </button>
            </div>

            <div class="system-row border-row">
              <div class="system-left">
                <q-icon name="notifications" color="grey-5" />
                <div>
                  <strong>Push Protocol</strong>
                  <small>{{ pushProtocolEnabled ? 'All mission alerts enabled' : 'Alerts are partially disabled' }}</small>
                </div>
              </div>
              <button type="button" class="switch" :class="{ active: pushProtocolEnabled }" @click="togglePushProtocol">
                <span class="switch-thumb" />
              </button>
            </div>

            <button type="button" class="system-row action-row" @click="exportMissionIntelligence">
              <div class="system-left">
                <q-icon name="sim_card_download" color="grey-5" />
                <div>
                  <strong>Mission Intelligence</strong>
                  <small>Export all history as .CSV</small>
                </div>
              </div>
              <q-icon name="chevron_right" color="grey-7" />
            </button>

            <button type="button" class="system-row action-row" @click="openSecurityControls">
              <div class="system-left">
                <q-icon name="fingerprint" color="grey-5" />
                <div>
                  <strong>Security Level</strong>
                  <small>Biometric lock enabled</small>
                </div>
              </div>
              <q-icon name="chevron_right" color="grey-7" />
            </button>
          </div>

          <button type="button" class="deactivate-btn" @click="handleLogout">
            Deactivate Session
          </button>
        </section>
      </main>
    </div>
  </q-page>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import { usePreferencesStore } from 'src/stores/preferences'
import { useTasksStore } from 'src/stores/tasks'
import AppPageHeader from 'src/components/AppPageHeader.vue'
import {
  buildIdentityInsight,
  calculateMomentum,
  getDateKey,
  getMissionProgress,
  shiftDate
} from 'src/utils/habitModel'
import { setupRevealOnScroll } from 'src/utils/revealMotion'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()
const habitsStore = useHabitsStore()
const tasksStore = useTasksStore()
const completionsStore = useCompletionsStore()
const preferencesStore = usePreferencesStore()

const loading = ref(true)
let cleanupReveal = null

const preferences = computed(() => preferencesStore.preferences)
const profilePhoto = computed(() => authStore.user?.photoURL || '')
const displayName = computed(() => authStore.displayName || 'Track.now User')
const avatarInitial = computed(() => {
  const seed = displayName.value.trim()
  return (seed[0] || 'T').toUpperCase()
})

const habits = computed(() => habitsStore.habits)
const tasks = computed(() => tasksStore.tasks)
const momentum = computed(() => calculateMomentum(habitsStore.habits, completionsStore.completions))
const identityInsight = computed(() => buildIdentityInsight(habitsStore.habits, completionsStore.completions))

const missionProgressItems = computed(() => {
  return habits.value.map((habit) => getMissionProgress(habit, completionsStore.completions))
})

const missionsCount = computed(() => habits.value.length)
const completedMissionCount = computed(() => {
  return missionProgressItems.value.filter((mission) => mission.missionDone).length
})
const streakDays = computed(() => getCompletionStreak(completionsStore.completions))
const streakLabel = computed(() => `${streakDays.value}d`)
const focusLabel = computed(() => `${momentum.value.percentage}%`)
const rankLabel = computed(() => {
  if (momentum.value.percentage >= 95) return 'Top 3'
  if (momentum.value.percentage >= 85) return 'Top 10'
  if (momentum.value.percentage >= 70) return 'Top 25'
  return 'Rising'
})

const levelLabel = computed(() => {
  const level = Math.max(1, Math.min(9, Math.floor(completedMissionCount.value / 2) + 1))
  const identity = identityInsight.value?.meta?.identity || 'Athlete'
  return `Level ${level} ${identity}`
})

const trophyState = computed(() => {
  const spark = habits.value.some((habit) => {
    const mission = getMissionProgress(habit, completionsStore.completions)
    return Number(habit.durationDays) === 21 && mission.missionDone
  })
  const foundation = habits.value.some((habit) => {
    const mission = getMissionProgress(habit, completionsStore.completions)
    return Number(habit.durationDays) === 45 && mission.missionDone
  })
  const monolith = habits.value.some((habit) => {
    const mission = getMissionProgress(habit, completionsStore.completions)
    return Number(habit.durationDays) === 90 && mission.missionDone
  })

  return { spark, foundation, monolith }
})

const unlockedTrophyCount = computed(() => {
  return Object.values(trophyState.value).filter(Boolean).length
})

const stealthModeEnabled = computed(() => {
  return preferences.value.themePreference === 'dark' || ($q.dark.isActive && preferences.value.themePreference === 'system')
})

const pushProtocolEnabled = computed(() => {
  return Boolean(preferences.value.reminderPreview && preferences.value.exactReminders)
})

onMounted(async () => {
  await Promise.all([
    authStore.loadProfile(),
    completionsStore.fetchLast90Days()
  ])

  loading.value = false
  await nextTick()
  cleanupReveal = setupRevealOnScroll('.profile-home-page', {
    threshold: 0.12,
    rootMargin: '0px 0px -10% 0px'
  })
})

onUnmounted(() => {
  if (cleanupReveal) {
    cleanupReveal()
    cleanupReveal = null
  }
})

function toggleStealthMode() {
  const nextValue = !stealthModeEnabled.value
  applyTheme(nextValue ? 'dark' : 'light')
}

function togglePushProtocol() {
  const nextValue = !pushProtocolEnabled.value
  preferencesStore.updatePreference('reminderPreview', nextValue)
  preferencesStore.updatePreference('exactReminders', nextValue)
}

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

function exportMissionIntelligence() {
  try {
    const rows = [
      ['type', 'id', 'title', 'status', 'date', 'time', 'meta']
    ]

    habitsStore.habits.forEach((habit) => {
      const mission = getMissionProgress(habit, completionsStore.completions)
      rows.push([
        'habit',
        habit.id,
        habit.name,
        mission.missionDone ? 'mission-complete' : 'active',
        '',
        habit.time || '',
        `duration:${habit.durationDays};category:${habit.category};difficulty:${habit.difficulty}`
      ])
    })

    tasks.value.forEach((task) => {
      rows.push([
        'task',
        task.id,
        task.title,
        task.completed ? 'done' : 'open',
        task.dueDate || '',
        task.dueTime || '',
        `priority:${task.priority};category:${task.category}`
      ])
    })

    completionsStore.completions.forEach((completion) => {
      rows.push([
        'completion',
        completion.id,
        completion.habitId,
        completion.completed === false ? 'false' : 'true',
        completion.date || '',
        completion.sessionId || '',
        ''
      ])
    })

    const csvText = rows
      .map((row) => row.map((value) => csvEscape(value)).join(','))
      .join('\n')
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
    const stamp = getDateKey().replace(/-/g, '')
    const fileName = `tracknow-mission-intelligence-${stamp}.csv`

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', fileName)
    link.style.display = 'none'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    $q.notify({ message: 'CSV export ready', color: 'positive', icon: 'download_done' })
  } catch {
    $q.notify({ message: 'Could not export CSV', color: 'negative' })
  }
}

function openSecurityControls() {
  $q.notify({
    color: 'info',
    message: 'Security controls are managed via your device lock and account provider settings.'
  })
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

function csvEscape(value) {
  const text = String(value ?? '')
  if (!text.includes(',') && !text.includes('"') && !text.includes('\n')) {
    return text
  }

  return `"${text.replace(/"/g, '""')}"`
}

function getCompletionStreak(completions) {
  const completionDates = new Set(
    completions
      .filter((completion) => completion.completed !== false && completion.date)
      .map((completion) => completion.date)
  )

  if (completionDates.size === 0) return 0

  let streak = 0
  let cursor = new Date()

  let key = getDateKey(cursor)
  while (completionDates.has(key)) {
    streak++
    cursor = shiftDate(cursor, -1)
    key = getDateKey(cursor)
  }

  return streak
}

</script>

<style scoped lang="scss">
.profile-home-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #e5e2e1;
  padding-bottom: 118px;
  overflow: hidden;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
}

.profile-shell {
  position: relative;
  z-index: 1;
  width: min(980px, calc(100% - 28px));
  margin: 0 auto;
  padding-top: 18px;
}

.profile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;

  h1 {
    margin: 0;
    font-size: 1.08rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.05em;
    color: #fff;
  }
}

.avatar-mini {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #202020;
  display: grid;
  place-items: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  span {
    font-size: 0.78rem;
    font-weight: 700;
  }
}

.profile-main {
  display: grid;
  gap: 42px;
}

.hero-section {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 20px;
}

.hero-avatar-wrap {
  position: relative;
}

.hero-avatar {
  width: 124px;
  height: 124px;
  border-radius: 999px;
  border: 4px solid #1b1b1c;
  background: #1b1b1c;
  padding: 4px;
  overflow: hidden;
  display: grid;
  place-items: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 999px;
  }

  span {
    font-size: 2.1rem;
    font-weight: 900;
    color: #fff;
  }
}

.status-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 4px solid #000;
  background: #ff3b30;
}

.hero-copy {
  h2 {
    margin: 0;
    font-size: clamp(2.1rem, 6vw, 3.2rem);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.03em;
    color: #fff;
  }

  p {
    margin: 6px 0 0;
    color: #7f7f84;
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
}

.stats-grid {
  width: min(760px, 100%);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.stat-card {
  background: #1b1b1c;
  border-radius: 12px;
  padding: 18px;
  text-align: left;

  span {
    display: block;
    margin-bottom: 4px;
    color: #7e7e83;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  strong {
    color: #fff;
    font-size: 1.5rem;
    font-weight: 900;
    letter-spacing: -0.02em;
  }
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 14px;

  h3 {
    margin: 0;
    color: #fff;
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  span {
    color: #7b7b80;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
}

.trophy-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.trophy-card {
  border-radius: 16px;
  background: #1b1b1c;
  padding: 26px 18px;
  display: grid;
  justify-items: center;
  gap: 16px;
  opacity: 0.75;
}

.trophy-card.unlocked {
  opacity: 1;
}

.trophy-icon {
  width: 74px;
  height: 74px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #353535;
  color: #8c8c92;
}

.trophy-icon.trophy-white {
  background: #fff;
  color: #000;
}

.trophy-copy {
  text-align: center;

  h4 {
    margin: 0;
    color: #fff;
    font-size: 1.05rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.01em;
  }

  p {
    margin: 4px 0 0;
    color: #7f7f84;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
}

.systems-section {
  h3 {
    margin: 0 0 12px;
    color: #fff;
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
}

.systems-card {
  border-radius: 16px;
  overflow: hidden;
  background: #1b1b1c;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.system-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: transparent;
  border: 0;
  color: inherit;
  text-align: left;
  padding: 16px 18px;
}

.border-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.action-row {
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background: #2a2a2a;
  }
}

.system-left {
  display: inline-flex;
  align-items: center;
  gap: 12px;

  strong {
    display: block;
    color: #fff;
    font-size: 0.93rem;
    font-weight: 600;
  }

  small {
    color: #7e7e83;
    font-size: 0.72rem;
  }
}

.switch {
  width: 48px;
  height: 24px;
  border-radius: 999px;
  border: 0;
  background: #2a2a2a;
  padding: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background-color 0.2s ease;
}

.switch.active {
  background: #fff;
}

.switch-thumb {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #7a7a80;
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.switch.active .switch-thumb {
  transform: translateX(24px);
  background: #000;
}

.deactivate-btn {
  width: 100%;
  margin-top: 14px;
  border: 0;
  background: transparent;
  color: #7f7f84;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  padding: 16px;
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: #fff;
  }
}

.heavy-shadow {
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
}

.reveal-target {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.reveal-target.is-visible {
  opacity: 1;
  transform: none;
}

@media (max-width: 900px) {
  .stats-grid,
  .trophy-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .profile-shell {
    width: calc(100% - 20px);
  }

  .stats-grid,
  .trophy-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-target,
  .reveal-target.is-visible,
  .switch-thumb,
  .switch,
  .action-row {
    transition: none;
    transform: none;
  }
}
</style>

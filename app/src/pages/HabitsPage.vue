<template>
  <q-page class="habit-command-page">
    <div class="grain-overlay" />

    <div class="habit-shell">
      <AppPageHeader reveal>
        <template #right>
          <q-btn
            unelevated
            no-caps
            icon="add"
            label="Mission"
            to="/add"
            class="new-mission-btn"
          />
        </template>
      </AppPageHeader>

      <q-inner-loading :showing="loading">
        <q-spinner color="white" size="56px" />
      </q-inner-loading>

      <main v-if="!loading" class="mission-main">
        <section class="mission-heading" data-reveal>
          <h1>Mission Command</h1>
          <p>
            Strategic habits with finite missions, clear pacing, and no guilt loops.
          </p>
        </section>

        <section class="summary-grid" data-reveal>
          <article class="summary-card pro-card">
            <span class="summary-kicker">Active Missions</span>
            <div class="summary-value">
              <span>{{ paddedCount(activeMissionCount) }}</span>
              <small>/ {{ paddedCount(habits.length) }}</small>
            </div>
          </article>

          <article class="summary-card pro-card">
            <span class="summary-kicker">Completed Missions</span>
            <div class="summary-value">
              <span>{{ paddedCount(completedMissionCount) }}</span>
              <small>TOTAL</small>
            </div>
          </article>

          <article class="summary-card pro-card">
            <div class="summary-head">
              <span class="summary-kicker">Momentum</span>
              <span v-if="closingSoonCount > 0" class="pulse-dot" />
            </div>
            <div class="summary-value">
              <span>{{ momentum.percentage }}%</span>
              <small>7D</small>
            </div>
          </article>
        </section>

        <section class="target-stack" data-reveal>
          <div class="target-head">
            <h2>Current Targets</h2>
            <span>Sorted by Priority</span>
          </div>

          <div v-if="missionHabits.length === 0" class="empty-state pro-card">
            <h3>No missions yet</h3>
            <p>Create your first mission habit to start the command board.</p>
            <q-btn
              unelevated
              no-caps
              icon="add"
              label="Create mission"
              to="/add"
              class="new-mission-btn"
            />
          </div>

          <transition-group v-else name="stack" tag="div" class="stack-list">
            <article
              v-for="habit in missionHabits"
              :key="habit.id"
              class="habit-card pro-card"
              :class="{ complete: habit.missionProgress.missionDone, paused: habit.pausedToday }"
              @click="openHabit(habit.id)"
            >
              <div class="habit-inner">
                <div class="habit-top">
                  <div class="habit-title-wrap">
                    <span class="identity-chip">{{ habit.categoryMeta.label }}</span>
                    <h3>{{ habit.name }}</h3>
                  </div>

                  <div class="habit-controls" @click.stop>
                    <div class="status-col">
                      <p>Status</p>
                      <strong :class="habit.statusClass">{{ habit.statusLabel }}</strong>
                    </div>

                    <button
                      class="primary-action"
                      type="button"
                      @click="handlePrimaryAction(habit)"
                    >
                      {{ habit.actionLabel }}
                    </button>

                    <q-btn flat round dense icon="more_vert" class="menu-btn">
                      <q-menu>
                        <q-list style="min-width: 160px">
                          <q-item clickable v-close-popup @click="editHabit(habit)">
                            <q-item-section avatar>
                              <q-icon name="edit" />
                            </q-item-section>
                            <q-item-section>Edit</q-item-section>
                          </q-item>
                          <q-item clickable v-close-popup @click="confirmDelete(habit)">
                            <q-item-section avatar>
                              <q-icon name="delete" />
                            </q-item-section>
                            <q-item-section>Delete</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </q-btn>
                  </div>
                </div>

                <div class="habit-progress">
                  <div class="progress-labels">
                    <span>
                      DAY {{ habit.missionProgress.displayDay }}
                      <em>/ {{ habit.missionProgress.durationDays }}</em>
                    </span>
                    <span>{{ habit.progressPercent }}%</span>
                  </div>

                  <div class="progress-track">
                    <div class="progress-fill" :style="{ width: `${habit.progressWidth}%` }" />
                  </div>
                </div>

                <div class="habit-footer" @click.stop>
                  <button
                    type="button"
                    class="footer-action"
                    @click="togglePauseForToday(habit)"
                  >
                    {{ habit.pauseLabel }}
                  </button>
                  <span class="footer-note">{{ habit.note }}</span>
                </div>
              </div>
            </article>
          </transition-group>
        </section>

        <section class="standard-section" data-reveal>
          <div class="visual-panel pro-card">
            <div class="visual-ring" />
            <div class="visual-grid" />
          </div>
          <div class="standard-copy">
            <h3>The 90-Day Standard</h3>
            <p>
              Habits are not chains. They are mission protocols. Paused Momentum keeps your progress intact
              while you make tactical adjustments.
            </p>
            <q-btn flat no-caps label="Review Protocol" to="/analytics" class="protocol-btn" />
          </div>
        </section>
      </main>

      <q-dialog v-model="deleteDialog">
        <q-card class="app-dialog-card" style="min-width: 320px">
          <q-card-section>
            <div class="text-h6">Delete habit</div>
            <div class="q-mt-sm">
              Remove "{{ habitToDelete?.name }}" and its mission setup? Completion history will remain untouched.
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Cancel" v-close-popup />
            <q-btn unelevated label="Delete" color="negative" @click="handleDelete" :loading="deleting" />
          </q-card-actions>
        </q-card>
      </q-dialog>
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
import AppPageHeader from 'src/components/AppPageHeader.vue'
import {
  calculateMomentum,
  getCategoryMeta,
  getDateKey,
  getHabitSessionProgressForDate,
  getMissionProgress,
  isHabitScheduledForDate
} from 'src/utils/habitModel'
import { setupRevealOnScroll } from 'src/utils/revealMotion'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()

const deleteDialog = ref(false)
const habitToDelete = ref(null)
const deleting = ref(false)
const pausedTodayMap = ref({})
let cleanupReveal = null

const loading = computed(() => habitsStore.loading || completionsStore.loading)
const habits = computed(() => habitsStore.habits)
const todayKey = computed(() => getDateKey())
const pauseStorageKey = computed(() => {
  return `tracknow:habits-pause:${authStore.userId || 'guest'}:${todayKey.value}`
})

const decoratedHabits = computed(() => {
  return habits.value.map((habit) => {
    const missionProgress = getMissionProgress(habit, completionsStore.completions)
    const todaySession = getHabitSessionProgressForDate(habit, completionsStore.completions)
    const scheduledToday = isHabitScheduledForDate(habit)
    const pausedToday = Boolean(pausedTodayMap.value[habit.id])
    const progressPercent = Math.round(missionProgress.progress * 100)
    const progressWidth = Math.max(progressPercent, progressPercent > 0 ? 8 : 0)

    let statusLabel = 'Standby'
    let statusClass = ''

    if (missionProgress.missionDone) {
      statusLabel = 'Mission Complete'
      statusClass = 'status-done'
    } else if (pausedToday) {
      statusLabel = 'Paused Momentum'
      statusClass = 'status-paused'
    } else if (scheduledToday && todaySession.completed) {
      statusLabel = 'Secured Today'
      statusClass = 'status-done'
    } else if (scheduledToday) {
      statusLabel = 'In Progress'
    }

    let actionLabel = 'Review'
    if (!missionProgress.missionDone) {
      if (pausedToday) {
        actionLabel = 'Resume'
      } else if (scheduledToday && todaySession.completed) {
        actionLabel = 'Undo'
      } else if (scheduledToday) {
        actionLabel = 'Complete'
      }
    }

    let pauseLabel = 'Not scheduled'
    if (scheduledToday && !missionProgress.missionDone) {
      pauseLabel = pausedToday ? 'Resume Today' : 'Skip for Today'
    }

    let note = 'Open mission detail for full protocol settings'
    if (missionProgress.missionDone) {
      note = 'Mission complete and ready for a new cycle'
    } else if (pausedToday) {
      note = 'Paused by user command'
    } else if (scheduledToday && todaySession.completed) {
      note = `${missionProgress.remainingSessions} mission days left`
    } else if (missionProgress.remainingSessions <= 7) {
      note = 'Critical mission near completion'
    } else if (scheduledToday) {
      note = `${todaySession.completedSessions}/${todaySession.totalSessions} sessions completed today`
    }

    let priorityRank = 2
    if (missionProgress.missionDone) {
      priorityRank = 4
    } else if (pausedToday) {
      priorityRank = 3
    } else if (scheduledToday && !todaySession.completed) {
      priorityRank = 0
    } else if (scheduledToday && todaySession.completed) {
      priorityRank = 1
    }

    return {
      ...habit,
      categoryMeta: getCategoryMeta(habit.category),
      missionProgress,
      todaySession,
      scheduledToday,
      pausedToday,
      statusLabel,
      statusClass,
      actionLabel,
      pauseLabel,
      note,
      progressPercent,
      progressWidth,
      priorityRank
    }
  })
})

const missionHabits = computed(() => {
  return [...decoratedHabits.value].sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank
    if (a.missionProgress.remainingSessions !== b.missionProgress.remainingSessions) {
      return a.missionProgress.remainingSessions - b.missionProgress.remainingSessions
    }
    if (b.progressPercent !== a.progressPercent) return b.progressPercent - a.progressPercent
    return a.name.localeCompare(b.name)
  })
})

const activeMissionCount = computed(() => {
  return decoratedHabits.value.filter((habit) => !habit.missionProgress.missionDone).length
})

const completedMissionCount = computed(() => {
  return decoratedHabits.value.filter((habit) => habit.missionProgress.missionDone).length
})

const closingSoonCount = computed(() => {
  return decoratedHabits.value.filter((habit) => {
    return !habit.missionProgress.missionDone && habit.missionProgress.remainingSessions <= 7
  }).length
})

const momentum = computed(() => {
  return calculateMomentum(habitsStore.habits, completionsStore.completions)
})

onMounted(async () => {
  if (completionsStore.completions.length === 0) {
    await completionsStore.fetchLast90Days()
  }

  loadPauseState()
  await nextTick()
  cleanupReveal = setupRevealOnScroll('.habit-command-page', {
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

function paddedCount(value) {
  return String(value).padStart(2, '0')
}

function openHabit(habitId) {
  router.push(`/habit/${habitId}`)
}

function editHabit(habit) {
  router.push({ path: '/add', query: { edit: habit.id } })
}

function confirmDelete(habit) {
  habitToDelete.value = habit
  deleteDialog.value = true
}

async function handleDelete() {
  if (!habitToDelete.value) return
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

async function handlePrimaryAction(habit) {
  try {
    if (habit.missionProgress.missionDone || !habit.scheduledToday) {
      openHabit(habit.id)
      return
    }

    if (habit.pausedToday) {
      setPausedToday(habit.id, false)
      $q.notify({ message: 'Mission resumed for today', color: 'info' })
      return
    }

    if (habit.todaySession.completed) {
      const completedSessionIds = habit.todaySession.completedSessionIds
      if (completedSessionIds.length === 0) return

      const lastSessionId = completedSessionIds[completedSessionIds.length - 1]
      await completionsStore.unmarkComplete(habit.id, lastSessionId)
      $q.notify({ message: 'Last completion undone', color: 'info' })
      return
    }

    const targetSessionId = habit.todaySession.nextSessionId
    if (!targetSessionId) return

    await completionsStore.markComplete(habit.id, targetSessionId)
    setPausedToday(habit.id, false)
    $q.notify({ message: `${habit.name} marked complete`, color: 'positive', icon: 'check_circle' })
  } catch {
    $q.notify({ message: 'Could not update mission right now', color: 'negative' })
  }
}

function togglePauseForToday(habit) {
  if (!habit.scheduledToday || habit.missionProgress.missionDone) {
    $q.notify({ message: 'This mission has no active session today', color: 'info' })
    return
  }

  if (habit.todaySession.completed) {
    $q.notify({ message: 'This mission is already completed today', color: 'info' })
    return
  }

  const nextState = !habit.pausedToday
  setPausedToday(habit.id, nextState)
  $q.notify({
    message: nextState ? 'Paused for today' : 'Resumed for today',
    color: 'info'
  })
}

function setPausedToday(habitId, paused) {
  const nextMap = { ...pausedTodayMap.value }

  if (paused) {
    nextMap[habitId] = true
  } else {
    delete nextMap[habitId]
  }

  pausedTodayMap.value = nextMap
  persistPauseState()
}

function loadPauseState() {
  if (typeof window === 'undefined') return

  try {
    const raw = window.localStorage.getItem(pauseStorageKey.value)
    pausedTodayMap.value = raw ? JSON.parse(raw) : {}
  } catch {
    pausedTodayMap.value = {}
  }
}

function persistPauseState() {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    pauseStorageKey.value,
    JSON.stringify(pausedTodayMap.value)
  )
}

</script>

<style scoped lang="scss">
.habit-command-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #fff;
  padding-bottom: 116px;
  overflow: hidden;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
}

.habit-shell {
  position: relative;
  z-index: 1;
  width: min(1020px, calc(100% - 28px));
  margin: 0 auto;
  padding-top: 18px;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 1rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.05em;
}

.new-mission-btn {
  border-radius: 999px;
  background: #fff !important;
  color: #111 !important;
  font-weight: 700;
  padding-inline: 14px;
}

.mission-main {
  display: grid;
  gap: 34px;
}

.mission-heading {
  h1 {
    margin: 0;
    font-size: clamp(2.3rem, 8vw, 3.6rem);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.03em;
  }

  p {
    margin: 14px 0 0;
    max-width: 620px;
    color: #9b9ba1;
    line-height: 1.6;
  }
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: #1b1b1c;
  padding: 22px;
  min-height: 146px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.summary-kicker {
  font-size: 0.68rem;
  color: #8f8f95;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
}

.summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.summary-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;

  span {
    font-size: clamp(2rem, 5vw, 2.9rem);
    font-weight: 800;
    letter-spacing: -0.04em;
  }

  small {
    color: #6f6f75;
    letter-spacing: 0.1em;
    font-size: 0.7rem;
    text-transform: uppercase;
    font-weight: 700;
  }
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ff3b30;
  box-shadow: 0 0 10px rgba(255, 59, 48, 0.9);
  animation: pulseDot 1.6s ease-in-out infinite;
}

.target-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 18px;

  h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.02em;
  }

  span {
    color: #7e7e83;
    font-size: 0.78rem;
    font-weight: 500;
  }
}

.stack-list {
  display: grid;
  gap: 14px;
}

.habit-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1b1b1c;
  cursor: pointer;
}

.habit-card.complete {
  opacity: 0.78;
}

.habit-card.paused {
  border-color: rgba(255, 255, 255, 0.2);
}

.habit-inner {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: #000;
  padding: 24px;
}

.habit-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.habit-title-wrap {
  display: grid;
  gap: 10px;

  h3 {
    margin: 0;
    font-size: clamp(1.2rem, 3vw, 1.7rem);
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-weight: 800;
  }
}

.identity-chip {
  width: fit-content;
  border-radius: 999px;
  background: #353535;
  padding: 5px 12px;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-weight: 700;
}

.habit-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-col {
  text-align: right;

  p {
    margin: 0;
    font-size: 0.58rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #7c7c82;
    font-weight: 700;
  }

  strong {
    display: block;
    margin-top: 4px;
    font-size: 0.76rem;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
}

.status-col .status-paused {
  color: #b8b8be;
  font-style: italic;
}

.status-col .status-done {
  color: #fff;
}

.primary-action {
  border: none;
  border-radius: 999px;
  background: #fff;
  color: #111;
  padding: 9px 15px;
  min-width: 88px;
  font-weight: 800;
  font-size: 0.66rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:active {
    transform: scale(0.97);
  }
}

.menu-btn {
  color: #7a7a80;
}

.habit-progress {
  display: grid;
  gap: 8px;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  align-items: baseline;

  span {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
    font-size: 0.72rem;
    font-weight: 600;
    color: #b1b1b6;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  em {
    color: #64646b;
    font-style: normal;
  }

  span:last-child {
    color: #fff;
    font-weight: 800;
  }
}

.progress-track {
  width: 100%;
  height: 2px;
  background: #353535;
}

.progress-fill {
  height: 100%;
  background: #fff;
  transition: width 0.3s ease;
}

.habit-footer {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.footer-action {
  border: none;
  background: transparent;
  color: #8a8a90;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-weight: 700;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: #d4d4d9;
  }
}

.footer-note {
  color: #646469;
  font-size: 0.66rem;
  font-style: italic;
  letter-spacing: 0.02em;
}

.empty-state {
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.16);
  padding: 24px;
  text-align: center;

  h3 {
    margin: 0;
    font-size: 1.2rem;
  }

  p {
    margin: 8px 0 18px;
    color: #9a9aa0;
  }
}

.standard-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: center;
}

.visual-panel {
  position: relative;
  min-height: 250px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: radial-gradient(circle at 20% 20%, #2c2c2c 0%, #101010 45%, #060606 100%);
  overflow: hidden;
}

.visual-ring {
  position: absolute;
  width: 180px;
  aspect-ratio: 1;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  left: 18%;
  top: 18%;
}

.visual-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 28px 28px;
}

.standard-copy {
  h3 {
    margin: 0;
    font-size: clamp(1.8rem, 5vw, 2.8rem);
    line-height: 1.02;
    text-transform: uppercase;
    letter-spacing: -0.03em;
    font-weight: 900;
  }

  p {
    margin: 14px 0 16px;
    color: #9c9ca1;
    line-height: 1.65;
  }
}

.protocol-btn {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  color: #fff;
  padding-inline: 14px;
}

.pro-card {
  transition: transform 0.22s ease, box-shadow 0.22s ease, background-color 0.22s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.35);
  }
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

.stack-enter-active,
.stack-leave-active {
  transition: all 0.3s ease;
}

.stack-enter-from,
.stack-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@keyframes pulseDot {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.8;
  }

  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}

@media (max-width: 960px) {
  .summary-grid,
  .standard-section {
    grid-template-columns: 1fr;
  }

  .habit-top {
    flex-direction: column;
  }

  .habit-controls {
    width: 100%;
    justify-content: flex-end;
  }

  .status-col {
    text-align: left;
    margin-right: auto;
  }
}

@media (max-width: 700px) {
  .habit-shell {
    width: calc(100% - 20px);
  }

  .top-row {
    flex-wrap: wrap;
    gap: 10px;
  }

  .habit-inner {
    padding: 18px;
  }

  .habit-footer {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-target,
  .reveal-target.is-visible,
  .pro-card,
  .pro-card:hover,
  .primary-action,
  .primary-action:active {
    transition: none;
    transform: none;
    animation: none;
  }
}
</style>

<template>
  <q-page class="action-hub-page">
    <div class="grain-overlay" />

    <div class="action-shell">
      <header class="action-header" data-reveal>
        <div class="brand-wrap">
          <q-icon name="radio_button_checked" size="18px" />
          <h1>Track.now</h1>
        </div>
        <div class="profile-chip">{{ avatarInitial }}</div>
      </header>

      <q-inner-loading :showing="loading">
        <q-spinner color="white" size="56px" />
      </q-inner-loading>

      <main v-if="!loading" class="action-main">
        <section class="hero-section" data-reveal>
          <div class="hero-ring-wrap">
            <div class="hero-ring-track" />
            <div class="hero-ring-gradient" :style="heroRingStyle" />
            <div class="hero-ring-content">
              <p class="ring-kicker">Mission Progress</p>
              <h2>{{ missionPercent }}%</h2>
              <p class="ring-day">Day {{ ringMissionDay }}/{{ ringMissionTotal }}</p>
            </div>
          </div>

          <div class="identity-blurb">
            <p>
              You are {{ identityPercent }}% of the way to becoming a
              <span>{{ identityLabel }}</span>
            </p>
            <div class="identity-track">
              <div class="identity-fill" :style="{ width: `${identityPercent}%` }" />
            </div>
          </div>
        </section>

        <section class="next-mission" data-reveal>
          <div class="next-mission-card pro-card" v-if="focusHabit">
            <div class="card-watermark">
              <q-icon name="rocket_launch" size="96px" />
            </div>
            <div class="next-content">
              <span class="kicker">Do this one now</span>
              <h3>{{ focusHabit.name }}</h3>
              <p>{{ focusMissionDescription }}</p>
              <button class="start-btn" type="button" @click="handleCompleteHabit(focusHabit)">
                Start Mission
                <q-icon name="arrow_forward" size="16px" />
              </button>
            </div>
          </div>

          <div v-else class="next-mission-card pro-card empty">
            <div class="next-content">
              <span class="kicker">Action Hub</span>
              <h3>No missions scheduled for today</h3>
              <p>Create your first mission habit and start shaping your day with one focused action.</p>
              <q-btn unelevated color="white" text-color="black" no-caps icon="add" label="Create mission" to="/add" />
            </div>
          </div>
        </section>

        <section class="habits-section" data-reveal>
          <div class="habits-head">
            <h4>Daily Habits</h4>
            <span>{{ completedCount }} of {{ todayHabits.length }} completed</span>
          </div>

          <div v-if="todayHabits.length === 0" class="empty-list">
            Nothing scheduled for today.
          </div>

          <transition-group v-else name="list-stagger" tag="div" class="habit-list">
            <article
              v-for="habit in todayHabits"
              :key="habit.id"
              class="habit-row pro-card"
              :class="{ complete: isHabitDoneToday(habit) }"
            >
              <button
                class="habit-toggle"
                type="button"
                @click="isHabitDoneToday(habit) ? handleUncompleteHabit(habit) : handleCompleteHabit(habit)"
              >
                <span v-if="isHabitDoneToday(habit)" class="toggle-fill">
                  <q-icon name="check" size="18px" />
                </span>
                <span v-else class="toggle-empty" />
              </button>

              <div class="habit-copy">
                <h5>{{ habit.name }}</h5>
                <p>{{ habitLine(habit) }}</p>
              </div>

              <div class="habit-trailing">
                <span v-if="isFocusPendingHabit(habit)" class="alert-dot" />
                <q-btn flat round dense icon="more_vert" class="more-btn" @click.stop />
              </div>
            </article>
          </transition-group>
        </section>
      </main>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import confetti from 'canvas-confetti'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import {
  buildIdentityInsight,
  formatTimeLabel,
  getHabitSessionProgressForDate,
  getMissionProgress,
  isHabitCompleteOnDate
} from 'src/utils/habitModel'

const $q = useQuasar()
const authStore = useAuthStore()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()

const loading = ref(true)
let revealObserver = null

const avatarInitial = computed(() => {
  const seed = String(authStore.displayName || authStore.user?.email || 'T').trim()
  return (seed[0] || 'T').toUpperCase()
})

const todayHabits = computed(() => habitsStore.todayHabits)
const isHabitDoneToday = (habit) => isHabitCompleteOnDate(habit, completionsStore.completions)

const pendingHabits = computed(() => {
  return todayHabits.value.filter((habit) => !isHabitDoneToday(habit))
})

const completedHabits = computed(() => {
  return todayHabits.value.filter((habit) => isHabitDoneToday(habit))
})

const completedCount = computed(() => completedHabits.value.length)
const completionRate = computed(() => {
  return todayHabits.value.length > 0 ? completedCount.value / todayHabits.value.length : 0
})
const missionPercent = computed(() => Math.round(completionRate.value * 100))
const allDone = computed(() => todayHabits.value.length > 0 && pendingHabits.value.length === 0)

const identityInsight = computed(() => {
  return buildIdentityInsight(habitsStore.habits, completionsStore.completions)
})

const identityPercent = computed(() => {
  return Math.max(0, Math.min(identityInsight.value?.score ?? missionPercent.value, 100))
})

const identityLabel = computed(() => {
  return identityInsight.value?.meta?.identity || 'Disciplined Builder'
})

const focusHabit = computed(() => {
  if (pendingHabits.value.length > 0) return pendingHabits.value[0]
  if (todayHabits.value.length > 0) return todayHabits.value[0]
  return null
})

const focusMissionProgress = computed(() => {
  if (!focusHabit.value) {
    return {
      displayDay: 1,
      durationDays: 21,
      remainingSessions: 21,
      missionDone: false
    }
  }

  return getMissionProgress(focusHabit.value, completionsStore.completions)
})

const ringMissionDay = computed(() => focusMissionProgress.value.displayDay)
const ringMissionTotal = computed(() => focusMissionProgress.value.durationDays)

const focusSessionProgress = computed(() => {
  if (!focusHabit.value) {
    return {
      totalSessions: 1,
      completedSessions: 0,
      nextSessionId: null,
      completed: false
    }
  }

  return getHabitSessionProgressForDate(focusHabit.value, completionsStore.completions)
})

const focusMissionDescription = computed(() => {
  if (!focusHabit.value) return 'No mission selected.'

  if (focusSessionProgress.value.completed) {
    return 'This mission habit is completed for today. Review your momentum and keep the streak clean.'
  }

  const nextTime = formatTimeLabel(focusSessionProgress.value.nextSessionId || focusHabit.value.time)
  return `Focus on ${focusHabit.value.name.toLowerCase()} at ${nextTime} to protect momentum.`
})

const heroRingStyle = computed(() => {
  const safe = Math.max(0, Math.min(missionPercent.value, 100))
  return {
    '--progress-angle': `${Math.round((safe / 100) * 360)}deg`
  }
})

watch(allDone, (isDone, wasDone) => {
  if (isDone && !wasDone) {
    fireCelebration()
  }
})

onMounted(async () => {
  await completionsStore.fetchLast90Days()
  loading.value = false

  const revealNodes = Array.from(document.querySelectorAll('.action-hub-page [data-reveal]'))
  if (!revealNodes.length) return

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    revealNodes.forEach((node) => node.classList.add('is-visible'))
    return
  }

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      revealObserver?.unobserve(entry.target)
    })
  }, {
    threshold: 0.14,
    rootMargin: '0px 0px -10% 0px'
  })

  revealNodes.forEach((node, index) => {
    node.classList.add('reveal-target')
    node.style.transitionDelay = `${Math.min((index % 6) * 70, 280)}ms`
    revealObserver?.observe(node)
  })
})

onUnmounted(() => {
  if (revealObserver) {
    revealObserver.disconnect()
    revealObserver = null
  }
})

function isFocusPendingHabit(habit) {
  if (!focusHabit.value) return false
  return pendingHabits.value.length > 0 && focusHabit.value.id === habit.id
}

function habitLine(habit) {
  const sessionProgress = getHabitSessionProgressForDate(habit, completionsStore.completions)
  const mission = getMissionProgress(habit, completionsStore.completions)

  if (sessionProgress.completed) {
    return `Completed today - Day ${mission.displayDay}/${mission.durationDays}`
  }

  const nextTime = formatTimeLabel(sessionProgress.nextSessionId || habit.time)
  return `${sessionProgress.completedSessions}/${sessionProgress.totalSessions} sessions - Next ${nextTime}`
}

async function handleCompleteHabit(habit) {
  const sessionProgress = getHabitSessionProgressForDate(habit, completionsStore.completions)
  const targetSessionId = sessionProgress.nextSessionId
  if (!targetSessionId) return

  await completionsStore.markComplete(habit.id, targetSessionId)

  const afterCount = Math.min(sessionProgress.completedSessions + 1, sessionProgress.totalSessions)
  const doneForDay = afterCount >= sessionProgress.totalSessions

  $q.notify({
    color: 'positive',
    message: doneForDay
      ? `${habit.name} completed for today`
      : `${habit.name}: session ${afterCount}/${sessionProgress.totalSessions}`,
    icon: 'check_circle'
  })
}

async function handleUncompleteHabit(habit) {
  const sessionProgress = getHabitSessionProgressForDate(habit, completionsStore.completions)
  if (sessionProgress.completedSessionIds.length === 0) return

  const lastSessionId = sessionProgress.completedSessionIds[sessionProgress.completedSessionIds.length - 1]
  await completionsStore.unmarkComplete(habit.id, lastSessionId)

  $q.notify({ color: 'info', message: 'Last completion undone' })
}

function fireCelebration() {
  confetti({
    particleCount: 140,
    spread: 76,
    origin: { y: 0.62 },
    colors: ['#ffffff', '#d4d4d4', '#6b7280']
  })
}
</script>

<style scoped lang="scss">
.action-hub-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #fff;
  padding-bottom: 118px;
  overflow: hidden;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
  z-index: 0;
}

.action-shell {
  position: relative;
  z-index: 2;
  width: min(980px, calc(100% - 28px));
  margin: 0 auto;
  padding-top: 18px;
}

.action-header {
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
  }
}

.profile-chip {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: grid;
  place-items: center;
  background: #2a2a2a;
  font-size: 0.78rem;
  font-weight: 700;
}

.action-main {
  display: grid;
  gap: 36px;
}

.hero-section {
  display: grid;
  justify-items: center;
  gap: 18px;
}

.hero-ring-wrap {
  width: min(320px, 72vw);
  aspect-ratio: 1;
  position: relative;
  display: grid;
  place-items: center;
}

.hero-ring-track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 2px solid rgba(53, 53, 53, 0.6);
}

.hero-ring-gradient {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: conic-gradient(from 0deg, #ffffff var(--progress-angle), #353535 var(--progress-angle));
  mask-image: radial-gradient(transparent 65%, #000 66%);
  -webkit-mask-image: radial-gradient(transparent 65%, #000 66%);
}

.hero-ring-content {
  text-align: center;

  h2 {
    margin: 0;
    font-size: clamp(3.8rem, 10vw, 5.8rem);
    line-height: 0.95;
    font-weight: 900;
    letter-spacing: -0.04em;
  }
}

.ring-kicker {
  margin: 0 0 6px;
  font-size: 0.68rem;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.17em;
}

.ring-day {
  margin: 8px 0 0;
  font-size: 1rem;
  color: #fff;
  letter-spacing: 0.02em;
}

.identity-blurb {
  width: min(430px, 100%);
  text-align: center;

  p {
    margin: 0;
    color: #a1a1aa;
    line-height: 1.65;
    letter-spacing: -0.01em;
  }

  span {
    color: #fff;
    font-weight: 700;
  }
}

.identity-track {
  margin-top: 14px;
  height: 3px;
  width: 100%;
  border-radius: 999px;
  background: #353535;
  overflow: hidden;
}

.identity-fill {
  height: 100%;
  background: #fff;
  transition: width 0.35s ease;
}

.next-mission-card {
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1b1b1c;
  padding: 28px;
  position: relative;
  overflow: hidden;
}

.card-watermark {
  position: absolute;
  right: 20px;
  top: 14px;
  color: rgba(255, 255, 255, 0.12);
}

.next-content {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 10px;

  h3 {
    margin: 0;
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.03em;
  }

  p {
    margin: 0;
    max-width: 520px;
    color: #a1a1aa;
    line-height: 1.65;
  }
}

.kicker {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #7c7c7c;
  font-weight: 700;
}

.start-btn {
  margin-top: 10px;
  border: none;
  border-radius: 999px;
  background: #fff;
  color: #111;
  padding: 11px 16px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px rgba(255, 255, 255, 0.22);
  }

  &:active {
    transform: scale(0.96);
  }
}

.next-mission-card.empty {
  background: #161616;
}

.habits-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;

  h4 {
    margin: 0;
    font-size: 1.55rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.04em;
  }

  span {
    font-size: 0.72rem;
    color: #7c7c7c;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
}

.habit-list {
  display: grid;
  gap: 10px;
}

.habit-row {
  border-radius: 16px;
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  background: #1b1b1c;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.habit-row.complete {
  opacity: 0.75;
}

.habit-toggle {
  width: 46px;
  height: 46px;
  border-radius: 999px;
  border: none;
  background: transparent;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
}

.toggle-fill {
  width: 46px;
  height: 46px;
  border-radius: 999px;
  border: 2px solid #fff;
  background: #fff;
  display: grid;
  place-items: center;
  color: #111;
}

.toggle-empty {
  width: 46px;
  height: 46px;
  border-radius: 999px;
  border: 2px solid #555;
}

.habit-copy {
  display: grid;
  gap: 3px;

  h5 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #fff;
  }

  p {
    margin: 0;
    font-size: 0.72rem;
    color: #8d8d8d;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
}

.habit-trailing {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.alert-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ff3b30;
  box-shadow: 0 0 8px rgba(255, 59, 48, 0.9);
}

.more-btn {
  color: #71717a;
}

.empty-list {
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: #7c7c7c;
  padding: 14px;
}

.pro-card {
  transition: transform 0.22s ease, box-shadow 0.22s ease, background-color 0.22s ease;

  &:hover {
    transform: translateY(-2px);
    background: #202020;
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.35);
  }
}

.reveal-target {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.55s ease, transform 0.55s ease;
}

.reveal-target.is-visible {
  opacity: 1;
  transform: none;
}

@media (max-width: 780px) {
  .action-shell {
    width: calc(100% - 20px);
  }

  .next-mission-card {
    padding: 22px;
  }

  .habit-row {
    grid-template-columns: auto 1fr;
  }

  .habit-trailing {
    grid-column: 1 / -1;
    justify-content: flex-end;
    margin-top: -2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-target,
  .reveal-target.is-visible {
    opacity: 1;
    transform: none;
    transition: none;
  }

  .pro-card,
  .pro-card:hover,
  .start-btn,
  .start-btn:hover {
    transition: none;
    transform: none;
  }
}
</style>


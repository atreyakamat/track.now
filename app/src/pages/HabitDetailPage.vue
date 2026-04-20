<template>
  <q-page class="habit-detail-page">
    <div class="grain-overlay" />

    <div class="detail-shell">
      <AppPageHeader reveal>
        <template #right>
          <div class="row q-gutter-sm">
            <q-btn
              flat
              round
              dense
              icon="edit"
              class="header-btn"
              @click="router.push({ path: '/add', query: { edit: habit.id } })"
            />
            <q-btn
              flat
              round
              dense
              icon="share"
              class="header-btn"
              @click="shareHabit"
            />
          </div>
        </template>
      </AppPageHeader>

      <q-inner-loading :showing="loading">
        <q-spinner color="white" size="56px" />
      </q-inner-loading>

      <div v-if="!loading && !habit" class="empty-detail text-center">
        <div class="text-h3 q-mb-md">🧭</div>
        <div class="text-h6 text-weight-bold q-mb-sm">Mission not found</div>
        <q-btn label="Return to Command" color="white" text-color="black" unelevated to="/habits" no-caps class="q-mt-md" />
      </div>

      <main v-else-if="habit" class="detail-main">
        <section class="mission-briefing" data-reveal>
          <div class="briefing-head">
            <div class="briefing-emoji">{{ habit.emoji }}</div>
            <div class="briefing-title">
              <span class="protocol-tag" :style="{ color: categoryMeta.accent }">
                PROTOCOL: {{ categoryMeta.label }}
              </span>
              <h1>{{ habit.name }}</h1>
            </div>
          </div>

          <div class="arc-container pro-card">
            <div class="arc-header">
              <div class="arc-title">
                <span class="kicker">Mission Arc</span>
                <h3>{{ missionProgress.missionDone ? 'Mission Secured' : `Day ${missionProgress.displayDay} of ${missionProgress.durationDays}` }}</h3>
              </div>
              <div class="arc-stat">
                <span class="stat-value">{{ Math.round(missionProgress.progress * 100) }}%</span>
                <span class="stat-label">COMPLETE</span>
              </div>
            </div>

            <div class="arc-track">
              <div class="arc-fill" :style="{ width: `${Math.max(missionProgress.progress * 100, missionProgress.progress > 0 ? 2 : 0)}%` }" />
            </div>

            <p class="arc-note">
              {{ missionProgress.missionDone
                ? 'This mission has reached its finish line. You can now archive it or start a new cycle.'
                : `${missionProgress.remainingSessions} days remain in this arc.` }}
            </p>
          </div>
        </section>

        <section class="protocol-grid" data-reveal>
          <div class="protocol-card pro-card">
            <span class="kicker">Schedule</span>
            <div class="protocol-value">{{ dayLabel }}</div>
          </div>
          <div class="protocol-card pro-card">
            <span class="kicker">Pace</span>
            <div class="protocol-value">{{ reminderListLabel }}</div>
          </div>
          <div class="protocol-card pro-card">
            <span class="kicker">Identity</span>
            <div class="protocol-value">{{ categoryMeta.identity }}</div>
          </div>
          <div class="protocol-card pro-card">
            <span class="kicker">Effort</span>
            <div class="protocol-value">{{ difficultyMeta.label }}</div>
          </div>
        </section>

        <section class="activity-section" data-reveal>
          <div class="section-head">
            <h2>Recent Activity</h2>
            <span class="kicker">Last 8 Sessions</span>
          </div>

          <div v-if="activityFeed.length === 0" class="empty-state pro-card">
            No history yet. The first completed session will initiate the log.
          </div>

          <div v-else class="activity-stack">
            <article v-for="item in activityFeed" :key="item.date" class="activity-row pro-card">
              <div class="activity-dot" :style="{ backgroundColor: categoryMeta.accent }" />
              <div class="activity-copy">
                <div class="activity-main-label">{{ item.label }}</div>
                <div class="activity-sub-label">{{ item.subtitle }}</div>
              </div>
              <div class="activity-status">SECURED</div>
            </article>
          </div>
        </section>

        <section class="danger-zone" data-reveal>
          <q-btn
            flat
            no-caps
            color="grey-6"
            icon="delete"
            label="Abort Mission"
            class="abort-btn"
            @click="confirmDelete"
          />
        </section>
      </main>

      <q-dialog v-model="deleteDialog">
        <q-card class="app-dialog-card" style="min-width: 320px">
          <q-card-section>
            <div class="text-h6">Abort Mission</div>
            <div class="q-mt-sm">
              Permanently remove this protocol? Completion history will remain in your archives.
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Cancel" v-close-popup color="grey-7" />
            <q-btn unelevated label="Abort" color="negative" @click="handleDelete" :loading="deleting" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { whatsappService } from 'src/services/whatsappService'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import AppPageHeader from 'src/components/AppPageHeader.vue'
import {
  formatDayList,
  getCategoryMeta,
  getCompletionDatesForHabit,
  getDateFromKey,
  getDifficultyMeta,
  getDurationMeta,
  getMissionProgress,
  getReminderListLabel,
  getRelativeDayLabel
} from 'src/utils/habitModel'
import { setupRevealOnScroll } from 'src/utils/revealMotion'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()

const loading = ref(true)
const deleteDialog = ref(false)
const deleting = ref(false)
let cleanupReveal = null

const habit = computed(() => habitsStore.habits.find((item) => item.id === route.params.id))
const categoryMeta = computed(() => getCategoryMeta(habit.value?.category))
const difficultyMeta = computed(() => getDifficultyMeta(habit.value?.difficulty))
const durationMeta = computed(() => getDurationMeta(habit.value?.durationDays))
const missionProgress = computed(() => habit.value ? getMissionProgress(habit.value, completionsStore.completions) : {
  progress: 0,
  completedSessions: 0,
  durationDays: 21,
  displayDay: 1,
  remainingSessions: 21,
  missionDone: false
})
const reminderListLabel = computed(() => habit.value ? getReminderListLabel(habit.value) : '')
const dayLabel = computed(() => habit.value ? formatDayList(habit.value.days) : '')

const activityFeed = computed(() => {
  if (!habit.value) return []

  return getCompletionDatesForHabit(habit.value.id, completionsStore.completions)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 8)
    .map((date) => ({
      date,
      label: getRelativeDayLabel(date),
      subtitle: getDateFromKey(date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      })
    }))
})

onMounted(async () => {
  if (completionsStore.completions.length === 0) {
    await completionsStore.fetchLast90Days()
  }
  loading.value = false

  cleanupReveal = setupRevealOnScroll('.habit-detail-page', {
    threshold: 0.1,
    rootMargin: '0px 0px -5% 0px'
  })
})

onUnmounted(() => {
  if (cleanupReveal) {
    cleanupReveal()
  }
})

function shareHabit() {
  if (!habit.value) return

  whatsappService.shareAchievement(
    `I'm building "${habit.value.name}" on Track.now. ${missionProgress.value.completedSessions}/${missionProgress.value.durationDays} mission days complete so far.`
  )
}

function confirmDelete() {
  deleteDialog.value = true
}

async function handleDelete() {
  if (!habit.value) return
  deleting.value = true
  try {
    await habitsStore.deleteHabit(habit.value.id)
    router.push('/habits')
    $q.notify({ message: 'Mission aborted', color: 'positive' })
  } catch (err) {
    $q.notify({ message: 'Failed to abort mission', color: 'negative' })
  } finally {
    deleting.value = false
    deleteDialog.value = false
  }
}
</script>

<style scoped lang="scss">
.habit-detail-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #fff;
  padding-bottom: 120px;
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

.detail-shell {
  position: relative;
  z-index: 1;
  width: min(920px, calc(100% - 28px));
  margin: 0 auto;
  padding-top: 18px;
}

.header-btn {
  color: #71717a;
}

.detail-main {
  display: grid;
  gap: 40px;
}

.briefing-head {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.briefing-emoji {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: #1b1b1c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: grid;
  place-items: center;
  font-size: 2.2rem;
}

.briefing-title {
  h1 {
    margin: 4px 0 0;
    font-size: clamp(2rem, 5vw, 2.8rem);
    font-weight: 900;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }
}

.protocol-tag {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  opacity: 0.9;
}

.pro-card {
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #141415;
  padding: 24px;
}

.kicker {
  display: block;
  font-size: 0.64rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: #71717a;
  margin-bottom: 8px;
}

.arc-container {
  display: grid;
  gap: 20px;
}

.arc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;

  h3 {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
}

.arc-stat {
  text-align: right;
  display: grid;
  gap: 2px;

  .stat-value {
    font-size: 1.8rem;
    font-weight: 900;
    line-height: 1;
  }

  .stat-label {
    font-size: 0.58rem;
    font-weight: 700;
    color: #71717a;
    letter-spacing: 0.1em;
  }
}

.arc-track {
  width: 100%;
  height: 6px;
  background: #27272a;
  border-radius: 999px;
  overflow: hidden;
}

.arc-fill {
  height: 100%;
  background: #fff;
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.arc-note {
  margin: 0;
  font-size: 0.9rem;
  color: #a1a1aa;
  line-height: 1.5;
}

.protocol-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.protocol-card {
  padding: 18px 22px;
}

.protocol-value {
  font-size: 1.05rem;
  font-weight: 700;
  color: #fff;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 10px;

  h2 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.02em;
  }

  .kicker {
    margin-bottom: 0;
  }
}

.activity-stack {
  display: grid;
  gap: 10px;
}

.activity-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.activity-copy {
  display: grid;
  gap: 2px;
}

.activity-main-label {
  font-size: 0.95rem;
  font-weight: 700;
}

.activity-sub-label {
  font-size: 0.72rem;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.activity-status {
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 4px 10px;
  border-radius: 999px;
}

.empty-state {
  text-align: center;
  color: #71717a;
  font-size: 0.9rem;
  padding: 32px;
  border-style: dashed;
}

.danger-zone {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.abort-btn {
  font-size: 0.8rem;
  opacity: 0.7;
  &:hover {
    opacity: 1;
    color: #ff453a !important;
  }
}

@media (max-width: 600px) {
  .protocol-grid {
    grid-template-columns: 1fr;
  }

  .briefing-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .arc-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;

    .arc-stat {
      text-align: left;
    }
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
</style>

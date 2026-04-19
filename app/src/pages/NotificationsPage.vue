<template>
  <q-page class="mission-notifications-page">
    <div class="grain-overlay" />

    <div class="notifications-shell">
      <header class="notifications-top">
        <div class="brand-wrap">
          <q-icon name="radio_button_checked" size="18px" />
          <span>Track.now</span>
        </div>

        <div class="title-block">
          <h1>Notifications</h1>
          <p>Helpful nudges, never noisy pressure.</p>
        </div>

        <q-btn no-caps unelevated class="permission-btn" icon="notifications_active" label="Request permission" @click="handlePermission" />
      </header>

      <main class="notifications-main">
        <section class="summary-grid">
          <article class="summary-card pro-card">
            <span>Browser Permission</span>
            <strong class="text-capitalize">{{ permissionState }}</strong>
            <small>Needed for local browser reminders and pre-alerts.</small>
          </article>

          <article class="summary-card pro-card">
            <span>Scheduled Today</span>
            <strong>{{ reminderPreview.length }}</strong>
            <small>Generated from your current habit reminders.</small>
          </article>
        </section>

        <section class="board-grid">
          <article class="settings-card pro-card">
            <div class="section-head compact">
              <h2>Behavior</h2>
            </div>

            <div class="column q-gutter-md settings-list">
              <q-toggle
                :model-value="preferences.reminderPreview"
                label="20-minute pre-reminders"
                color="white"
                keep-color
                @update:model-value="preferencesStore.updatePreference('reminderPreview', $event)"
              />
              <q-toggle
                :model-value="preferences.exactReminders"
                label="Exact-time action prompts"
                color="white"
                keep-color
                @update:model-value="preferencesStore.updatePreference('exactReminders', $event)"
              />
              <q-toggle
                :model-value="preferences.whatsappSummary"
                label="Daily WhatsApp summary"
                color="white"
                keep-color
                @update:model-value="preferencesStore.updatePreference('whatsappSummary', $event)"
              />
              <q-toggle
                :model-value="preferences.calmMode"
                label="Calm mode"
                color="white"
                keep-color
                @update:model-value="preferencesStore.updatePreference('calmMode', $event)"
              />
            </div>

            <div class="calm-note">
              Track.now keeps language gentle, avoids alarmist streak framing, and prefers progress-oriented reminders over pressure-heavy alerts.
            </div>
          </article>

          <article class="settings-card pro-card">
            <div class="section-head compact">
              <h2>Today Reminder Preview</h2>
            </div>

            <div v-if="reminderPreview.length === 0" class="empty-copy">
              Nothing is scheduled yet. Create a habit with reminder times to preview the alert flow.
            </div>

            <div v-else class="column q-gutter-sm">
              <div v-for="item in reminderPreview" :key="item.key" class="reminder-row">
                <div class="row items-center q-col-gutter-md no-wrap">
                  <div class="col-auto">
                    <div class="reminder-icon">{{ item.emoji }}</div>
                  </div>
                  <div class="col">
                    <div class="text-body2 text-weight-bold text-white">{{ item.name }}</div>
                    <div class="reminder-meta">{{ item.phaseLabel }}</div>
                  </div>
                  <div class="col-auto text-right">
                    <div class="text-body2 text-weight-medium text-white">{{ item.timeLabel }}</div>
                    <div class="reminder-meta">{{ item.category }}</div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { notificationService } from 'src/services/notificationService'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import { usePreferencesStore } from 'src/stores/preferences'
import {
  formatTimeLabel,
  getCategoryMeta,
  getHabitSessionProgressForDate,
  normalizeReminderTimes
} from 'src/utils/habitModel'

const $q = useQuasar()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()
const preferencesStore = usePreferencesStore()
const permissionState = ref(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

const preferences = computed(() => preferencesStore.preferences)

const reminderPreview = computed(() => {
  return habitsStore.todayHabits.flatMap((habit) => {
    const sessionProgress = getHabitSessionProgressForDate(habit, completionsStore.completions)
    const pendingTimes = normalizeReminderTimes(habit.reminderTimes, habit.time)
      .filter((time) => !sessionProgress.completedSessionSet.has(time))

    return pendingTimes.flatMap((time) => {
      const category = getCategoryMeta(habit.category)

      return [
        {
          key: `${habit.id}-${time}-pre`,
          name: habit.name,
          emoji: habit.emoji,
          category: category.label,
          phaseLabel: 'Upcoming reminder',
          timeLabel: formatTimeLabel(time)
        },
        {
          key: `${habit.id}-${time}-exact`,
          name: habit.name,
          emoji: habit.emoji,
          category: category.label,
          phaseLabel: 'Exact-time action prompt',
          timeLabel: formatTimeLabel(time)
        }
      ]
    })
  })
})

onMounted(async () => {
  if (completionsStore.completions.length === 0) {
    await completionsStore.fetchToday()
  }
})

async function handlePermission() {
  const granted = await notificationService.requestPermission()
  permissionState.value = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  $q.notify({
    message: granted ? 'Notification permission enabled' : 'Notification permission not granted',
    color: granted ? 'positive' : 'warning'
  })
}
</script>

<style scoped lang="scss">
.mission-notifications-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #e5e2e1;
  padding-bottom: 118px;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
}

.notifications-shell {
  position: relative;
  z-index: 1;
  max-width: 1060px;
  margin: 0 auto;
  padding: clamp(16px, 2vw, 28px);
}

.notifications-top {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.title-block h1 {
  margin: 0;
  color: #fff;
  font-size: clamp(1.3rem, 3vw, 1.8rem);
  font-weight: 900;
  letter-spacing: -0.03em;
}

.title-block p {
  margin: 4px 0 0;
  color: #a0a0a6;
  font-size: 0.84rem;
}

.permission-btn {
  border-radius: 12px;
  background: #fff;
  color: #000;
  font-weight: 700;
}

.notifications-main {
  display: grid;
  gap: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.summary-card {
  border-radius: 16px;
  padding: 12px;
  display: grid;
  gap: 6px;
}

.summary-card span {
  color: #8f8f95;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.summary-card strong {
  color: #fff;
  font-size: 1.2rem;
  font-weight: 900;
}

.summary-card small {
  color: #9d9da4;
  font-size: 0.77rem;
  line-height: 1.34;
}

.board-grid {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 12px;
}

.settings-card {
  border-radius: 18px;
  padding: 14px;
}

.section-head.compact {
  margin-bottom: 10px;
}

.section-head h2 {
  margin: 0;
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.settings-list :deep(.q-toggle__label) {
  color: #e0e0e4;
  font-size: 0.86rem;
}

.calm-note {
  margin-top: 14px;
  color: #9b9ba1;
  font-size: 0.79rem;
  line-height: 1.45;
}

.empty-copy {
  color: #9a9aa0;
  font-size: 0.83rem;
}

.reminder-row {
  padding: 11px;
  border-radius: 14px;
  background: rgba(20, 20, 20, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.reminder-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  background: rgba(255, 255, 255, 0.08);
}

.reminder-meta {
  color: #9999a0;
  font-size: 0.72rem;
}

@media (max-width: 900px) {
  .notifications-top {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .board-grid {
    grid-template-columns: 1fr;
  }
}
</style>

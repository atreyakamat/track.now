<template>
  <q-page class="page-container notifications-page">
    <div class="row items-end q-col-gutter-md q-mb-lg">
      <div class="col">
        <div class="text-overline text-primary section-kicker">Notifications</div>
        <div class="text-h4 text-weight-bold">Helpful nudges, not background noise</div>
        <div class="text-body2 text-grey-7 q-mt-sm">
          Control pre-reminders, exact-time prompts, and WhatsApp summaries from one place.
        </div>
      </div>
      <div class="col-auto">
        <q-btn label="Request permission" color="primary" unelevated no-caps @click="handlePermission" />
      </div>
    </div>

    <div class="summary-grid q-mb-lg">
      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Browser permission</div>
          <div class="text-h6 text-weight-bold q-mt-xs text-capitalize">{{ permissionState }}</div>
          <div class="text-body2 text-grey-7 q-mt-sm">Needed for local browser notifications and pre-alerts.</div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Scheduled today</div>
          <div class="text-h6 text-weight-bold q-mt-xs">{{ reminderPreview.length }}</div>
          <div class="text-body2 text-grey-7 q-mt-sm">Visible reminders generated from your current today habits.</div>
        </q-card-section>
      </q-card>
    </div>

    <div class="row q-col-gutter-lg">
      <div class="col-12 col-lg-5">
        <q-card flat bordered class="settings-card q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Behavior</div>
            <div class="column q-gutter-md">
              <q-toggle
                :model-value="preferences.reminderPreview"
                label="20-minute pre-reminders"
                @update:model-value="preferencesStore.updatePreference('reminderPreview', $event)"
              />
              <q-toggle
                :model-value="preferences.exactReminders"
                label="Exact-time action prompts"
                @update:model-value="preferencesStore.updatePreference('exactReminders', $event)"
              />
              <q-toggle
                :model-value="preferences.whatsappSummary"
                label="Daily WhatsApp summary"
                @update:model-value="preferencesStore.updatePreference('whatsappSummary', $event)"
              />
              <q-toggle
                :model-value="preferences.calmMode"
                label="Calm mode"
                @update:model-value="preferencesStore.updatePreference('calmMode', $event)"
              />
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="settings-card">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">What calm mode means</div>
            <div class="text-body2 text-grey-7">
              Track.now keeps language gentle, avoids alarmist “streak broken” framing, and prefers progress-oriented reminders over pressure-heavy alerts.
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-lg-7">
        <q-card flat bordered class="settings-card">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Today’s reminder preview</div>
            <div v-if="reminderPreview.length === 0" class="text-body2 text-grey-7">
              Nothing is scheduled yet. Create a habit with one or more reminder times to preview the alert flow.
            </div>
            <div v-else class="column q-gutter-sm">
              <div v-for="item in reminderPreview" :key="item.key" class="reminder-row">
                <div class="row items-center q-col-gutter-md no-wrap">
                  <div class="col-auto">
                    <div class="reminder-icon">{{ item.emoji }}</div>
                  </div>
                  <div class="col">
                    <div class="text-body2 text-weight-bold">{{ item.name }}</div>
                    <div class="text-caption text-grey-7">{{ item.phaseLabel }}</div>
                  </div>
                  <div class="col-auto text-right">
                    <div class="text-body2 text-weight-medium">{{ item.timeLabel }}</div>
                    <div class="text-caption text-grey-6">{{ item.category }}</div>
                  </div>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { notificationService } from 'src/services/notificationService'
import { useHabitsStore } from 'src/stores/habits'
import { usePreferencesStore } from 'src/stores/preferences'
import { formatTimeLabel, getCategoryMeta, normalizeReminderTimes } from 'src/utils/habitModel'

const $q = useQuasar()
const habitsStore = useHabitsStore()
const preferencesStore = usePreferencesStore()
const permissionState = ref(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

const preferences = computed(() => preferencesStore.preferences)

const reminderPreview = computed(() => {
  return habitsStore.todayHabits.flatMap((habit) => {
    return normalizeReminderTimes(habit.reminderTimes, habit.time).flatMap((time) => {
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
.section-kicker {
  letter-spacing: 0.12em;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.summary-card,
.settings-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.reminder-row {
  padding: 12px;
  border-radius: 18px;
  background: #fbfcfd;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.reminder-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  background: rgba(36, 92, 104, 0.08);
}
</style>

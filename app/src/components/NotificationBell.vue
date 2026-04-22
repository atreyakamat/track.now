<template>
  <q-btn flat round dense icon="notifications_none" @click="showNotifications = true">
    <q-badge v-if="unreadCount > 0" color="negative" floating>{{ unreadCount }}</q-badge>
  </q-btn>

  <q-dialog v-model="showNotifications" position="top">
    <q-card class="notification-sheet app-dialog-card">
      <q-card-section class="row items-center">
        <div class="text-h6">Notifications</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>
      <q-separator />

      <q-card-section v-if="notifications.length === 0" class="text-center text-grey q-py-xl">
        <q-icon name="notifications_off" size="48px" />
        <div class="q-mt-sm">Nothing needs your attention right now</div>
      </q-card-section>

      <q-list v-else>
        <q-item v-for="notification in notifications" :key="notification.id" class="q-py-md">
          <q-item-section avatar>
            <q-icon :name="notification.icon" :color="notification.color" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ notification.title }}</q-item-label>
            <q-item-label caption>{{ notification.body }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <q-separator />
      <q-card-actions align="right">
        <q-btn flat no-caps label="Open notifications" @click="openNotifications" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import { formatTimeLabel, getHabitSessionProgressForDate, isHabitCompleteOnDate } from 'src/utils/habitModel'

const router = useRouter()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()
const showNotifications = ref(false)

const notifications = computed(() => {
  const pendingHabits = habitsStore.todayHabits.filter((habit) => {
    return !isHabitCompleteOnDate(habit, completionsStore.completions)
  })

  const habitNotifications = pendingHabits.slice(0, 4).map((habit) => {
    const sessionProgress = getHabitSessionProgressForDate(habit, completionsStore.completions)
    const nextSessionLabel = formatTimeLabel(sessionProgress.nextSessionId || habit.time)

    return {
      id: habit.id,
      title: `${habit.emoji} ${habit.name}`,
      body: sessionProgress.totalSessions > 1
        ? `${sessionProgress.completedSessions}/${sessionProgress.totalSessions} sessions done today. Next at ${nextSessionLabel}.`
        : `Next reminder: ${nextSessionLabel}`,
      icon: 'schedule',
      color: 'primary'
    }
  })

  if (pendingHabits.length === 0 && habitsStore.todayHabits.length > 0) {
    return [{
      id: 'all-done',
      title: 'Today is complete',
      body: 'Everything scheduled for today has been checked off.',
      icon: 'check_circle',
      color: 'positive'
    }]
  }

  return habitNotifications
})

const unreadCount = computed(() => notifications.value.length)

onMounted(async () => {
  if (completionsStore.completions.length === 0) {
    await completionsStore.fetchToday()
  }
})

function openNotifications() {
  showNotifications.value = false
  router.push('/notifications')
}
</script>

<style scoped>
.notification-sheet {
  width: 360px;
  max-width: 100vw;
  margin-top: 48px;
  border-radius: 20px;
}
</style>

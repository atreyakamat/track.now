<template>
  <q-btn flat round dense icon="notifications_none" @click="showNotifications = true">
    <q-badge v-if="unreadCount > 0" color="negative" floating>{{ unreadCount }}</q-badge>
  </q-btn>

  <q-dialog v-model="showNotifications" position="top">
    <q-card style="width: 360px; max-width: 100vw; margin-top: 48px">
      <q-card-section class="row items-center">
        <div class="text-h6">Notifications</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>
      <q-separator />
      <q-card-section v-if="notifications.length === 0" class="text-center text-grey q-py-xl">
        <q-icon name="notifications_off" size="48px" />
        <div class="q-mt-sm">No notifications yet</div>
      </q-card-section>
      <q-list v-else>
        <q-item v-for="n in notifications" :key="n.id" class="q-py-md">
          <q-item-section avatar>
            <q-icon :name="n.icon" :color="n.color" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ n.title }}</q-item-label>
            <q-item-label caption>{{ n.body }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const showNotifications = ref(false)
const unreadCount = ref(0)
const notifications = ref([])

onMounted(() => {
  notifications.value = [
    { id: 1, title: '🔥 Keep your streak!', body: "Don't forget your habits for today", icon: 'local_fire_department', color: 'orange' },
    { id: 2, title: '🎉 Milestone reached!', body: 'You completed 7 days in a row', icon: 'emoji_events', color: 'amber' }
  ]
  unreadCount.value = notifications.value.length
})
</script>

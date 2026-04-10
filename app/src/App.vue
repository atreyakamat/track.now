<template>
  <router-view />
</template>

<script setup>
import { useQuasar } from 'quasar'
import { onMounted } from 'vue'
import { usePreferencesStore } from 'src/stores/preferences'

const $q = useQuasar()
const preferencesStore = usePreferencesStore()

onMounted(() => {
  const themePreference = preferencesStore.themePreference
  const stored = localStorage.getItem('dark-mode')

  if (themePreference === 'dark' || stored === 'true') {
    $q.dark.set(true)
    return
  }

  if (themePreference === 'light' || stored === 'false') {
    $q.dark.set(false)
    return
  }

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  $q.dark.set(prefersDark)
})
</script>

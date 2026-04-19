<template>
  <router-view v-slot="{ Component, route }">
    <transition name="route-shell" mode="out-in" appear>
      <component :is="Component" :key="route.fullPath" />
    </transition>
  </router-view>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed, onMounted, watch } from 'vue'
import { usePreferencesStore } from 'src/stores/preferences'

const $q = useQuasar()
const preferencesStore = usePreferencesStore()
const reduceMotion = computed(() => Boolean(preferencesStore.preferences.reduceMotion))

function applyThemePreference() {
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
}

onMounted(() => {
  applyThemePreference()
})

watch(() => preferencesStore.themePreference, () => {
  applyThemePreference()
})

watch(reduceMotion, (value) => {
  document.body.classList.toggle('reduce-motion', value)
}, {
  immediate: true
})
</script>

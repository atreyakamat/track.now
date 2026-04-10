import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'tracknow-preferences'

const defaultPreferences = {
  startPage: 'today',
  reminderPreview: true,
  exactReminders: true,
  whatsappSummary: false,
  calmMode: true,
  reduceMotion: false,
  themePreference: 'system'
}

function readPreferences() {
  if (typeof window === 'undefined') return { ...defaultPreferences }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaultPreferences, ...JSON.parse(raw) } : { ...defaultPreferences }
  } catch {
    return { ...defaultPreferences }
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const preferences = ref(readPreferences())

  watch(preferences, (nextValue) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue))
  }, { deep: true })

  function updatePreference(key, value) {
    preferences.value = {
      ...preferences.value,
      [key]: value
    }
  }

  function resetPreferences() {
    preferences.value = { ...defaultPreferences }
  }

  const startPage = computed(() => preferences.value.startPage)
  const themePreference = computed(() => preferences.value.themePreference)

  return {
    preferences,
    startPage,
    themePreference,
    updatePreference,
    resetPreferences
  }
})

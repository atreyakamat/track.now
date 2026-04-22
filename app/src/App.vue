<template>
  <router-view />
</template>

<script setup>
import { useQuasar } from 'quasar'
import { onMounted } from 'vue'

const $q = useQuasar()

onMounted(() => {
  // Force dark mode as per PRD/Design guidelines
  $q.dark.set(true)
})
</script>

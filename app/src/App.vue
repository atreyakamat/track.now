<template>
  <router-view />
</template>

<script setup>
import { useQuasar } from 'quasar'
import { onMounted } from 'vue'

const $q = useQuasar()

onMounted(() => {
  const stored = localStorage.getItem('dark-mode')
  if (stored === 'true') {
    $q.dark.set(true)
  }
})
</script>

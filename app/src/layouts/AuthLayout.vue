<template>
  <q-layout view="lHh lpr lFf">
    <q-page-container>
      <q-page class="auth-page flex flex-center">
        <div class="auth-container">
          <div class="auth-header text-center q-mb-xl">
            <div class="app-logo text-h3 q-mb-sm">⚡</div>
            <div class="text-h5 text-weight-bold text-primary">Track.now</div>
            <div class="text-caption text-grey">Build habits that stick</div>
          </div>
          <router-view />
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
</script>

<style scoped lang="scss">
.auth-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
  .body--dark & {
    background: linear-gradient(135deg, #0a0a1a 0%, #0f0a1f 100%);
  }
}
.auth-container {
  width: 100%;
  max-width: 400px;
  padding: 24px;
}
</style>

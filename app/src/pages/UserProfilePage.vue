<template>
  <q-page class="page-container user-profile-page">
    <div class="profile-card">
      <div class="profile-avatar">{{ initial }}</div>
      <div class="text-overline text-primary q-mt-lg">Profile</div>
      <div class="text-h4 text-weight-bold q-mt-sm">{{ resolvedName }}</div>
      <div class="text-body2 text-grey-7 q-mt-sm">
        Public accountability pages stay intentionally light in Track.now. They exist to encourage consistency, not perform productivity.
      </div>
      <div class="row q-gutter-sm justify-center q-mt-md">
        <q-chip dense square class="profile-chip">Calm accountability</q-chip>
        <q-chip dense square class="profile-chip">Mission-based habits</q-chip>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const resolvedName = computed(() => {
  const raw = String(route.params.username || 'user')
  return raw
    .split(/[-_.]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
})

const initial = computed(() => resolvedName.value.charAt(0))
</script>

<style scoped lang="scss">
.profile-card {
  padding: 48px 24px;
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background:
    radial-gradient(circle at top left, rgba(36, 92, 104, 0.12), transparent 48%),
    #ffffff;
  text-align: center;
}

.profile-avatar {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(36, 92, 104, 0.08);
  color: #245c68;
  font-size: 2rem;
  font-weight: 700;
}

.profile-chip {
  background: rgba(76, 95, 115, 0.08);
  color: #334155;
}
</style>

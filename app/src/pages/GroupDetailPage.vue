<template>
  <q-page class="page-container group-detail-page">
    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading && !group" class="detail-empty text-center">
      <div class="text-h3 q-mb-md">🏘️</div>
      <div class="text-h6 text-weight-bold q-mb-sm">Group not found</div>
      <div class="text-body2 text-grey-7 q-mb-lg">This group may have been deleted or you may not be a member of it yet.</div>
      <q-btn label="Back to groups" color="primary" unelevated to="/groups" />
    </div>

    <div v-else-if="group">
      <div class="row items-end q-col-gutter-md q-mb-lg">
        <div class="col">
          <div class="text-overline text-primary section-kicker">Group</div>
          <div class="text-h4 text-weight-bold">{{ group.name }}</div>
          <div class="text-body2 text-grey-7 q-mt-sm">
            {{ group.description || 'Shared accountability space for calm, low-noise habit building.' }}
          </div>
        </div>
        <div class="col-auto">
          <q-btn label="Share invite" color="primary" unelevated no-caps icon="share" @click="shareGroup" />
        </div>
      </div>

      <div class="summary-grid q-mb-lg">
        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Members</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ group.members?.length || 1 }}</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="summary-card">
          <q-card-section>
            <div class="text-caption text-grey-7">Shared missions</div>
            <div class="text-h5 text-weight-bold q-mt-xs">{{ suggestedMissions.length }}</div>
          </q-card-section>
        </q-card>
      </div>

      <q-card flat bordered class="detail-card">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-md">Suggested group rituals</div>
          <div class="column q-gutter-md">
            <div v-for="mission in suggestedMissions" :key="mission.title" class="suggestion-card">
              <div class="text-body1 text-weight-bold">{{ mission.title }}</div>
              <div class="text-body2 text-grey-7 q-mt-xs">{{ mission.description }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { whatsappService } from 'src/services/whatsappService'
import { useGroupsStore } from 'src/stores/groups'

const route = useRoute()
const groupsStore = useGroupsStore()
const loading = ref(true)
const group = ref(null)

const suggestedMissions = [
  { title: 'Monday reset', description: 'A short check-in every Monday to align the group for the week ahead.' },
  { title: 'Shared reading sprint', description: '20 minutes of focused reading tracked by each member on the same evenings.' },
  { title: 'Weekend review', description: 'One reflective habit that helps the group close the week with intention.' }
]

onMounted(async () => {
  group.value = await groupsStore.getGroupById(route.params.id)
  loading.value = false
})

function shareGroup() {
  if (!group.value) return
  whatsappService.shareAchievement(`Join my Track.now group "${group.value.name}" with invite code ${group.value.id}.`)
}
</script>

<style scoped lang="scss">
.section-kicker {
  letter-spacing: 0.12em;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.summary-card,
.detail-card,
.detail-empty {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.suggestion-card {
  padding: 14px;
  border-radius: 18px;
  background: #fbfcfd;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.detail-empty {
  padding: 48px 24px;
  background: #ffffff;
}
</style>

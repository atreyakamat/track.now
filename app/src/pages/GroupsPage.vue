<template>
  <q-page class="mission-groups-page">
    <div class="grain-overlay" />

    <div class="groups-shell">
      <AppPageHeader title="Groups" subtitle="Small communities, shared momentum.">
        <template #right>
          <div class="actions-wrap">
            <q-btn no-caps unelevated class="create-btn" icon="group_add" label="Create group" @click="createDialog = true" />
            <q-btn no-caps outline color="grey-5" class="join-btn" icon="login" label="Join group" @click="joinDialog = true" />
          </div>
        </template>
      </AppPageHeader>

      <q-inner-loading :showing="loading">
        <q-spinner color="white" size="48px" />
      </q-inner-loading>

      <main v-if="!loading" class="groups-main">
        <section v-if="groups.length === 0" class="empty-card pro-card">
          <div class="empty-mark">*</div>
          <h2>No groups yet</h2>
          <p>Create a group for a reading club, family challenge, or a calm accountability circle.</p>
          <q-btn no-caps unelevated class="create-btn" icon="group_add" label="Create first group" @click="createDialog = true" />
        </section>

        <section v-else class="groups-list">
          <article v-for="group in groups" :key="group.id" class="group-card pro-card">
            <div class="group-badge">G</div>

            <div class="group-copy">
              <div class="group-head">
                <h3>{{ group.name }}</h3>
                <q-btn flat round dense icon="open_in_new" color="grey-5" @click="router.push(`/group/${group.id}`)" />
              </div>

              <p>
                {{ group.description || 'A shared habit space for collective progress and light accountability.' }}
              </p>

              <div class="meta-row">
                <span>{{ group.members?.length || 1 }} members</span>
                <span>Invite code: {{ group.id }}</span>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>

    <q-dialog v-model="createDialog">
      <q-card class="dialog-card" style="min-width: 320px">
        <q-card-section><div class="dialog-title">Create group</div></q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="newGroup.name" dark label="Group name" outlined :rules="[v => !!v || 'Required']" />
          <q-input v-model="newGroup.description" dark label="Description" outlined type="textarea" rows="2" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey-5" v-close-popup />
          <q-btn unelevated label="Create" class="dialog-btn" @click="handleCreate" :loading="creating" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="joinDialog">
      <q-card class="dialog-card" style="min-width: 320px">
        <q-card-section><div class="dialog-title">Join group</div></q-card-section>
        <q-card-section>
          <q-input v-model="joinCode" dark label="Group ID or invite code" outlined />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey-5" v-close-popup />
          <q-btn unelevated label="Join" class="dialog-btn" @click="handleJoin" :loading="joining" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { whatsappService } from 'src/services/whatsappService'
import { useGroupsStore } from 'src/stores/groups'
import AppPageHeader from 'src/components/AppPageHeader.vue'

const router = useRouter()
const $q = useQuasar()
const groupsStore = useGroupsStore()

const createDialog = ref(false)
const joinDialog = ref(false)
const creating = ref(false)
const joining = ref(false)
const joinCode = ref('')
const newGroup = ref({ name: '', description: '' })

const loading = computed(() => groupsStore.loading)
const groups = computed(() => groupsStore.groups)

onMounted(() => groupsStore.fetchGroups())

async function handleCreate() {
  if (!newGroup.value.name) return

  creating.value = true
  try {
    const groupId = await groupsStore.createGroup(newGroup.value.name, newGroup.value.description)
    $q.notify({ message: 'Group created', color: 'positive' })
    createDialog.value = false
    newGroup.value = { name: '', description: '' }
    whatsappService.shareAchievement(`Join my new Track.now group with invite code ${groupId}.`)
  } catch {
    $q.notify({ message: 'Failed to create group', color: 'negative' })
  } finally {
    creating.value = false
  }
}

async function handleJoin() {
  if (!joinCode.value) return

  joining.value = true
  try {
    await groupsStore.joinGroup(joinCode.value)
    $q.notify({ message: 'Joined group', color: 'positive' })
    joinDialog.value = false
    joinCode.value = ''
  } catch {
    $q.notify({ message: 'Group not found', color: 'negative' })
  } finally {
    joining.value = false
  }
}
</script>

<style scoped lang="scss">
.mission-groups-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #e5e2e1;
  padding-bottom: 118px;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
}

.groups-shell {
  position: relative;
  z-index: 1;
  max-width: 1040px;
  margin: 0 auto;
  padding: clamp(16px, 2vw, 28px);
}

.groups-top {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.title-block h1 {
  margin: 0;
  color: #fff;
  font-size: clamp(1.3rem, 3vw, 1.85rem);
  font-weight: 900;
  letter-spacing: -0.03em;
}

.title-block p {
  margin: 4px 0 0;
  color: #a0a0a6;
  font-size: 0.84rem;
}

.actions-wrap {
  display: inline-flex;
  gap: 8px;
}

.create-btn {
  border-radius: 12px;
  background: #fff;
  color: #000;
  font-weight: 700;
}

.join-btn {
  border-radius: 12px;
}

.groups-main {
  display: grid;
  gap: 12px;
}

.empty-card {
  border-radius: 18px;
  padding: 28px 18px;
  text-align: center;
}

.empty-mark {
  color: #fff;
  font-size: 1.8rem;
  font-weight: 900;
  line-height: 1;
}

.empty-card h2 {
  margin: 12px 0 0;
  color: #fff;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.empty-card p {
  margin: 8px auto 14px;
  max-width: 460px;
  color: #a0a0a6;
  font-size: 0.86rem;
}

.groups-list {
  display: grid;
  gap: 10px;
}

.group-card {
  border-radius: 16px;
  padding: 12px;
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 10px;
}

.group-badge {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.92rem;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.group-copy {
  min-width: 0;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.group-head h3 {
  margin: 0;
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.group-copy p {
  margin: 6px 0 0;
  color: #a0a0a6;
  font-size: 0.82rem;
  line-height: 1.42;
}

.meta-row {
  margin-top: 9px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-row span {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #d6d6db;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.dialog-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #121212;
  color: #fff;
}

.dialog-title {
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
}

.dialog-btn {
  border-radius: 10px;
  background: #fff;
  color: #000;
  font-weight: 700;
}

@media (max-width: 920px) {
  .groups-top {
    grid-template-columns: 1fr;
    justify-items: start;
  }
}

@media (max-width: 560px) {
  .actions-wrap {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
  }

  .group-card {
    grid-template-columns: 1fr;
  }
}
</style>

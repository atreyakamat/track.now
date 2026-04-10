<template>
  <q-page class="page-container groups-page">
    <div class="row items-end q-col-gutter-md q-mb-lg">
      <div class="col">
        <div class="text-overline text-primary section-kicker">Groups</div>
        <div class="text-h4 text-weight-bold">Small communities, shared momentum</div>
        <div class="text-body2 text-grey-7 q-mt-sm">
          Groups are meant for low-noise accountability, not noisy leaderboards.
        </div>
      </div>
      <div class="col-auto">
        <div class="row q-gutter-sm">
          <q-btn label="Create group" color="primary" unelevated no-caps icon="group_add" @click="createDialog = true" />
          <q-btn label="Join group" color="secondary" unelevated no-caps icon="login" @click="joinDialog = true" />
        </div>
      </div>
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading">
      <div v-if="groups.length === 0" class="empty-card text-center">
        <div class="text-h3 q-mb-md">🏘️</div>
        <div class="text-h6 text-weight-bold q-mb-sm">No groups yet</div>
        <div class="text-body2 text-grey-7 q-mb-lg">
          Create a group for a reading club, family challenge, or a quiet accountability circle.
        </div>
        <q-btn label="Create first group" color="primary" unelevated @click="createDialog = true" />
      </div>

      <div v-else class="column q-gutter-md">
        <q-card v-for="group in groups" :key="group.id" flat bordered class="group-card">
          <q-card-section>
            <div class="row items-start q-col-gutter-md">
              <div class="col-auto">
                <div class="group-badge">🏘️</div>
              </div>
              <div class="col">
                <div class="row items-center q-mb-xs">
                  <div class="text-subtitle1 text-weight-bold">{{ group.name }}</div>
                  <q-space />
                  <q-btn flat round dense icon="open_in_new" color="grey-7" @click="router.push(`/group/${group.id}`)" />
                </div>
                <div class="text-body2 text-grey-7">
                  {{ group.description || 'A shared habit space for collective progress and light accountability.' }}
                </div>
                <div class="row q-gutter-sm q-mt-md">
                  <q-chip dense square class="meta-chip">{{ group.members?.length || 1 }} members</q-chip>
                  <q-chip dense square class="meta-chip">Invite code: {{ group.id }}</q-chip>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-dialog v-model="createDialog">
      <q-card style="min-width: 320px">
        <q-card-section><div class="text-h6">Create group</div></q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="newGroup.name" label="Group name" outlined :rules="[v => !!v || 'Required']" />
          <q-input v-model="newGroup.description" label="Description" outlined type="textarea" rows="2" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated label="Create" color="primary" @click="handleCreate" :loading="creating" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="joinDialog">
      <q-card style="min-width: 320px">
        <q-card-section><div class="text-h6">Join group</div></q-card-section>
        <q-card-section>
          <q-input v-model="joinCode" label="Group ID or invite code" outlined />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated label="Join" color="secondary" @click="handleJoin" :loading="joining" />
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
.section-kicker {
  letter-spacing: 0.12em;
}

.empty-card,
.group-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: #ffffff;
}

.empty-card {
  padding: 48px 24px;
}

.group-badge {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(36, 92, 104, 0.08);
  font-size: 1.6rem;
}

.meta-chip {
  background: rgba(76, 95, 115, 0.08);
  color: #334155;
}
</style>

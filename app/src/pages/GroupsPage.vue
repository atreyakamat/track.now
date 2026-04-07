<template>
  <q-page class="page-container">
    <div class="text-h5 text-weight-bold q-mb-sm">Groups</div>
    <div class="text-caption text-grey q-mb-lg">Build habits with your community</div>

    <div class="row q-gutter-sm q-mb-lg">
      <q-btn label="Create Group" color="primary" unelevated icon="group_add" class="col" @click="createDialog = true" />
      <q-btn label="Join Group" color="secondary" unelevated icon="login" class="col" @click="joinDialog = true" />
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading && groups.length === 0" class="text-center q-py-xl">
      <div class="text-h3 q-mb-md">🏘️</div>
      <div class="text-h6 text-weight-bold q-mb-sm">No groups yet</div>
      <div class="text-grey">Create or join a group to start tracking habits together!</div>
    </div>

    <q-card v-for="group in groups" :key="group.id" flat bordered class="q-mb-md">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <div class="text-h5 q-mr-sm">🏘️</div>
          <div class="col">
            <div class="text-subtitle1 text-weight-bold">{{ group.name }}</div>
            <div class="text-caption text-grey">{{ group.members?.length || 1 }} members</div>
          </div>
          <q-btn flat round dense icon="more_vert">
            <q-menu>
              <q-list>
                <q-item clickable v-close-popup @click="shareGroup(group)">
                  <q-item-section>Share</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div v-if="group.description" class="text-body2 text-grey">{{ group.description }}</div>
      </q-card-section>
    </q-card>

    <q-dialog v-model="createDialog">
      <q-card style="min-width: 320px">
        <q-card-section><div class="text-h6">Create Group</div></q-card-section>
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
        <q-card-section><div class="text-h6">Join Group</div></q-card-section>
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
import { useQuasar } from 'quasar'
import { useGroupsStore } from 'src/stores/groups'
import { whatsappService } from 'src/services/whatsappService'

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
    await groupsStore.createGroup(newGroup.value.name, newGroup.value.description)
    $q.notify({ message: 'Group created!', color: 'positive' })
    createDialog.value = false
    newGroup.value = { name: '', description: '' }
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
    $q.notify({ message: 'Joined group!', color: 'positive' })
    joinDialog.value = false
    joinCode.value = ''
  } catch {
    $q.notify({ message: 'Group not found', color: 'negative' })
  } finally {
    joining.value = false
  }
}

function shareGroup(group) {
  whatsappService.shareAchievement(`Join my habit group "${group.name}" on Track.now! Group ID: ${group.id}`)
}
</script>

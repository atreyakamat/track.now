<template>
  <q-page class="page-container">
    <div class="text-h5 text-weight-bold q-mb-sm">Friends</div>
    <div class="text-caption text-grey q-mb-lg">Track habits together and stay accountable</div>

    <q-btn label="Add Friend" color="primary" unelevated icon="person_add" class="q-mb-lg full-width" @click="addDialog = true" />

    <div v-if="friendRequests.length > 0" class="q-mb-lg">
      <div class="text-subtitle2 q-mb-md">Friend Requests ({{ friendRequests.length }})</div>
      <q-card v-for="req in friendRequests" :key="req.id" flat bordered class="q-mb-sm">
        <q-card-section class="row items-center">
          <q-avatar color="primary" text-color="white" class="q-mr-md">
            {{ req.requestedBy[0]?.toUpperCase() }}
          </q-avatar>
          <div class="col">
            <div class="text-subtitle2">Friend request</div>
            <div class="text-caption text-grey">{{ req.requestedBy }}</div>
          </div>
          <div class="row q-gutter-xs">
            <q-btn unelevated color="positive" icon="check" size="sm" @click="acceptRequest(req.id)" />
            <q-btn flat color="negative" icon="close" size="sm" />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading && friends.length === 0" class="text-center q-py-xl">
      <div class="text-h3 q-mb-md">👥</div>
      <div class="text-h6 text-weight-bold q-mb-sm">No friends yet</div>
      <div class="text-grey">Invite friends to track habits together!</div>
    </div>

    <div v-else-if="!loading">
      <div class="text-subtitle2 q-mb-md">My Friends ({{ friends.length }})</div>
      <q-card v-for="friend in friends" :key="friend.id" flat bordered class="q-mb-sm">
        <q-card-section class="row items-center">
          <q-avatar color="secondary" text-color="white" class="q-mr-md">
            {{ friend.displayName?.[0]?.toUpperCase() || '?' }}
          </q-avatar>
          <div class="col">
            <div class="text-subtitle2">{{ friend.displayName }}</div>
            <div class="text-caption text-grey">{{ friend.email }}</div>
          </div>
          <q-btn flat round dense icon="share" color="grey" @click="shareWithFriend(friend)" />
        </q-card-section>
      </q-card>
    </div>

    <q-dialog v-model="addDialog">
      <q-card style="min-width: 320px">
        <q-card-section>
          <div class="text-h6">Add Friend</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="friendEmail" label="Friend's email" outlined type="email" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated label="Send Request" color="primary" @click="sendRequest" :loading="sending" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useFriendsStore } from 'src/stores/friends'
import { whatsappService } from 'src/services/whatsappService'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from 'src/boot/firebase'

const $q = useQuasar()
const friendsStore = useFriendsStore()

const addDialog = ref(false)
const friendEmail = ref('')
const sending = ref(false)

const friends = ref([])
const friendRequests = ref([])
const loading = ref(true)

onMounted(async () => {
  await Promise.all([
    friendsStore.fetchFriends(),
    friendsStore.fetchFriendRequests()
  ])
  friends.value = friendsStore.friends
  friendRequests.value = friendsStore.friendRequests
  loading.value = false
})

async function sendRequest() {
  if (!friendEmail.value) return
  sending.value = true
  try {
    const q = query(collection(db, 'users'), where('email', '==', friendEmail.value))
    const snap = await getDocs(q)
    if (snap.empty) {
      $q.notify({ message: 'User not found', color: 'warning' })
      return
    }
    const targetUser = snap.docs[0]
    await friendsStore.sendFriendRequest(targetUser.id)
    $q.notify({ message: 'Friend request sent!', color: 'positive' })
    addDialog.value = false
    friendEmail.value = ''
  } catch {
    $q.notify({ message: 'Failed to send request', color: 'negative' })
  } finally {
    sending.value = false
  }
}

async function acceptRequest(id) {
  await friendsStore.acceptRequest(id)
  friends.value = friendsStore.friends
  friendRequests.value = friendsStore.friendRequests
  $q.notify({ message: 'Friend added!', color: 'positive' })
}

function shareWithFriend(friend) {
  whatsappService.inviteFriend(friend.id)
}
</script>

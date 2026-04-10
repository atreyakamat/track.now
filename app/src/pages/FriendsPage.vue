<template>
  <q-page class="page-container friends-page">
    <div class="row items-end q-col-gutter-md q-mb-lg">
      <div class="col">
        <div class="text-overline text-primary section-kicker">Friends</div>
        <div class="text-h4 text-weight-bold">Accountability without the noise</div>
        <div class="text-body2 text-grey-7 q-mt-sm">
          Invite a few people you trust and keep the social layer quiet, useful, and optional.
        </div>
      </div>
      <div class="col-auto">
        <q-btn label="Add friend" color="primary" unelevated icon="person_add" no-caps @click="addDialog = true" />
      </div>
    </div>

    <div class="summary-grid q-mb-lg">
      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Connections</div>
          <div class="text-h5 text-weight-bold q-mt-xs">{{ friends.length }}</div>
        </q-card-section>
      </q-card>
      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Incoming requests</div>
          <div class="text-h5 text-weight-bold q-mt-xs">{{ friendRequests.length }}</div>
        </q-card-section>
      </q-card>
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading">
      <q-card v-if="friendRequests.length > 0" flat bordered class="friends-card q-mb-lg">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-md">Incoming requests</div>
          <div class="column q-gutter-sm">
            <div v-for="request in friendRequests" :key="request.id" class="friend-row">
              <q-avatar color="primary" text-color="white">
                {{ request.requestedByName?.[0]?.toUpperCase() || request.requestedBy?.[0]?.toUpperCase() }}
              </q-avatar>
              <div class="col">
                <div class="text-body2 text-weight-medium">Friend request</div>
                <div class="text-caption text-grey-7">{{ request.requestedByName || request.requestedBy }}</div>
                <div v-if="request.requestedByEmail" class="text-caption text-grey-6">{{ request.requestedByEmail }}</div>
              </div>
              <q-btn unelevated color="positive" icon="check" size="sm" @click="acceptRequest(request.id)" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="friends-card q-mb-lg">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">Your circle</div>
              <div class="text-caption text-grey-7">Tap a profile for a simple accountability card.</div>
            </div>
          </div>

          <div v-if="friends.length === 0" class="text-body2 text-grey-7">
            No friends yet. Add one or send a WhatsApp invite to start small.
          </div>

          <div v-else class="column q-gutter-sm">
            <button
              v-for="friend in friends"
              :key="friend.id"
              type="button"
              class="friend-row friend-link"
              @click="router.push(`/user/${slugify(friend.displayName || friend.email || friend.id)}`)"
            >
              <q-avatar color="secondary" text-color="white">
                {{ friend.displayName?.[0]?.toUpperCase() || '?' }}
              </q-avatar>
              <div class="col text-left">
                <div class="text-body2 text-weight-medium">{{ friend.displayName }}</div>
                <div class="text-caption text-grey-7">{{ friend.email }}</div>
              </div>
              <q-btn flat round dense icon="share" color="grey-7" @click.stop="shareWithFriend(friend)" />
            </button>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="friends-card">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-md">Invite flow</div>
          <div class="text-body2 text-grey-7 q-mb-md">
            Share a simple Track.now invite on WhatsApp and keep onboarding friction low.
          </div>
          <q-btn outline no-caps icon="chat" label="Invite via WhatsApp" @click="shareGenericInvite" />
        </q-card-section>
      </q-card>
    </div>

    <q-dialog v-model="addDialog">
      <q-card style="min-width: 320px">
        <q-card-section>
          <div class="text-h6">Add friend</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="friendEmail" label="Friend's email" outlined type="email" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated label="Send request" color="primary" @click="sendRequest" :loading="sending" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from 'src/boot/firebase'
import { whatsappService } from 'src/services/whatsappService'
import { useFriendsStore } from 'src/stores/friends'

const router = useRouter()
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
    const userQuery = query(collection(db, 'users'), where('email', '==', friendEmail.value))
    const snapshot = await getDocs(userQuery)

    if (snapshot.empty) {
      $q.notify({ message: 'User not found', color: 'warning' })
      return
    }

    await friendsStore.sendFriendRequest(snapshot.docs[0].id)
    $q.notify({ message: 'Friend request sent', color: 'positive' })
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
  $q.notify({ message: 'Friend added', color: 'positive' })
}

function shareWithFriend(friend) {
  whatsappService.inviteFriend(friend.id)
}

function shareGenericInvite() {
  whatsappService.shareAchievement('Join me on Track.now so we can keep each other accountable with calm daily habit check-ins.')
}

function slugify(value) {
  return String(value || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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
.friends-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.friend-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 18px;
  background: #fbfcfd;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.friend-link {
  width: 100%;
  text-align: left;
}
</style>

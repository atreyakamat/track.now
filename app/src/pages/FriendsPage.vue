<template>
  <q-page class="social-map-page">
    <div class="grain-overlay" />

    <div class="social-shell">
      <header class="social-top" data-reveal>
        <div class="brand-wrap">
          <q-icon name="radio_button_checked" size="18px" />
          <h1>Track.now</h1>
        </div>

        <div class="top-right">
          <nav class="desktop-tabs">
            <span>Today</span>
            <span>Tasks</span>
            <span class="active">Activity</span>
            <span>Planner</span>
          </nav>
          <div class="avatar-chip">{{ avatarInitial }}</div>
        </div>
      </header>

      <q-inner-loading :showing="loading">
        <q-spinner color="white" size="56px" />
      </q-inner-loading>

      <main v-if="!loading" class="social-main">
        <section class="pulse-header" data-reveal>
          <div class="title-block">
            <h2>Community Pulse</h2>

            <div class="stats-strip">
              <div>
                <span>Active Friends</span>
                <strong>{{ activeFriendsCount }}</strong>
              </div>

              <div class="divider" />

              <div>
                <span>Live Completions</span>
                <strong>{{ liveCompletionsCount }}</strong>
              </div>
            </div>
          </div>

          <div class="ghost-card">
            <div>
              <strong>Go Ghost</strong>
              <span>Privacy Mode</span>
            </div>

            <button type="button" class="ghost-switch" :class="{ active: ghostMode }" @click="toggleGhostMode">
              <span class="ghost-thumb" />
            </button>
          </div>
        </section>

        <section class="map-section" data-reveal>
          <div class="map-card">
            <div class="map-background" />
            <div class="map-grid">
              <span v-for="dot in mapDots" :key="dot" class="grid-dot" />
            </div>

            <button
              v-for="pin in mapPins"
              :key="pin.id"
              type="button"
              class="map-pin"
              :style="{ left: pin.left, top: pin.top }"
              @click="selectFriend(pin.friend)"
            >
              <span class="pin-wave" :class="`i-${pin.intensity}`" />
              <span class="pin-core" />
            </button>

            <div class="feed-chip">
              <span class="feed-dot" :class="{ muted: ghostMode }" />
              <span>{{ ghostMode ? 'Ghost mode active' : 'Live feed active' }}</span>
            </div>
          </div>

          <div v-if="selectedFriend" class="selected-panel">
            <div>
              <p>Selected Friend</p>
              <h4>{{ selectedFriend.displayName || selectedFriend.email || 'Community member' }}</h4>
            </div>

            <div class="panel-actions">
              <button type="button" class="nudge-fire" @click="sendNudge(selectedFriend, 'fire')">
                <q-icon name="local_fire_department" size="16px" />
              </button>
              <button type="button" class="nudge-clap" @click="sendNudge(selectedFriend, 'clap')">
                <q-icon name="pan_tool" size="16px" />
              </button>
              <button type="button" class="profile-btn" @click="openProfile(selectedFriend)">
                Open Profile
              </button>
            </div>
          </div>
        </section>

        <section v-if="friendRequests.length > 0" class="requests-section" data-reveal>
          <div class="section-head">
            <h3>Incoming Requests</h3>
            <span>{{ friendRequests.length }}</span>
          </div>

          <div class="requests-list">
            <article v-for="request in friendRequests" :key="request.id" class="request-card">
              <div class="request-left">
                <div class="request-avatar">
                  {{ request.requestedByName?.[0]?.toUpperCase() || request.requestedBy?.[0]?.toUpperCase() }}
                </div>
                <div>
                  <strong>{{ request.requestedByName || request.requestedBy }}</strong>
                  <p>{{ request.requestedByEmail || 'Pending account details' }}</p>
                </div>
              </div>

              <button type="button" class="accept-btn" @click="acceptRequest(request.id)">
                Accept
              </button>
            </article>
          </div>
        </section>

        <section class="friends-section" data-reveal>
          <div class="section-head">
            <div>
              <h3>Nearby Comrades</h3>
              <p>Send a nudge to keep the momentum.</p>
            </div>

            <q-btn
              unelevated
              no-caps
              icon="person_add"
              label="Add friend"
              class="add-btn"
              @click="addDialog = true"
            />
          </div>

          <div v-if="friends.length === 0" class="empty-card">
            <h4>No friends yet</h4>
            <p>Add your first friend or share a WhatsApp invite to start calm accountability.</p>
            <q-btn outline no-caps icon="chat" label="Invite via WhatsApp" @click="shareGenericInvite" />
          </div>

          <div v-else class="friends-grid">
            <article v-for="friend in friends" :key="friend.id" class="friend-card">
              <div class="friend-head">
                <div class="friend-avatar">
                  {{ (friend.displayName || friend.email || '?').charAt(0).toUpperCase() }}
                </div>
                <div class="friend-info">
                  <strong>{{ friend.displayName || 'Unnamed friend' }}</strong>
                  <span>{{ friend.email || 'No email available' }}</span>
                </div>
              </div>

              <div class="friend-actions">
                <button type="button" class="nudge-fire" @click="sendNudge(friend, 'fire')">
                  <q-icon name="local_fire_department" size="16px" />
                </button>
                <button type="button" class="nudge-clap" @click="sendNudge(friend, 'clap')">
                  <q-icon name="pan_tool" size="16px" />
                </button>
                <button type="button" class="profile-btn" @click="openProfile(friend)">
                  Profile
                </button>
              </div>
            </article>
          </div>
        </section>
      </main>

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
    </div>
  </q-page>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { whatsappService } from 'src/services/whatsappService'
import { useAuthStore } from 'src/stores/auth'
import { useCompletionsStore } from 'src/stores/completions'
import { useFriendsStore } from 'src/stores/friends'
import { getDateKey, shiftDate } from 'src/utils/habitModel'

const MAP_PIN_SLOTS = [
  { x: 32, y: 24 },
  { x: 50, y: 66 },
  { x: 74, y: 44 },
  { x: 22, y: 58 },
  { x: 64, y: 20 },
  { x: 84, y: 72 },
  { x: 14, y: 34 },
  { x: 40, y: 78 }
]

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()
const friendsStore = useFriendsStore()
const completionsStore = useCompletionsStore()

const addDialog = ref(false)
const friendEmail = ref('')
const sending = ref(false)
const initialLoading = ref(true)
const ghostMode = ref(false)
const selectedFriend = ref(null)

let revealObserver = null

const friends = computed(() => friendsStore.friends)
const friendRequests = computed(() => friendsStore.friendRequests)
const loading = computed(() => initialLoading.value || friendsStore.loading || completionsStore.loading)
const mapDots = computed(() => Array.from({ length: 88 }, (_, index) => index))
const avatarInitial = computed(() => {
  const source = String(authStore.displayName || authStore.user?.email || 'T').trim()
  return (source[0] || 'T').toUpperCase()
})

const activeFriendsCount = computed(() => friends.value.length)
const liveCompletionsCount = computed(() => {
  const startKey = getDateKey(shiftDate(new Date(), -6))
  return completionsStore.completions.filter((completion) => {
    return completion.completed !== false && completion.date >= startKey
  }).length
})

const ghostStorageKey = computed(() => `tracknow:ghost-mode:${authStore.userId || 'guest'}`)

const mapPins = computed(() => {
  if (ghostMode.value) return []

  return friends.value.slice(0, 8).map((friend, index) => {
    const hash = stableHash(friend.id || friend.email || `friend-${index}`)
    const slot = MAP_PIN_SLOTS[hash % MAP_PIN_SLOTS.length]
    const left = clamp(slot.x + (((hash % 9) - 4) * 1.2), 8, 92)
    const top = clamp(slot.y + (((Math.floor(hash / 11) % 9) - 4) * 1.1), 10, 88)

    return {
      id: friend.id || `pin-${index}`,
      friend,
      left: `${left}%`,
      top: `${top}%`,
      intensity: (hash % 3) + 1
    }
  })
})

onMounted(async () => {
  await Promise.all([
    friendsStore.fetchFriends(),
    friendsStore.fetchFriendRequests(),
    completionsStore.fetchLast90Days()
  ])

  loadGhostMode()

  if (friends.value.length > 0) {
    selectedFriend.value = friends.value[0]
  }

  initialLoading.value = false

  await nextTick()
  initRevealObserver()
})

onUnmounted(() => {
  if (revealObserver) {
    revealObserver.disconnect()
    revealObserver = null
  }
})

async function sendRequest() {
  if (!friendEmail.value) return

  sending.value = true
  try {
    const targetUser = await friendsStore.findUserByEmail(friendEmail.value)

    if (!targetUser) {
      $q.notify({ message: 'User not found', color: 'warning' })
      return
    }

    await friendsStore.sendFriendRequest(targetUser.id)
    $q.notify({ message: 'Friend request sent', color: 'positive' })
    addDialog.value = false
    friendEmail.value = ''
    await friendsStore.fetchFriendRequests()
  } catch {
    $q.notify({ message: 'Failed to send request', color: 'negative' })
  } finally {
    sending.value = false
  }
}

async function acceptRequest(id) {
  try {
    await friendsStore.acceptRequest(id)
    $q.notify({ message: 'Friend added', color: 'positive' })
  } catch {
    $q.notify({ message: 'Could not accept request', color: 'negative' })
  }
}

function toggleGhostMode() {
  const nextValue = !ghostMode.value
  ghostMode.value = nextValue
  persistGhostMode()

  if (nextValue) {
    selectedFriend.value = null
  } else if (!selectedFriend.value && friends.value.length > 0) {
    selectedFriend.value = friends.value[0]
  }
}

function loadGhostMode() {
  if (typeof window === 'undefined') return

  try {
    ghostMode.value = window.localStorage.getItem(ghostStorageKey.value) === 'true'
  } catch {
    ghostMode.value = false
  }
}

function persistGhostMode() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ghostStorageKey.value, String(ghostMode.value))
}

function sendNudge(friend, mode) {
  const actor = authStore.displayName || 'A friend'
  const target = friend.displayName || friend.email || 'you'

  const message = mode === 'fire'
    ? `🔥 ${actor} sent ${target} a fire nudge on Track.now. Keep momentum alive.`
    : `👏 ${actor} sent ${target} a clap nudge on Track.now. Great consistency so far.`

  whatsappService.shareAchievement(message)
}

function openProfile(friend) {
  router.push(`/user/${slugify(friend.displayName || friend.email || friend.id)}`)
}

function selectFriend(friend) {
  selectedFriend.value = friend
}

function shareGenericInvite() {
  whatsappService.shareAchievement(
    'Join me on Track.now so we can keep each other accountable with calm daily habit check-ins.'
  )
}

function slugify(value) {
  return String(value || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stableHash(value) {
  return String(value).split('').reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 7)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function initRevealObserver() {
  const targets = Array.from(document.querySelectorAll('.social-map-page [data-reveal]'))
  if (!targets.length) return

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    targets.forEach((target) => target.classList.add('is-visible'))
    return
  }

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      revealObserver?.unobserve(entry.target)
    })
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -10% 0px'
  })

  targets.forEach((target, index) => {
    target.classList.add('reveal-target')
    target.style.transitionDelay = `${Math.min((index % 6) * 70, 280)}ms`
    revealObserver?.observe(target)
  })
}
</script>

<style scoped lang="scss">
.social-map-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #e5e2e1;
  padding-bottom: 118px;
  overflow: hidden;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
}

.social-shell {
  position: relative;
  z-index: 1;
  width: min(980px, calc(100% - 28px));
  margin: 0 auto;
  padding-top: 18px;
}

.social-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;

  h1 {
    margin: 0;
    color: #fff;
    font-size: 1.08rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.05em;
  }
}

.top-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.desktop-tabs {
  display: inline-flex;
  gap: 18px;

  span {
    color: #6f6f74;
    font-size: 0.84rem;
    font-weight: 500;
    cursor: default;
  }

  .active {
    color: #fff;
  }
}

.avatar-chip {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #2a2a2a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.social-main {
  display: grid;
  gap: 24px;
}

.pulse-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
}

.title-block h2 {
  margin: 0;
  color: #fff;
  font-size: clamp(2.4rem, 9vw, 4.8rem);
  line-height: 0.95;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.03em;
}

.stats-strip {
  margin-top: 14px;
  display: inline-flex;
  align-items: center;
  gap: 14px;
}

.stats-strip div {
  display: grid;
}

.stats-strip span {
  color: #7f7f84;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.stats-strip strong {
  color: #fff;
  font-size: 1.9rem;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
}

.divider {
  width: 1px;
  height: 42px;
  background: rgba(255, 255, 255, 0.12);
}

.ghost-card {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: #1b1b1c;

  strong {
    display: block;
    color: #fff;
    font-size: 0.92rem;
    letter-spacing: -0.01em;
  }

  span {
    color: #7f7f84;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
  }
}

.ghost-switch {
  width: 48px;
  height: 24px;
  border-radius: 999px;
  border: 0;
  background: #353535;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.ghost-switch.active {
  background: #fff;
}

.ghost-thumb {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #fff;
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.ghost-switch.active .ghost-thumb {
  transform: translateX(24px);
  background: #000;
}

.map-section {
  display: grid;
  gap: 12px;
}

.map-card {
  position: relative;
  width: 100%;
  aspect-ratio: 21 / 9;
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1b1b1c;
  box-shadow: 0 24px 52px rgba(0, 0, 0, 0.45);
}

.map-background {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 16% 30%, rgba(255, 255, 255, 0.08), transparent 40%),
    radial-gradient(circle at 72% 60%, rgba(255, 255, 255, 0.06), transparent 45%),
    linear-gradient(180deg, #202020 0%, #121212 100%);
  opacity: 0.8;
}

.map-grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(11, minmax(0, 1fr));
  gap: 18px 24px;
  align-content: center;
  justify-items: center;
  padding: 24px;
  opacity: 0.1;
}

.grid-dot {
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: #fff;
}

.map-pin {
  position: absolute;
  width: 18px;
  height: 18px;
  border: 0;
  background: transparent;
  cursor: pointer;
  transform: translate(-50%, -50%);
}

.pin-wave {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: #fff;
  animation: pulseWave 2.2s ease-out infinite;
  opacity: 0.55;
}

.pin-wave.i-2 {
  animation-duration: 2.8s;
}

.pin-wave.i-3 {
  animation-duration: 1.9s;
}

.pin-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 4px solid #000;
  background: #fff;
  transform: translate(-50%, -50%);
}

.feed-chip {
  position: absolute;
  left: 16px;
  bottom: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.64);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.feed-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ff3b30;
}

.feed-dot.muted {
  background: #7f7f84;
}

.selected-panel {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: #1b1b1c;
  padding: 14px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;

  p {
    margin: 0;
    color: #7f7f84;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 700;
  }

  h4 {
    margin: 2px 0 0;
    color: #fff;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
}

.panel-actions,
.friend-actions {
  display: inline-flex;
  gap: 8px;
}

.nudge-fire,
.nudge-clap,
.profile-btn,
.accept-btn {
  border: 0;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:active {
    transform: scale(0.95);
  }
}

.nudge-fire,
.nudge-clap {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
}

.nudge-fire {
  background: #fff;
  color: #000;
}

.nudge-clap {
  background: #353535;
  color: #fff;
}

.profile-btn,
.accept-btn {
  border-radius: 12px;
  padding: 0 14px;
  height: 42px;
  background: #27272a;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 12px;

  h3 {
    margin: 0;
    color: #fff;
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  p {
    margin: 4px 0 0;
    color: #7f7f84;
    font-size: 0.82rem;
  }

  span {
    color: #7f7f84;
    font-size: 0.74rem;
    font-weight: 700;
  }
}

.requests-list {
  display: grid;
  gap: 10px;
}

.request-card {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: #1b1b1c;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.request-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;

  strong {
    display: block;
    color: #fff;
    font-size: 0.9rem;
  }

  p {
    margin: 2px 0 0;
    color: #7f7f84;
    font-size: 0.74rem;
  }
}

.request-avatar {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #353535;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
}

.add-btn {
  border-radius: 999px;
  background: #fff !important;
  color: #000 !important;
}

.empty-card {
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  padding: 20px;
  text-align: center;

  h4 {
    margin: 0;
    color: #fff;
    font-size: 1.1rem;
  }

  p {
    margin: 8px 0 16px;
    color: #7f7f84;
  }
}

.friends-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.friend-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: #1b1b1c;
  padding: 14px;
  display: grid;
  gap: 12px;
}

.friend-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.friend-avatar {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #353535;
  color: #fff;
  font-size: 0.84rem;
  font-weight: 700;
}

.friend-info {
  min-width: 0;

  strong {
    display: block;
    color: #fff;
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span {
    display: block;
    color: #7f7f84;
    font-size: 0.68rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.reveal-target {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.reveal-target.is-visible {
  opacity: 1;
  transform: none;
}

@keyframes pulseWave {
  0% {
    transform: scale(0.6);
    opacity: 0.6;
  }

  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}

@media (max-width: 1020px) {
  .friends-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .desktop-tabs {
    display: none;
  }
}

@media (max-width: 760px) {
  .social-shell {
    width: calc(100% - 20px);
  }

  .pulse-header {
    grid-template-columns: 1fr;
  }

  .friends-grid {
    grid-template-columns: 1fr;
  }

  .selected-panel {
    flex-direction: column;
    align-items: flex-start;
  }

  .panel-actions {
    width: 100%;
  }

  .profile-btn {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-target,
  .reveal-target.is-visible,
  .pin-wave,
  .ghost-thumb,
  .ghost-switch,
  .nudge-fire,
  .nudge-clap,
  .profile-btn,
  .accept-btn {
    transition: none;
    animation: none;
    transform: none;
  }
}
</style>

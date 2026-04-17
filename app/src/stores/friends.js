import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection, query, where, getDocs, addDoc,
  deleteDoc, doc, serverTimestamp, getDoc, updateDoc
} from 'firebase/firestore'
import { db, isDemoMode } from 'src/boot/firebase'
import { useAuthStore } from './auth'
import { createDemoId, getDemoCollection, getDemoUsers, setDemoCollection } from 'src/utils/demoMode'

function sanitizeProfile(profile) {
  if (!profile) return null
  const rest = { ...profile }
  delete rest.password
  return rest
}

function getDemoFriendships() {
  return getDemoCollection('friendships')
}

function saveDemoFriendships(friendships) {
  setDemoCollection('friendships', friendships)
}

export const useFriendsStore = defineStore('friends', () => {
  const friends = ref([])
  const friendRequests = ref([])
  const loading = ref(false)
  const authStore = useAuthStore()

  async function fetchFriends() {
    if (!authStore.userId) return
    loading.value = true

    try {
      if (isDemoMode) {
        const friendships = getDemoFriendships()
          .filter((entry) => entry.status === 'accepted' && entry.users.includes(authStore.userId))
        const friendIds = friendships
          .map((entry) => entry.users.find((uid) => uid !== authStore.userId))
          .filter(Boolean)
        const users = getDemoUsers()
        friends.value = friendIds
          .map((friendId) => users.find((entry) => entry.uid === friendId))
          .filter(Boolean)
          .map((profile) => sanitizeProfile({ id: profile.uid, ...profile }))
        return
      }

      const q = query(
        collection(db, 'friendships'),
        where('users', 'array-contains', authStore.userId),
        where('status', '==', 'accepted')
      )
      const snap = await getDocs(q)
      const friendIds = snap.docs.map((entry) => {
        const data = entry.data()
        return data.users.find((uid) => uid !== authStore.userId)
      }).filter(Boolean)

      const profiles = await Promise.all(
        friendIds.map((uid) => getDoc(doc(db, 'users', uid)))
      )
      friends.value = profiles
        .filter((profile) => profile.exists())
        .map((profile) => ({ id: profile.id, ...profile.data() }))
    } finally {
      loading.value = false
    }
  }

  async function sendFriendRequest(targetUserId) {
    if (!authStore.userId || !targetUserId || targetUserId === authStore.userId) return

    if (isDemoMode) {
      const friendships = getDemoFriendships()
      const pairExists = friendships.some((entry) => {
        if (!Array.isArray(entry.users) || entry.users.length !== 2) return false
        return entry.users.includes(authStore.userId) && entry.users.includes(targetUserId)
      })

      if (pairExists) return

      saveDemoFriendships([
        ...friendships,
        {
          id: createDemoId('friendship'),
          users: [authStore.userId, targetUserId],
          requestedBy: authStore.userId,
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      ])
      return
    }

    await addDoc(collection(db, 'friendships'), {
      users: [authStore.userId, targetUserId],
      requestedBy: authStore.userId,
      status: 'pending',
      createdAt: serverTimestamp()
    })
  }

  async function fetchFriendRequests() {
    if (!authStore.userId) return

    if (isDemoMode) {
      const users = getDemoUsers()
      friendRequests.value = getDemoFriendships()
        .filter((entry) => entry.status === 'pending')
        .filter((entry) => entry.users.includes(authStore.userId))
        .filter((entry) => entry.requestedBy !== authStore.userId)
        .map((request) => {
          const profile = users.find((user) => user.uid === request.requestedBy)
          return {
            ...request,
            requestedByName: profile?.displayName || request.requestedBy,
            requestedByEmail: profile?.email || ''
          }
        })
      return
    }

    const q = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', authStore.userId),
      where('status', '==', 'pending')
    )
    const snap = await getDocs(q)
    const requests = snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .filter((request) => request.requestedBy !== authStore.userId)

    const enriched = await Promise.all(requests.map(async (request) => {
      const profile = await getDoc(doc(db, 'users', request.requestedBy))
      return {
        ...request,
        requestedByName: profile.exists() ? profile.data().displayName : request.requestedBy,
        requestedByEmail: profile.exists() ? profile.data().email : ''
      }
    }))

    friendRequests.value = enriched
  }

  async function acceptRequest(friendshipId) {
    if (isDemoMode) {
      const friendships = getDemoFriendships()
      saveDemoFriendships(friendships.map((entry) => {
        if (entry.id !== friendshipId) return entry
        return {
          ...entry,
          status: 'accepted'
        }
      }))
      await fetchFriends()
      await fetchFriendRequests()
      return
    }

    await updateDoc(doc(db, 'friendships', friendshipId), { status: 'accepted' })
    await fetchFriends()
    await fetchFriendRequests()
  }

  async function removeFriend(friendshipId) {
    if (isDemoMode) {
      saveDemoFriendships(getDemoFriendships().filter((entry) => entry.id !== friendshipId))
      await fetchFriends()
      return
    }

    await deleteDoc(doc(db, 'friendships', friendshipId))
    await fetchFriends()
  }

  async function findUserByEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) return null

    if (isDemoMode) {
      const profile = getDemoUsers().find((entry) => entry.email === normalizedEmail)
      return profile ? sanitizeProfile({ id: profile.uid, ...profile }) : null
    }

    const userQuery = query(collection(db, 'users'), where('email', '==', normalizedEmail))
    const snapshot = await getDocs(userQuery)
    if (snapshot.empty) return null
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
  }

  return {
    friends,
    friendRequests,
    loading,
    fetchFriends,
    sendFriendRequest,
    fetchFriendRequests,
    acceptRequest,
    removeFriend,
    findUserByEmail
  }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection, query, where, getDocs, addDoc,
  deleteDoc, doc, serverTimestamp, getDoc, updateDoc
} from 'firebase/firestore'
import { db } from 'src/boot/firebase'
import { useAuthStore } from './auth'

export const useFriendsStore = defineStore('friends', () => {
  const friends = ref([])
  const friendRequests = ref([])
  const loading = ref(false)
  const authStore = useAuthStore()

  async function fetchFriends() {
    if (!authStore.userId) return
    loading.value = true
    try {
      const q = query(
        collection(db, 'friendships'),
        where('users', 'array-contains', authStore.userId),
        where('status', '==', 'accepted')
      )
      const snap = await getDocs(q)
      const friendIds = snap.docs.map(d => {
        const data = d.data()
        return data.users.find(uid => uid !== authStore.userId)
      }).filter(Boolean)

      const profiles = await Promise.all(
        friendIds.map(uid => getDoc(doc(db, 'users', uid)))
      )
      friends.value = profiles.filter(p => p.exists()).map(p => ({ id: p.id, ...p.data() }))
    } finally {
      loading.value = false
    }
  }

  async function sendFriendRequest(targetUserId) {
    await addDoc(collection(db, 'friendships'), {
      users: [authStore.userId, targetUserId],
      requestedBy: authStore.userId,
      status: 'pending',
      createdAt: serverTimestamp()
    })
  }

  async function fetchFriendRequests() {
    if (!authStore.userId) return
    const q = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', authStore.userId),
      where('status', '==', 'pending')
    )
    const snap = await getDocs(q)
    friendRequests.value = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(req => req.requestedBy !== authStore.userId)
  }

  async function acceptRequest(friendshipId) {
    await updateDoc(doc(db, 'friendships', friendshipId), { status: 'accepted' })
    await fetchFriends()
    await fetchFriendRequests()
  }

  async function removeFriend(friendshipId) {
    await deleteDoc(doc(db, 'friendships', friendshipId))
    await fetchFriends()
  }

  return { friends, friendRequests, loading, fetchFriends, sendFriendRequest, fetchFriendRequests, acceptRequest, removeFriend }
})

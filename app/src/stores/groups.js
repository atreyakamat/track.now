import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection, query, where, getDocs, addDoc,
  updateDoc, doc, serverTimestamp, arrayUnion, getDoc
} from 'firebase/firestore'
import { db } from 'src/boot/firebase'
import { useAuthStore } from './auth'

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref([])
  const loading = ref(false)
  const authStore = useAuthStore()

  async function fetchGroups() {
    if (!authStore.userId) return
    loading.value = true
    try {
      const q = query(
        collection(db, 'groups'),
        where('members', 'array-contains', authStore.userId)
      )
      const snap = await getDocs(q)
      groups.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    } finally {
      loading.value = false
    }
  }

  async function createGroup(name, description) {
    const group = {
      name,
      description,
      createdBy: authStore.userId,
      members: [authStore.userId],
      habits: [],
      createdAt: serverTimestamp()
    }
    const docRef = await addDoc(collection(db, 'groups'), group)
    groups.value.push({ id: docRef.id, ...group })
    return docRef.id
  }

  async function joinGroup(groupId) {
    await updateDoc(doc(db, 'groups', groupId), {
      members: arrayUnion(authStore.userId)
    })
    await fetchGroups()
  }

  async function getGroupById(groupId) {
    const snap = await getDoc(doc(db, 'groups', groupId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  }

  return { groups, loading, fetchGroups, createGroup, joinGroup, getGroupById }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection, query, where, getDocs, addDoc,
  updateDoc, doc, serverTimestamp, arrayUnion, getDoc
} from 'firebase/firestore'
import { db, isDemoMode } from 'src/boot/firebase'
import { useAuthStore } from './auth'
import { createDemoId, getDemoCollection, setDemoCollection } from 'src/utils/demoMode'

function getDemoGroups() {
  return getDemoCollection('groups')
}

function saveDemoGroups(groups) {
  setDemoCollection('groups', groups)
}

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref([])
  const loading = ref(false)
  const authStore = useAuthStore()

  async function fetchGroups() {
    if (!authStore.userId) return
    loading.value = true

    try {
      if (isDemoMode) {
        groups.value = getDemoGroups().filter((group) => (group.members || []).includes(authStore.userId))
        return
      }

      const q = query(
        collection(db, 'groups'),
        where('members', 'array-contains', authStore.userId)
      )
      const snap = await getDocs(q)
      groups.value = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
    } finally {
      loading.value = false
    }
  }

  async function createGroup(name, description) {
    if (!authStore.userId) return null

    const groupPayload = {
      name,
      description,
      createdBy: authStore.userId,
      members: [authStore.userId],
      habits: []
    }

    if (isDemoMode) {
      const group = {
        ...groupPayload,
        id: createDemoId('group'),
        createdAt: new Date().toISOString()
      }
      saveDemoGroups([...getDemoGroups(), group])
      groups.value = getDemoGroups().filter((entry) => (entry.members || []).includes(authStore.userId))
      return group.id
    }

    const docRef = await addDoc(collection(db, 'groups'), {
      ...groupPayload,
      createdAt: serverTimestamp()
    })
    groups.value.push({ id: docRef.id, ...groupPayload })
    return docRef.id
  }

  async function joinGroup(groupId) {
    if (!authStore.userId || !groupId) return

    if (isDemoMode) {
      const demoGroups = getDemoGroups()
      const group = demoGroups.find((entry) => entry.id === groupId)
      if (!group) {
        throw new Error('Group not found')
      }

      if (!Array.isArray(group.members)) {
        group.members = []
      }

      if (!group.members.includes(authStore.userId)) {
        group.members.push(authStore.userId)
      }

      saveDemoGroups(demoGroups)
      await fetchGroups()
      return
    }

    await updateDoc(doc(db, 'groups', groupId), {
      members: arrayUnion(authStore.userId)
    })
    await fetchGroups()
  }

  async function getGroupById(groupId) {
    if (isDemoMode) {
      const group = getDemoGroups().find((entry) => entry.id === groupId)
      return group || null
    }

    const snap = await getDoc(doc(db, 'groups', groupId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  }

  return { groups, loading, fetchGroups, createGroup, joinGroup, getGroupById }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, query, where, getDocs, addDoc,
  deleteDoc, doc, serverTimestamp, orderBy
} from 'firebase/firestore'
import { db, isDemoMode } from 'src/boot/firebase'
import { useAuthStore } from './auth'
import { getDateKey } from 'src/utils/habitModel'
import { getDemoCollection, setDemoCollection, createDemoId } from 'src/utils/demoMode'

function sortCompletionsDesc(a, b) {
  const timeA = a.completedAt?.seconds || new Date(a.completedAt || 0).getTime() / 1000
  const timeB = b.completedAt?.seconds || new Date(b.completedAt || 0).getTime() / 1000
  return timeB - timeA
}

function matchesSessionId(completion, sessionId) {
  if (!sessionId) return true
  return completion.sessionId === sessionId
}

export const useCompletionsStore = defineStore('completions', () => {
  const authStore = useAuthStore()
  const completions = ref([])
  const loading = ref(false)

  const todayCompletions = computed(() => {
    const today = getDateKey()
    return completions.value.filter((completion) => completion.date === today)
  })

  const completedHabitIds = computed(() => {
    return new Set(todayCompletions.value.map((c) => c.habitId))
  })

  async function fetchCompletions(startDate, endDate) {
    if (!authStore.userId) return

    loading.value = true
    try {
      if (isDemoMode) {
        const stored = getDemoCollection('completions')
        completions.value = stored
          .filter((c) => c.userId === authStore.userId && c.date >= startDate && c.date <= endDate)
          .sort(sortCompletionsDesc)
        return
      }

      const q = query(
        collection(db, 'completions'),
        where('userId', '==', authStore.userId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      )

      const snapshot = await getDocs(q)
      completions.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })).sort(sortCompletionsDesc)
    } finally {
      loading.value = false
    }
  }

  async function fetchToday() {
    const today = getDateKey()
    await fetchCompletions(today, today)
  }

  async function markGrace(habitId, sessionId = null) {
    const today = getDateKey()
    const existing = completions.value.find((completion) => {
      return completion.habitId === habitId &&
        completion.date === today &&
        matchesSessionId(completion, sessionId)
    })

    if (existing) return existing

    const completionPayload = {
      habitId,
      userId: authStore.userId,
      date: today,
      sessionId: sessionId || null,
      completed: 'grace'
    }

    if (isDemoMode) {
      const entry = {
        id: createDemoId('completion'),
        ...completionPayload,
        completedAt: new Date().toISOString()
      }
      const stored = getDemoCollection('completions')
      setDemoCollection('completions', [...stored, entry])
      completions.value = [...completions.value, entry].sort(sortCompletionsDesc)
      return entry
    }

    const docRef = await addDoc(collection(db, 'completions'), {
      ...completionPayload,
      completedAt: serverTimestamp()
    })
    const entry = {
      id: docRef.id,
      ...completionPayload,
      completedAt: new Date().toISOString()
    }
    completions.value = [...completions.value, entry].sort(sortCompletionsDesc)
    return entry
  }

  async function markComplete(habitId, sessionId = null) {
    const today = getDateKey()
    const existing = completions.value.find((completion) => {
      return completion.habitId === habitId &&
        completion.date === today &&
        matchesSessionId(completion, sessionId)
    })

    if (existing) return existing

    const completionPayload = {
      habitId,
      userId: authStore.userId,
      date: today,
      sessionId: sessionId || null,
      completed: true
    }

    if (isDemoMode) {
      const entry = {
        id: createDemoId('completion'),
        ...completionPayload,
        completedAt: new Date().toISOString()
      }
      const stored = getDemoCollection('completions')
      setDemoCollection('completions', [...stored, entry])
      completions.value = [...completions.value, entry].sort(sortCompletionsDesc)
      return entry
    }

    const docRef = await addDoc(collection(db, 'completions'), {
      ...completionPayload,
      completedAt: serverTimestamp()
    })
    const entry = {
      id: docRef.id,
      ...completionPayload,
      completedAt: new Date().toISOString()
    }
    completions.value = [...completions.value, entry].sort(sortCompletionsDesc)
    return entry
  }

  async function unmarkComplete(habitId, sessionId = null) {
    const today = getDateKey()
    const candidates = completions.value
      .filter((completion) => {
        if (completion.habitId !== habitId || completion.date !== today) return false
        return matchesSessionId(completion, sessionId)
      })
      .sort(sortCompletionsDesc)

    const existing = candidates[0]
    if (!existing) return

    if (isDemoMode) {
      const stored = getDemoCollection('completions')
      setDemoCollection('completions', stored.filter((completion) => completion.id !== existing.id))
      completions.value = completions.value.filter((completion) => completion.id !== existing.id)
      return
    }

    await deleteDoc(doc(db, 'completions', existing.id))
    completions.value = completions.value.filter((completion) => completion.id !== existing.id)
  }

  async function fetchLast90Days() {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 90)

    const startKey = getDateKey(start)
    const endKey = getDateKey(end)
    await fetchCompletions(startKey, endKey)
  }

  function getTodayCompletionsForHabit(habitId) {
    const today = getDateKey()
    return completions.value.filter((completion) => completion.habitId === habitId && completion.date === today)
  }

  return {
    completions,
    loading,
    todayCompletions,
    completedHabitIds,
    fetchToday,
    fetchCompletions,
    fetchLast90Days,
    markComplete,
    markGrace,
    unmarkComplete,
    getTodayCompletionsForHabit
  }
})

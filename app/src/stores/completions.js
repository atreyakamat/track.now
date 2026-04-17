import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, query, where, getDocs, addDoc,
  deleteDoc, doc, serverTimestamp, orderBy
} from 'firebase/firestore'
import { db, isDemoMode } from 'src/boot/firebase'
import { useAuthStore } from './auth'
import { getDateKey, shiftDate } from 'src/utils/habitModel'
import { createDemoId, getDemoCollection, setDemoCollection } from 'src/utils/demoMode'

function getCompletionTimestamp(completion) {
  if (typeof completion?.completedAt?.seconds === 'number') {
    return completion.completedAt.seconds * 1000
  }

  const parsed = Date.parse(completion?.completedAt || '')
  return Number.isFinite(parsed) ? parsed : 0
}

function sortCompletionsDesc(a, b) {
  if (a.date !== b.date) {
    return b.date.localeCompare(a.date)
  }

  return getCompletionTimestamp(b) - getCompletionTimestamp(a)
}

function matchesSessionId(completion, sessionId) {
  return (completion.sessionId || null) === (sessionId || null)
}

export const useCompletionsStore = defineStore('completions', () => {
  const completions = ref([])
  const loading = ref(false)
  const authStore = useAuthStore()

  const todayCompletions = computed(() => {
    const today = getDateKey()
    return completions.value.filter((completion) => completion.date === today)
  })

  const completedHabitIds = computed(() => new Set(todayCompletions.value.map((completion) => completion.habitId)))

  function getDemoCompletionsInRange(startDate, endDate) {
    return getDemoCollection('completions')
      .filter((completion) => {
        return completion.userId === authStore.userId &&
          completion.date >= startDate &&
          completion.date <= endDate
      })
      .sort(sortCompletionsDesc)
  }

  async function fetchCompletions(startDate, endDate) {
    if (!authStore.userId) return
    loading.value = true

    try {
      if (isDemoMode) {
        completions.value = getDemoCompletionsInRange(startDate, endDate)
        return
      }

      const q = query(
        collection(db, 'completions'),
        where('userId', '==', authStore.userId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      )
      const snap = await getDocs(q)
      completions.value = snap.docs
        .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
        .sort(sortCompletionsDesc)
    } finally {
      loading.value = false
    }
  }

  async function fetchToday() {
    const today = getDateKey()
    await fetchCompletions(today, today)
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
        if (sessionId == null) return true
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
    const start = shiftDate(end, -90)
    await fetchCompletions(
      getDateKey(start),
      getDateKey(end)
    )
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
    unmarkComplete,
    getTodayCompletionsForHabit
  }
})

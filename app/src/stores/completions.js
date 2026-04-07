import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, query, where, getDocs, addDoc,
  deleteDoc, doc, serverTimestamp, orderBy
} from 'firebase/firestore'
import { db } from 'src/boot/firebase'
import { useAuthStore } from './auth'

export const useCompletionsStore = defineStore('completions', () => {
  const completions = ref([])
  const loading = ref(false)
  const authStore = useAuthStore()

  const todayCompletions = computed(() => {
    const today = new Date().toISOString().split('T')[0]
    return completions.value.filter(c => c.date === today)
  })

  const completedHabitIds = computed(() => new Set(todayCompletions.value.map(c => c.habitId)))

  async function fetchCompletions(startDate, endDate) {
    if (!authStore.userId) return
    loading.value = true
    try {
      const q = query(
        collection(db, 'completions'),
        where('userId', '==', authStore.userId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      )
      const snap = await getDocs(q)
      completions.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    } finally {
      loading.value = false
    }
  }

  async function fetchToday() {
    const today = new Date().toISOString().split('T')[0]
    await fetchCompletions(today, today)
  }

  async function markComplete(habitId) {
    const today = new Date().toISOString().split('T')[0]
    const existing = completions.value.find(c => c.habitId === habitId && c.date === today)
    if (existing) return

    const newCompletion = {
      habitId,
      userId: authStore.userId,
      date: today,
      completed: true,
      completedAt: serverTimestamp()
    }
    const docRef = await addDoc(collection(db, 'completions'), newCompletion)
    completions.value.push({ id: docRef.id, ...newCompletion, completedAt: new Date() })
  }

  async function unmarkComplete(habitId) {
    const today = new Date().toISOString().split('T')[0]
    const existing = completions.value.find(c => c.habitId === habitId && c.date === today)
    if (!existing) return
    await deleteDoc(doc(db, 'completions', existing.id))
    completions.value = completions.value.filter(c => c.id !== existing.id)
  }

  async function fetchLast90Days() {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 90)
    await fetchCompletions(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    )
  }

  return { completions, loading, todayCompletions, completedHabitIds, fetchToday, fetchCompletions, fetchLast90Days, markComplete, unmarkComplete }
})

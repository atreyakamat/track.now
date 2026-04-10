import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from 'src/boot/firebase'
import { useAuthStore } from './auth'
import { isHabitScheduledForDate, normalizeHabit } from 'src/utils/habitModel'

export const useHabitsStore = defineStore('habits', () => {
  const habits = ref([])
  const loading = ref(false)
  let unsubscribe = null

  const authStore = useAuthStore()

  const todayHabits = computed(() => {
    return habits.value
      .filter((habit) => isHabitScheduledForDate(habit))
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  })

  function subscribe() {
    if (!authStore.userId) return
    loading.value = true
    const q = query(collection(db, 'habits'), where('userId', '==', authStore.userId))
    unsubscribe = onSnapshot(q, (snap) => {
      habits.value = snap.docs
        .map((docSnapshot) => normalizeHabit({ id: docSnapshot.id, ...docSnapshot.data() }))
        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
      loading.value = false
    }, () => { loading.value = false })
  }

  function unsubscribeAll() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    habits.value = []
  }

  async function addHabit(data) {
    const habit = normalizeHabit({
      ...data,
      userId: authStore.userId,
      streak: 0,
      lastCompleted: null,
      createdAt: serverTimestamp()
    })
    return await addDoc(collection(db, 'habits'), habit)
  }

  async function updateHabit(id, data) {
    await updateDoc(doc(db, 'habits', id), normalizeHabit(data))
  }

  async function deleteHabit(id) {
    await deleteDoc(doc(db, 'habits', id))
  }

  async function incrementStreak(id) {
    const habit = habits.value.find(h => h.id === id)
    if (!habit) return
    await updateDoc(doc(db, 'habits', id), {
      streak: (habit.streak || 0) + 1,
      lastCompleted: serverTimestamp()
    })
  }

  return { habits, loading, todayHabits, subscribe, unsubscribeAll, addHabit, updateHabit, deleteHabit, incrementStreak }
})

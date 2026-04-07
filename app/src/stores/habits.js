import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from 'src/boot/firebase'
import { useAuthStore } from './auth'

export const useHabitsStore = defineStore('habits', () => {
  const habits = ref([])
  const loading = ref(false)
  let unsubscribe = null

  const authStore = useAuthStore()

  const todayHabits = computed(() => {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const today = days[new Date().getDay()]
    return habits.value.filter(h => h.days && h.days.includes(today))
  })

  function subscribe() {
    if (!authStore.userId) return
    loading.value = true
    const q = query(collection(db, 'habits'), where('userId', '==', authStore.userId))
    unsubscribe = onSnapshot(q, (snap) => {
      habits.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
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
    const habit = {
      ...data,
      userId: authStore.userId,
      streak: 0,
      lastCompleted: null,
      createdAt: serverTimestamp()
    }
    return await addDoc(collection(db, 'habits'), habit)
  }

  async function updateHabit(id, data) {
    await updateDoc(doc(db, 'habits', id), data)
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

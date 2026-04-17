import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db, isDemoMode } from 'src/boot/firebase'
import { useAuthStore } from './auth'
import { isHabitScheduledForDate, normalizeHabit } from 'src/utils/habitModel'
import { createDemoId, getDemoCollection, setDemoCollection } from 'src/utils/demoMode'

function getHabitTimestamp(habit) {
  if (typeof habit?.createdAt?.seconds === 'number') {
    return habit.createdAt.seconds
  }

  const parsed = Date.parse(habit?.createdAt || '')
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0
}

function getDemoHabitsByUser(userId) {
  return getDemoCollection('habits')
    .filter((habit) => habit.userId === userId)
    .map((habit) => normalizeHabit(habit))
    .sort((a, b) => getHabitTimestamp(a) - getHabitTimestamp(b))
}

function saveDemoHabit(habit) {
  const habits = getDemoCollection('habits')
  const index = habits.findIndex((entry) => entry.id === habit.id)

  if (index >= 0) {
    habits[index] = habit
  } else {
    habits.push(habit)
  }

  setDemoCollection('habits', habits)
}

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

    if (isDemoMode) {
      habits.value = getDemoHabitsByUser(authStore.userId)
      loading.value = false
      return
    }

    const q = query(collection(db, 'habits'), where('userId', '==', authStore.userId))
    unsubscribe = onSnapshot(q, (snap) => {
      habits.value = snap.docs
        .map((docSnapshot) => normalizeHabit({ id: docSnapshot.id, ...docSnapshot.data() }))
        .sort((a, b) => getHabitTimestamp(a) - getHabitTimestamp(b))
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
    const habitPayload = normalizeHabit({
      ...data,
      userId: authStore.userId,
      streak: 0,
      lastCompleted: null
    })

    if (isDemoMode) {
      const habit = {
        ...habitPayload,
        id: createDemoId('habit'),
        createdAt: new Date().toISOString()
      }

      saveDemoHabit(habit)
      habits.value = getDemoHabitsByUser(authStore.userId)
      return { id: habit.id }
    }

    return await addDoc(collection(db, 'habits'), {
      ...habitPayload,
      createdAt: serverTimestamp()
    })
  }

  async function updateHabit(id, data) {
    if (isDemoMode) {
      const currentHabits = getDemoCollection('habits')
      const currentHabit = currentHabits.find((habit) => habit.id === id)

      if (!currentHabit) return

      const updatedHabit = normalizeHabit({
        ...currentHabit,
        ...data,
        id
      })

      saveDemoHabit(updatedHabit)
      habits.value = getDemoHabitsByUser(authStore.userId)
      return
    }

    await updateDoc(doc(db, 'habits', id), normalizeHabit(data))
  }

  async function deleteHabit(id) {
    if (isDemoMode) {
      const currentHabits = getDemoCollection('habits')
      const remainingHabits = currentHabits.filter((habit) => habit.id !== id)
      setDemoCollection('habits', remainingHabits)
      habits.value = getDemoHabitsByUser(authStore.userId)
      return
    }

    await deleteDoc(doc(db, 'habits', id))
  }

  async function incrementStreak(id) {
    const habit = habits.value.find((entry) => entry.id === id)
    if (!habit) return

    if (isDemoMode) {
      await updateHabit(id, {
        streak: (habit.streak || 0) + 1,
        lastCompleted: new Date().toISOString()
      })
      return
    }

    await updateDoc(doc(db, 'habits', id), {
      streak: (habit.streak || 0) + 1,
      lastCompleted: serverTimestamp()
    })
  }

  return {
    habits,
    loading,
    todayHabits,
    subscribe,
    unsubscribeAll,
    addHabit,
    updateHabit,
    deleteHabit,
    incrementStreak
  }
})

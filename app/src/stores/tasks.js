import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore'
import { db, isDemoMode } from 'src/boot/firebase'
import { useAuthStore } from 'src/stores/auth'
import { usePreferencesStore } from 'src/stores/preferences'
import { calendarService } from 'src/services/calendarService'
import { createDemoId, getDemoCollection, setDemoCollection } from 'src/utils/demoMode'
import { compareTasks, normalizeTask } from 'src/utils/taskModel'
import { getDateKey } from 'src/utils/habitModel'

function getTaskTimestamp(task) {
  if (typeof task?.createdAt?.seconds === 'number') return task.createdAt.seconds * 1000
  return Date.parse(task?.createdAt || '') || 0
}

function sortTasks(entries = []) {
  return [...entries].sort((a, b) => {
    const dueCompare = compareTasks(a, b)
    if (dueCompare !== 0) return dueCompare
    return getTaskTimestamp(a) - getTaskTimestamp(b)
  })
}

function getDemoTasksByUser(userId) {
  return sortTasks(
    getDemoCollection('tasks')
      .filter((task) => task.userId === userId)
      .map((task) => normalizeTask(task))
  )
}

function saveDemoTask(task) {
  const tasks = getDemoCollection('tasks')
  const index = tasks.findIndex((entry) => entry.id === task.id)
  if (index >= 0) {
    tasks[index] = task
  } else {
    tasks.push(task)
  }
  setDemoCollection('tasks', tasks)
}

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref([])
  const loading = ref(false)
  let unsubscribe = null

  const authStore = useAuthStore()
  const preferencesStore = usePreferencesStore()

  const openTasks = computed(() => tasks.value.filter((task) => !task.completed))
  const completedTasks = computed(() => tasks.value.filter((task) => task.completed))
  const overdueTasks = computed(() => {
    const today = getDateKey()
    return openTasks.value.filter((task) => task.dueDate && task.dueDate < today)
  })
  const todayTasks = computed(() => {
    const today = getDateKey()
    return openTasks.value.filter((task) => task.dueDate === today)
  })
  const upcomingTasks = computed(() => {
    const today = getDateKey()
    return openTasks.value.filter((task) => task.dueDate && task.dueDate > today)
  })
  const inboxTasks = computed(() => openTasks.value.filter((task) => !task.dueDate))

  function subscribe() {
    if (!authStore.userId) return
    loading.value = true

    if (isDemoMode) {
      tasks.value = getDemoTasksByUser(authStore.userId)
      loading.value = false
      return
    }

    const q = query(collection(db, 'tasks'), where('userId', '==', authStore.userId))
    unsubscribe = onSnapshot(q, (snapshot) => {
      tasks.value = sortTasks(
        snapshot.docs.map((docSnapshot) => normalizeTask({ id: docSnapshot.id, ...docSnapshot.data() }))
      )
      loading.value = false
    }, () => {
      loading.value = false
    })
  }

  function unsubscribeAll() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    tasks.value = []
  }

  async function addTask(data) {
    const payload = normalizeTask({
      ...data,
      userId: authStore.userId,
      completed: false
    })

    if (isDemoMode) {
      const task = {
        ...payload,
        id: createDemoId('task'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      saveDemoTask(task)
      tasks.value = getDemoTasksByUser(authStore.userId)

      // Google Calendar Sync in Demo Mode
      if (preferencesStore.preferences.googleCalendarEnabled && (payload.dueDate || payload.dueTime)) {
        calendarService.createEvent({
          name: payload.title,
          date: payload.dueDate,
          time: payload.dueTime,
          emoji: '📝'
        }).catch(err => console.error('Failed to sync to Google Calendar in demo mode', err))
      }

      return task
    }

    const docRef = await addDoc(collection(db, 'tasks'), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    const newTask = { id: docRef.id, ...payload }

    // Google Calendar Sync
    if (preferencesStore.preferences.googleCalendarEnabled && (payload.dueDate || payload.dueTime)) {
      try {
        await calendarService.createEvent({
          name: payload.title,
          date: payload.dueDate,
          time: payload.dueTime,
          emoji: '📝'
        })
      } catch (err) {
        console.error('Failed to sync to Google Calendar', err)
      }
    }

    return newTask
  }

  async function updateTask(id, updates) {
    const currentTask = tasks.value.find((task) => task.id === id)
    if (!currentTask) return

    const payload = normalizeTask({
      ...currentTask,
      ...updates,
      id
    })

    if (isDemoMode) {
      saveDemoTask({
        ...payload,
        createdAt: currentTask.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      tasks.value = getDemoTasksByUser(authStore.userId)
      return
    }

    await updateDoc(doc(db, 'tasks', id), {
      ...payload,
      updatedAt: serverTimestamp()
    })
  }

  async function toggleTask(id) {
    const task = tasks.value.find((entry) => entry.id === id)
    if (!task) return
    await updateTask(id, { completed: !task.completed })
  }

  async function deleteTask(id) {
    if (isDemoMode) {
      const nextTasks = getDemoCollection('tasks').filter((task) => task.id !== id)
      setDemoCollection('tasks', nextTasks)
      tasks.value = getDemoTasksByUser(authStore.userId)
      return
    }

    await deleteDoc(doc(db, 'tasks', id))
  }

  return {
    tasks,
    loading,
    openTasks,
    completedTasks,
    overdueTasks,
    todayTasks,
    upcomingTasks,
    inboxTasks,
    subscribe,
    unsubscribeAll,
    addTask,
    updateTask,
    toggleTask,
    deleteTask
  }
})

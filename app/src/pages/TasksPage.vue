<template>
  <q-page class="page-container tasks-page">
    <div class="q-mb-lg">
      <div class="text-h4 text-weight-bold">Tasks</div>
      <div class="text-body2 text-grey-7 q-mt-sm">
        Manage your one-off tasks and schedule them easily.
      </div>
    </div>

    <q-inner-loading :showing="loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="!loading">
      <div class="row q-mb-md">
        <q-btn unelevated color="primary" icon="add" label="New Task" @click="showAddDialog = true" />
      </div>

      <div v-if="pendingTasks.length === 0 && completedTasks.length === 0" class="empty-state text-center q-py-xl">
        <div class="text-h3 q-mb-md">📝</div>
        <div class="text-h6 text-weight-bold q-mb-sm">No tasks yet</div>
        <div class="text-body2 text-grey-7 q-mb-lg">
          Add tasks manually or use the voice button below to speak your tasks.
        </div>
      </div>

      <div v-if="pendingTasks.length > 0">
        <div class="text-subtitle1 text-weight-bold q-mb-sm">Pending</div>
        <q-list bordered separator class="rounded-borders bg-white q-mb-lg">
          <q-item v-for="task in pendingTasks" :key="task.id" v-ripple>
            <q-item-section side>
              <q-checkbox :model-value="task.completed" @update:model-value="toggleTask(task)" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ task.name }}</q-item-label>
              <q-item-label caption v-if="task.date || task.time">
                <q-icon name="schedule" size="xs" /> {{ task.date }} {{ task.time }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip size="sm" color="primary" text-color="white" v-if="task.category">{{ task.category }}</q-chip>
            </q-item-section>
            <q-item-section side>
              <q-btn flat round dense icon="delete" color="negative" @click="removeTask(task.id)" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <div v-if="completedTasks.length > 0">
        <div class="text-subtitle1 text-weight-bold q-mb-sm">Completed</div>
        <q-list bordered separator class="rounded-borders bg-white opacity-70">
          <q-item v-for="task in completedTasks" :key="task.id" v-ripple>
            <q-item-section side>
              <q-checkbox :model-value="task.completed" @update:model-value="toggleTask(task)" color="positive" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-strike text-grey">{{ task.name }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat round dense icon="delete" color="negative" @click="removeTask(task.id)" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </div>

    <q-dialog v-model="showAddDialog">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Add Task</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input dense v-model="newTask.name" autofocus @keyup.enter="addTask" label="Task Name" />
          <div class="row q-col-gutter-sm q-mt-sm">
            <div class="col-6">
              <q-input v-model="newTask.date" type="date" label="Date" outlined dense />
            </div>
            <div class="col-6">
              <q-input v-model="newTask.time" type="time" label="Time" outlined dense />
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn flat label="Add task" @click="addTask" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTasksStore } from 'src/stores/tasks'

const tasksStore = useTasksStore()
const loading = computed(() => tasksStore.loading)
const pendingTasks = computed(() => tasksStore.pendingTasks)
const completedTasks = computed(() => tasksStore.completedTasks)

const showAddDialog = ref(false)
const newTask = ref({ name: '', date: '', time: '' })

onMounted(() => {
  tasksStore.subscribe()
})

onUnmounted(() => {
  tasksStore.unsubscribeAll()
})

async function toggleTask(task) {
  await tasksStore.toggleTask(task.id, task.completed)
}

async function removeTask(id) {
  await tasksStore.removeTask(id)
}

async function addTask() {
  if (!newTask.value.name) return
  await tasksStore.addTask({ ...newTask.value, category: 'custom' })
  newTask.value = { name: '', date: '', time: '' }
  showAddDialog.value = false
}
</script>

<style scoped>
.tasks-page {
  padding-bottom: 96px;
}
.opacity-70 {
  opacity: 0.7;
}
</style>

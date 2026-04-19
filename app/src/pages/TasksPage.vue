<template>
  <q-page class="page-container tasks-page">
    <div class="row items-end q-col-gutter-md q-mb-lg">
      <div class="col">
        <div class="text-overline text-primary section-kicker">Tasks + Habits</div>
        <div class="text-h4 text-weight-bold">Execution center</div>
        <div class="text-body2 text-grey-7 q-mt-sm">
          Track.now now handles mission habits and a full task system with voice capture.
        </div>
      </div>
      <div class="col-auto">
        <q-btn color="primary" unelevated no-caps icon="mic" label="Voice add" @click="openVoiceDialog" />
      </div>
    </div>

    <div class="summary-grid q-mb-lg">
      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Open tasks</div>
          <div class="text-h5 text-weight-bold q-mt-xs">{{ tasksStore.openTasks.length }}</div>
        </q-card-section>
      </q-card>
      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Due today</div>
          <div class="text-h5 text-weight-bold q-mt-xs">{{ tasksStore.todayTasks.length }}</div>
        </q-card-section>
      </q-card>
      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Overdue</div>
          <div class="text-h5 text-weight-bold q-mt-xs">{{ tasksStore.overdueTasks.length }}</div>
        </q-card-section>
      </q-card>
    </div>

    <q-card flat bordered class="composer-card q-mb-lg">
      <q-card-section>
        <div class="text-subtitle1 text-weight-bold q-mb-md">Quick add task</div>
        <q-form @submit="handleAddTask" class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <q-input
              v-model="draft.title"
              outlined
              label="Task title"
              placeholder="Book restaurant for Thursday evening"
              :rules="[v => !!v?.trim() || 'Task title is required']"
            />
          </div>
          <div class="col-6 col-md-3">
            <q-input v-model="draft.dueDate" outlined type="date" label="Due date" />
          </div>
          <div class="col-6 col-md-3">
            <q-input v-model="draft.dueTime" outlined type="time" label="Due time" />
          </div>
          <div class="col-6 col-md-3">
            <q-select
              v-model="draft.category"
              outlined
              emit-value
              map-options
              :options="categoryOptions"
              label="Category"
            />
          </div>
          <div class="col-6 col-md-3">
            <q-select
              v-model="draft.priority"
              outlined
              emit-value
              map-options
              :options="priorityOptions"
              label="Priority"
            />
          </div>
          <div class="col-12 col-md-6">
            <q-input
              v-model="draft.notes"
              outlined
              label="Notes (optional)"
              placeholder="Any details for this task"
            />
          </div>
          <div class="col-12 col-md-3">
            <q-btn
              color="primary"
              unelevated
              no-caps
              icon="add_task"
              label="Add task"
              type="submit"
              class="full-width"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>

    <q-tabs
      v-model="activeTab"
      no-caps
      active-color="primary"
      indicator-color="primary"
      align="left"
      class="q-mb-md"
    >
      <q-tab name="today" label="Today" />
      <q-tab name="upcoming" label="Upcoming" />
      <q-tab name="inbox" label="Inbox" />
      <q-tab name="all" label="All open" />
      <q-tab name="completed" label="Completed" />
    </q-tabs>

    <q-inner-loading :showing="tasksStore.loading">
      <q-spinner color="primary" size="40px" />
    </q-inner-loading>

    <div v-if="filteredTasks.length === 0" class="empty-card text-center">
      <div class="text-h3 q-mb-sm">✓</div>
      <div class="text-h6 text-weight-bold q-mb-xs">No tasks in this view</div>
      <div class="text-body2 text-grey-7">
        Add a task manually or use Voice add to convert speech to a scheduled task.
      </div>
    </div>

    <div v-else>
      <transition-group name="list-stagger" tag="div" class="column q-gutter-sm">
        <TaskCard
          v-for="task in filteredTasks"
          :key="task.id"
          :task="task"
          @toggle="toggleTask"
          @delete="deleteTask"
          @edit="startEditTask"
        />
      </transition-group>
    </div>

    <q-dialog v-model="voiceDialog">
      <q-card style="min-width: min(640px, 96vw)">
        <q-card-section class="row items-center">
          <div class="text-h6">Voice task capture</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div v-if="!speechSupported" class="text-negative">
            Speech recognition is not supported in this browser. Use Chrome or Edge for voice add.
          </div>

          <div v-else>
            <div class="recording-wrap q-mb-md">
              <div class="wave" :class="{ active: listening }">
                <span v-for="bar in 5" :key="bar" class="wave-bar" />
              </div>
              <div class="text-caption text-grey-7">
                {{ listening ? 'Listening...' : 'Tap start and speak naturally.' }}
              </div>
            </div>

            <div class="row q-gutter-sm q-mb-md">
              <q-btn
                v-if="!listening"
                color="primary"
                unelevated
                no-caps
                icon="mic"
                label="Start listening"
                @click="startListening"
              />
              <q-btn
                v-else
                color="negative"
                unelevated
                no-caps
                icon="stop"
                label="Stop"
                @click="stopListening"
              />
              <q-btn flat no-caps icon="refresh" label="Clear" @click="clearVoiceState" />
            </div>

            <q-input
              v-model="transcript"
              type="textarea"
              outlined
              autogrow
              label="Transcript"
              placeholder="Say something like: Book a restaurant on Thursday evening"
            />

            <q-banner v-if="parseError" class="bg-red-1 text-red-8 q-mt-md" dense rounded>
              {{ parseError }}
            </q-banner>

            <div class="text-subtitle2 text-weight-bold q-mt-lg q-mb-sm">Parsed task preview</div>
            <q-form @submit="saveVoiceTask" class="row q-col-gutter-md">
              <div class="col-12">
                <q-input
                  v-model="voiceDraft.title"
                  outlined
                  label="Task title"
                  :rules="[v => !!v?.trim() || 'Task title is required']"
                />
              </div>
              <div class="col-6">
                <q-input v-model="voiceDraft.dueDate" outlined type="date" label="Due date" />
              </div>
              <div class="col-6">
                <q-input v-model="voiceDraft.dueTime" outlined type="time" label="Due time" />
              </div>
              <div class="col-6">
                <q-select
                  v-model="voiceDraft.category"
                  outlined
                  emit-value
                  map-options
                  :options="categoryOptions"
                  label="Category"
                />
              </div>
              <div class="col-6">
                <q-select
                  v-model="voiceDraft.priority"
                  outlined
                  emit-value
                  map-options
                  :options="priorityOptions"
                  label="Priority"
                />
              </div>
              <div class="col-12">
                <q-input v-model="voiceDraft.notes" outlined label="Notes" />
              </div>
              <div class="col-12">
                <q-btn
                  color="primary"
                  unelevated
                  no-caps
                  icon="add_task"
                  label="Save voice task"
                  type="submit"
                />
              </div>
            </q-form>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="editDialog">
      <q-card style="min-width: min(640px, 96vw)">
        <q-card-section class="row items-center">
          <div class="text-h6">Edit task</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <q-form @submit="saveTaskEdits" class="row q-col-gutter-md">
            <div class="col-12">
              <q-input v-model="editDraft.title" outlined label="Task title" :rules="[v => !!v?.trim() || 'Task title is required']" />
            </div>
            <div class="col-6">
              <q-input v-model="editDraft.dueDate" outlined type="date" label="Due date" />
            </div>
            <div class="col-6">
              <q-input v-model="editDraft.dueTime" outlined type="time" label="Due time" />
            </div>
            <div class="col-6">
              <q-select v-model="editDraft.category" outlined emit-value map-options :options="categoryOptions" label="Category" />
            </div>
            <div class="col-6">
              <q-select v-model="editDraft.priority" outlined emit-value map-options :options="priorityOptions" label="Priority" />
            </div>
            <div class="col-12">
              <q-input v-model="editDraft.notes" outlined label="Notes" />
            </div>
            <div class="col-12">
              <q-btn color="primary" unelevated no-caps type="submit" label="Save changes" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import TaskCard from 'src/components/TaskCard.vue'
import { TASK_CATEGORY_OPTIONS, TASK_DEFAULTS, TASK_PRIORITY_OPTIONS } from 'src/constants/taskMeta'
import { useTasksStore } from 'src/stores/tasks'
import { normalizeTask, parseVoiceTask } from 'src/utils/taskModel'

const $q = useQuasar()
const tasksStore = useTasksStore()

const activeTab = ref('today')
const draft = ref({ ...TASK_DEFAULTS })
const editDialog = ref(false)
const editDraft = ref({ ...TASK_DEFAULTS, id: '' })

const voiceDialog = ref(false)
const speechSupported = typeof window !== 'undefined' && (
  'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
)
const listening = ref(false)
const transcript = ref('')
const parseError = ref('')
const voiceDraft = ref({ ...TASK_DEFAULTS, source: 'voice' })
let recognitionInstance = null

const categoryOptions = TASK_CATEGORY_OPTIONS.map((item) => ({ label: item.label, value: item.value }))
const priorityOptions = TASK_PRIORITY_OPTIONS.map((item) => ({ label: item.label, value: item.value }))

const filteredTasks = computed(() => {
  if (activeTab.value === 'today') return tasksStore.todayTasks
  if (activeTab.value === 'upcoming') return tasksStore.upcomingTasks
  if (activeTab.value === 'inbox') return tasksStore.inboxTasks
  if (activeTab.value === 'completed') return tasksStore.completedTasks
  return tasksStore.openTasks
})

onUnmounted(() => {
  if (recognitionInstance) {
    recognitionInstance.onresult = null
    recognitionInstance.onend = null
    recognitionInstance.onerror = null
    recognitionInstance.stop()
    recognitionInstance = null
  }
})

async function handleAddTask() {
  if (!draft.value.title.trim()) return
  await tasksStore.addTask({
    ...draft.value,
    title: draft.value.title.trim(),
    source: 'manual'
  })
  draft.value = { ...TASK_DEFAULTS }
  $q.notify({ color: 'positive', message: 'Task added' })
}

function openVoiceDialog() {
  voiceDialog.value = true
}

function clearVoiceState() {
  transcript.value = ''
  parseError.value = ''
  voiceDraft.value = { ...TASK_DEFAULTS, source: 'voice' }
}

function startListening() {
  if (!speechSupported) return

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Recognition) return

  parseError.value = ''
  listening.value = true

  recognitionInstance = new Recognition()
  recognitionInstance.lang = 'en-US'
  recognitionInstance.interimResults = true
  recognitionInstance.maxAlternatives = 1
  recognitionInstance.continuous = false

  recognitionInstance.onresult = (event) => {
    let finalText = ''
    for (let i = 0; i < event.results.length; i++) {
      finalText += `${event.results[i][0].transcript} `
    }
    transcript.value = finalText.trim()
  }

  recognitionInstance.onerror = () => {
    listening.value = false
    parseError.value = 'Could not capture voice right now. Try again in a quieter environment.'
  }

  recognitionInstance.onend = () => {
    listening.value = false
    parseTranscript()
  }

  recognitionInstance.start()
}

function stopListening() {
  if (recognitionInstance) {
    recognitionInstance.stop()
  }
}

function parseTranscript() {
  if (!transcript.value.trim()) {
    parseError.value = 'No speech captured yet.'
    return
  }

  const parsed = parseVoiceTask(transcript.value, new Date())
  voiceDraft.value = normalizeTask({
    ...parsed,
    notes: parsed.notes || transcript.value,
    source: 'voice'
  })
}

async function saveVoiceTask() {
  if (!voiceDraft.value.title.trim()) return

  await tasksStore.addTask({
    ...voiceDraft.value,
    title: voiceDraft.value.title.trim(),
    source: 'voice'
  })

  $q.notify({ color: 'positive', message: 'Voice task added' })
  clearVoiceState()
  voiceDialog.value = false
}

async function toggleTask(taskId) {
  await tasksStore.toggleTask(taskId)
}

async function deleteTask(taskId) {
  await tasksStore.deleteTask(taskId)
  $q.notify({ color: 'positive', message: 'Task deleted' })
}

function startEditTask(task) {
  editDraft.value = { ...normalizeTask(task), id: task.id }
  editDialog.value = true
}

async function saveTaskEdits() {
  if (!editDraft.value.id || !editDraft.value.title.trim()) return
  await tasksStore.updateTask(editDraft.value.id, {
    ...editDraft.value,
    title: editDraft.value.title.trim()
  })
  editDialog.value = false
  $q.notify({ color: 'positive', message: 'Task updated' })
}
</script>

<style scoped lang="scss">
.section-kicker {
  letter-spacing: 0.12em;
}

.tasks-page {
  padding-bottom: 96px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.summary-card,
.composer-card,
.empty-card {
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.empty-card {
  padding: 36px 20px;
  background: #fff;
}

.recording-wrap {
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 12px;
}

.wave {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 42px;
  margin-bottom: 8px;
}

.wave-bar {
  width: 8px;
  height: 10px;
  border-radius: 999px;
  background: rgba(36, 92, 104, 0.35);
}

.wave.active .wave-bar {
  animation: bounce 0.9s ease-in-out infinite;
  background: #245c68;
}

.wave.active .wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave.active .wave-bar:nth-child(3) { animation-delay: 0.2s; }
.wave.active .wave-bar:nth-child(4) { animation-delay: 0.3s; }
.wave.active .wave-bar:nth-child(5) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 100% { height: 10px; }
  50% { height: 34px; }
}
</style>

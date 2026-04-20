<template>
  <q-page class="brain-dump-page">
    <div class="grain-overlay" />

    <div class="tasks-shell">
      <AppPageHeader reveal>
        <template #right>
          <div class="brain-avatar">{{ avatarInitial }}</div>
        </template>
      </AppPageHeader>

      <main class="brain-main">
        <section class="quick-capture" data-reveal>
          <form class="composer-row" @submit.prevent="handleQuickAdd">
            <input
              v-model="quickTitle"
              class="composer-input"
              type="text"
              placeholder="Brain dump here..."
              autocomplete="off"
            >
            <button class="composer-send" type="submit" aria-label="Add task">
              <q-icon name="north_east" size="22px" />
            </button>
          </form>

          <div class="voice-capture">
            <div class="voice-ring voice-ring-outer" />
            <div class="voice-ring voice-ring-inner" />
            <button class="voice-button" type="button" @click="openVoiceDialog">
              <q-icon name="mic" size="34px" />
            </button>
            <p>Tap to record thought</p>
          </div>
        </section>

        <q-inner-loading :showing="tasksStore.loading">
          <q-spinner color="white" size="42px" />
        </q-inner-loading>

        <section v-if="!tasksStore.loading && !hasAnyTasks" class="empty-state" data-reveal>
          <div class="empty-mark">+</div>
          <h2>No tasks yet</h2>
          <p>Capture your first thought above and convert it into action instantly.</p>
        </section>

        <div v-else class="priority-stack">
          <section
            v-for="section in prioritySections"
            :key="section.key"
            class="priority-group"
            data-reveal
          >
            <div class="priority-head">
              <h2 class="priority-label" :class="`tone-${section.key}`">{{ section.label }}</h2>
              <span v-if="section.key === 'high'" class="alert-dot" />
            </div>

            <div v-if="section.tasks.length === 0" class="bucket-empty">
              No {{ section.label.toLowerCase() }} priority tasks right now.
            </div>

            <transition-group v-else name="list-stagger" tag="div" class="task-list">
              <article
                v-for="task in section.tasks"
                :key="task.id"
                class="task-row pro-card"
                :class="`priority-${section.key}`"
              >
                <button class="task-toggle" type="button" @click="toggleTask(task.id)">
                  <q-icon :name="task.completed ? 'check_circle' : 'radio_button_unchecked'" size="22px" />
                </button>

                <div class="task-copy">
                  <span class="task-title">{{ task.title }}</span>
                  <span class="task-meta">{{ taskMetaLabel(task) }}</span>
                </div>

                <div class="task-actions">
                  <q-btn flat round dense size="sm" icon="edit" class="task-action-btn" @click="startEditTask(task)" />
                  <q-btn flat round dense size="sm" icon="delete" class="task-action-btn delete" @click="deleteTask(task.id)" />
                </div>
              </article>
            </transition-group>
          </section>

          <section class="priority-group" data-reveal>
            <div class="priority-head">
              <h2 class="priority-label tone-completed">Completed</h2>
            </div>

            <div v-if="completedPreview.length === 0" class="bucket-empty">
              Complete one task to start your completion timeline.
            </div>

            <transition-group v-else name="list-stagger" tag="div" class="task-list">
              <article
                v-for="task in completedPreview"
                :key="`done-${task.id}`"
                class="task-row pro-card priority-completed"
              >
                <button class="task-toggle done" type="button" @click="toggleTask(task.id)">
                  <q-icon name="check_circle" size="22px" />
                </button>

                <div class="task-copy completed">
                  <span class="task-title done">{{ task.title }}</span>
                  <span class="task-meta">Completed - {{ taskMetaLabel(task) }}</span>
                </div>

                <div class="task-actions">
                  <q-btn flat round dense size="sm" icon="edit" class="task-action-btn" @click="startEditTask(task)" />
                  <q-btn flat round dense size="sm" icon="delete" class="task-action-btn delete" @click="deleteTask(task.id)" />
                </div>
              </article>
            </transition-group>
          </section>
        </div>
      </main>
    </div>

    <q-dialog v-model="voiceDialog">
      <q-card class="dialog-card" style="min-width: min(640px, 96vw)">
        <q-card-section class="row items-center">
          <div class="text-h6 text-weight-bold">Voice task capture</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup @click="stopListening" />
        </q-card-section>
        <q-separator dark />
        <q-card-section>
          <div v-if="!speechSupported" class="text-negative q-mb-md">
            Speech recognition is not supported in this browser. Use Chrome or Edge for voice capture.
          </div>

          <div v-else>
            <div class="recording-wrap q-mb-md">
              <div class="wave" :class="{ active: listening }">
                <span v-for="bar in 5" :key="bar" class="wave-bar" />
              </div>
              <div class="text-caption text-grey-5">
                {{ listening ? 'Listening...' : 'Tap start and speak naturally.' }}
              </div>
            </div>

            <div class="row q-gutter-sm q-mb-md">
              <q-btn
                v-if="!listening"
                color="white"
                text-color="black"
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
              placeholder="Say: Book a restaurant on Thursday evening"
            />

            <q-banner v-if="parseError" class="bg-red-9 text-red-1 q-mt-md" dense rounded>
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
                  color="white"
                  text-color="black"
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
      <q-card class="dialog-card" style="min-width: min(640px, 96vw)">
        <q-card-section class="row items-center">
          <div class="text-h6 text-weight-bold">Edit task</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator dark />
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
              <q-btn color="white" text-color="black" unelevated no-caps type="submit" label="Save changes" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import {
  TASK_CATEGORY_META,
  TASK_CATEGORY_OPTIONS,
  TASK_DEFAULTS,
  TASK_PRIORITY_META,
  TASK_PRIORITY_OPTIONS
} from 'src/constants/taskMeta'
import { useAuthStore } from 'src/stores/auth'
import { useTasksStore } from 'src/stores/tasks'
import AppPageHeader from 'src/components/AppPageHeader.vue'
import { formatTaskDue, normalizeTask, parseVoiceTask } from 'src/utils/taskModel'
import { setupRevealOnScroll } from 'src/utils/revealMotion'

const $q = useQuasar()
const authStore = useAuthStore()
const tasksStore = useTasksStore()

const quickTitle = ref('')
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

const categoryOptions = TASK_CATEGORY_OPTIONS.map((item) => ({ label: item.label, value: item.value }))
const priorityOptions = TASK_PRIORITY_OPTIONS.map((item) => ({ label: item.label, value: item.value }))

let recognitionInstance = null
let cleanupReveal = null

const avatarInitial = computed(() => {
  const seed = String(authStore.displayName || authStore.user?.email || 'T').trim()
  return (seed[0] || 'T').toUpperCase()
})

const groupedOpenTasks = computed(() => {
  const buckets = {
    high: [],
    medium: [],
    low: []
  }

  tasksStore.openTasks.forEach((task) => {
    if (task.priority === 'urgent' || task.priority === 'high') {
      buckets.high.push(task)
      return
    }

    if (task.priority === 'medium') {
      buckets.medium.push(task)
      return
    }

    buckets.low.push(task)
  })

  return buckets
})

const prioritySections = computed(() => ([
  { key: 'high', label: 'High', tasks: groupedOpenTasks.value.high },
  { key: 'medium', label: 'Medium', tasks: groupedOpenTasks.value.medium },
  { key: 'low', label: 'Low', tasks: groupedOpenTasks.value.low }
]))

const completedPreview = computed(() => tasksStore.completedTasks.slice(0, 8))
const hasAnyTasks = computed(() => tasksStore.tasks.length > 0)

onMounted(() => {
  cleanupReveal = setupRevealOnScroll('.brain-dump-page', {
    threshold: 0.14,
    rootMargin: '0px 0px -12% 0px'
  })
})

onUnmounted(() => {
  if (cleanupReveal) {
    cleanupReveal()
    cleanupReveal = null
  }

  if (recognitionInstance) {
    recognitionInstance.onresult = null
    recognitionInstance.onend = null
    recognitionInstance.onerror = null
    recognitionInstance.stop()
    recognitionInstance = null
  }
})

function taskMetaLabel(task) {
  const categoryLabel = TASK_CATEGORY_META[task.category]?.label || 'General'
  const priorityLabel = TASK_PRIORITY_META[task.priority]?.label || 'Medium'
  return `${categoryLabel} - ${priorityLabel} - ${formatTaskDue(task)}`
}

async function handleQuickAdd() {
  const title = quickTitle.value.trim()
  if (!title) return

  await tasksStore.addTask({
    ...TASK_DEFAULTS,
    title,
    source: 'manual'
  })

  quickTitle.value = ''
  $q.notify({ color: 'positive', message: 'Task added' })
}

function openVoiceDialog() {
  voiceDialog.value = true
  parseError.value = ''

  if (speechSupported && !listening.value) {
    setTimeout(() => {
      startListening()
    }, 80)
  }
}

function clearVoiceState() {
  transcript.value = ''
  parseError.value = ''
  voiceDraft.value = { ...TASK_DEFAULTS, source: 'voice' }
}

function startListening() {
  if (!speechSupported || listening.value) return

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
.brain-dump-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #fff;
  padding-bottom: 120px;
  overflow: hidden;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
  z-index: 0;
}

.tasks-shell {
  position: relative;
  z-index: 2;
  width: min(920px, calc(100% - 28px));
  margin: 0 auto;
  padding-top: 18px;
}

.brain-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0 12px;
}

.brain-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;

  h1 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.02em;
  }
}

.brain-avatar {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #2a2a2a;
  color: #f4f4f5;
  font-size: 0.8rem;
  font-weight: 700;
}

.brain-main {
  padding-top: 10px;
}

.quick-capture {
  margin-bottom: 38px;
}

.composer-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 24px;
  padding: 10px 10px 10px 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1b1b1c;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
}

.composer-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: #fff;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: -0.01em;

  &::placeholder {
    color: #71717a;
  }
}

.composer-send {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: #fff;
  color: #0b0b0b;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 26px rgba(255, 255, 255, 0.25);
  }

  &:active {
    transform: scale(0.92);
  }
}

.voice-capture {
  margin-top: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;

  p {
    margin-top: 20px;
    font-size: 0.74rem;
    font-weight: 600;
    letter-spacing: 0.17em;
    text-transform: uppercase;
    color: #7b7b7b;
  }
}

.voice-ring {
  position: absolute;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}

.voice-ring-outer {
  width: 126px;
  height: 126px;
  animation: pulse 2.6s ease-in-out infinite;
}

.voice-ring-inner {
  width: 104px;
  height: 104px;
}

.voice-button {
  position: relative;
  width: 82px;
  height: 82px;
  border: none;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #fff;
  color: #111;
  box-shadow: 0 16px 36px rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.9);
  }
}

.priority-stack {
  display: grid;
  gap: 34px;
}

.priority-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.priority-label {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.02em;

  &.tone-high {
    color: #fff;
  }

  &.tone-medium {
    color: #b9b9b9;
  }

  &.tone-low {
    color: #7b7b7b;
  }

  &.tone-completed {
    color: #9f9f9f;
  }
}

.alert-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ff3b30;
}

.bucket-empty {
  border-radius: 18px;
  padding: 14px 16px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: #7c7c7c;
  font-size: 0.9rem;
}

.task-list {
  display: grid;
  gap: 12px;
}

.task-row {
  border-radius: 18px;
  padding: 14px 14px 14px 12px;
  display: grid;
  align-items: center;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: #1b1b1c;

  &.priority-high {
    border-left: 6px solid #fff;
  }

  &.priority-medium {
    border-left: 3px solid #5d5d5d;
    background: rgba(27, 27, 28, 0.82);
  }

  &.priority-low {
    border-left: 1px solid #343434;
    background: rgba(27, 27, 28, 0.55);
  }

  &.priority-completed {
    border-left: 3px solid #3f3f46;
    background: rgba(27, 27, 28, 0.65);
  }
}

.pro-card {
  transition: transform 0.22s ease, box-shadow 0.22s ease, background-color 0.22s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.35);
    background: #202020;
  }
}

.task-toggle {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: #8a8a8a;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: color 0.2s ease, transform 0.2s ease;

  &:hover {
    color: #fff;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.92);
  }

  &.done {
    color: #fff;
  }
}

.task-copy {
  display: grid;
  gap: 3px;

  &.completed {
    opacity: 0.62;
  }
}

.task-title {
  font-size: 0.98rem;
  font-weight: 600;
  line-height: 1.35;
  color: #fff;
  letter-spacing: -0.01em;

  &.done {
    text-decoration: line-through;
    text-decoration-color: rgba(255, 255, 255, 0.45);
  }
}

.task-meta {
  font-size: 0.7rem;
  color: #8f8f8f;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.task-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.task-action-btn {
  color: #8d8d8d;

  &.delete {
    color: #d66a6a;
  }
}

.empty-state {
  border-radius: 24px;
  padding: 30px 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #111111;
  text-align: center;

  h2 {
    margin: 12px 0 8px;
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    color: #9b9b9b;
  }
}

.empty-mark {
  width: 54px;
  height: 54px;
  margin: 0 auto;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.08);
  font-size: 1.8rem;
  font-weight: 600;
}

.dialog-card {
  background: #101010;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.recording-wrap {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  padding: 12px;
  background: #171717;
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
  background: rgba(255, 255, 255, 0.24);
}

.wave.active .wave-bar {
  animation: bounce 0.9s ease-in-out infinite;
  background: #fff;
}

.wave.active .wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave.active .wave-bar:nth-child(3) { animation-delay: 0.2s; }
.wave.active .wave-bar:nth-child(4) { animation-delay: 0.3s; }
.wave.active .wave-bar:nth-child(5) { animation-delay: 0.4s; }

.reveal-target {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.55s ease, transform 0.55s ease;
}

.reveal-target.is-visible {
  opacity: 1;
  transform: none;
}

@keyframes bounce {
  0%, 100% { height: 10px; }
  50% { height: 34px; }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.35;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.5;
  }
}

@media (max-width: 760px) {
  .tasks-shell {
    width: calc(100% - 20px);
  }

  .priority-label {
    font-size: 1.45rem;
  }

  .task-row {
    grid-template-columns: auto 1fr;
  }

  .task-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
    margin-top: -4px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .voice-ring-outer,
  .wave.active .wave-bar {
    animation: none !important;
  }

  .reveal-target,
  .reveal-target.is-visible {
    transition: none;
    opacity: 1;
    transform: none;
  }

  .pro-card,
  .pro-card:hover,
  .task-toggle,
  .task-toggle:hover,
  .composer-send,
  .composer-send:hover,
  .voice-button,
  .voice-button:hover {
    transition: none;
    transform: none;
  }
}
</style>

<template>
  <div class="voice-input-wrapper">
    <q-btn
      round
      :color="isRecording ? 'negative' : 'primary'"
      :icon="isRecording ? 'mic_off' : 'mic'"
      size="lg"
      class="voice-btn shadow-6"
      @click="toggleRecording"
    >
      <div v-if="isRecording" class="pulse-ring"></div>
      <q-tooltip anchor="top middle" self="bottom middle">
        Tap to speak a task
      </q-tooltip>
    </q-btn>

    <q-dialog v-model="showConfirm" position="bottom">
      <q-card class="q-pa-md confirm-card app-dialog-card" style="width: 100%; max-width: 500px; border-radius: 24px 24px 0 0;">
        <q-card-section>
          <div class="text-h6 text-weight-bold q-mb-md">Voice Task Created</div>
          <div class="text-caption text-grey-7 q-mb-xs">I heard:</div>
          <div class="text-body1 q-mb-md text-italic">"{{ parsedData.originalText }}"</div>
          
          <q-input v-model="parsedData.name" label="Task Name" outlined dense class="q-mb-md" />
          
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-6">
              <q-input v-model="parsedData.date" type="date" label="Date" outlined dense />
            </div>
            <div class="col-6">
              <q-input v-model="parsedData.time" type="time" label="Time" outlined dense />
            </div>
          </div>
          
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-6">
              <q-select
                v-model="parsedData.priority"
                :options="['low', 'medium', 'high']"
                label="Priority"
                outlined
                dense
              >
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section side>
                      <q-icon name="flag" :color="getPriorityColor(scope.opt)" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ scope.opt }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>
            <div class="col-6">
              <div class="text-caption text-grey-7 q-mb-xs">Category</div>
              <q-chip color="primary" text-color="white" icon="label" outline>{{ parsedData.category }}</q-chip>
            </div>
          </div>
          
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey-7" v-close-popup />
          <q-btn unelevated label="Save Task" color="primary" @click="saveTask" :loading="saving" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { parseNaturalLanguageTask } from 'src/utils/nlpParser'
import { useTasksStore } from 'src/stores/tasks'

const $q = useQuasar()
const tasksStore = useTasksStore()

const isRecording = ref(false)
const showConfirm = ref(false)
const saving = ref(false)
const parsedData = ref({})

let recognition = null

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  recognition = new SpeechRecognition()
  recognition.continuous = false
  recognition.interimResults = false
  recognition.lang = 'en-US'

  recognition.onstart = () => {
    isRecording.value = true
  }

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript
    processSpeech(transcript)
  }

  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error)
    isRecording.value = false
    if (event.error !== 'no-speech') {
      $q.notify({ message: 'Speech recognition failed: ' + event.error, color: 'negative' })
    }
  }

  recognition.onend = () => {
    isRecording.value = false
  }
}

function toggleRecording() {
  if (!recognition) {
    $q.notify({ message: 'Speech recognition is not supported in this browser.', color: 'warning' })
    return
  }

  if (isRecording.value) {
    recognition.stop()
  } else {
    recognition.start()
  }
}

function speakFeedback(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.1
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }
}

function processSpeech(text) {
  const result = parseNaturalLanguageTask(text)
  parsedData.value = result
  showConfirm.value = true
  
  // Natural voice feedback
  const dateStr = result.date ? ` for ${result.date}` : ''
  speakFeedback(`I heard ${result.name}${dateStr}. Is that correct?`)
}

function getPriorityColor(p) {
  if (p === 'high') return 'negative'
  if (p === 'medium') return 'warning'
  return 'grey-7'
}

async function saveTask() {
  saving.value = true
  try {
    await tasksStore.addTask({
      name: parsedData.value.name,
      date: parsedData.value.date || null,
      time: parsedData.value.time || null,
      category: parsedData.value.category || 'custom',
      priority: parsedData.value.priority || 'medium'
    })
    $q.notify({ message: 'Task saved successfully!', color: 'positive', icon: 'check_circle' })
    showConfirm.value = false
    speakFeedback('Task saved.')
  } catch (err) {
    $q.notify({ message: 'Failed to save task: ' + err.message, color: 'negative' })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.voice-input-wrapper {
  position: relative;
  display: inline-block;
}

.voice-btn {
  z-index: 10;
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: rgba(244, 67, 54, 0.4);
  animation: pulse 1.5s infinite ease-out;
  z-index: -1;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(2);
    opacity: 0;
  }
}
</style>

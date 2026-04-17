<template>
  <q-card flat bordered class="task-card" :class="{ done: task.completed }">
    <q-card-section class="q-py-sm">
      <div class="row items-center q-col-gutter-sm no-wrap">
        <div class="col-auto">
          <q-btn
            round
            dense
            unelevated
            :color="task.completed ? 'positive' : 'grey-5'"
            :icon="task.completed ? 'check' : 'radio_button_unchecked'"
            @click="$emit('toggle', task.id)"
          />
        </div>

        <div class="col">
          <div class="row items-center q-gutter-xs">
            <div class="text-body1 text-weight-bold" :class="{ strike: task.completed }">{{ task.title }}</div>
            <q-chip dense square :style="{ background: categoryMeta.color + '22', color: categoryMeta.color }">
              {{ categoryMeta.label }}
            </q-chip>
            <q-chip dense square :style="{ background: priorityMeta.color + '22', color: priorityMeta.color }">
              {{ priorityMeta.label }}
            </q-chip>
            <q-chip v-if="task.source === 'voice'" dense square color="primary" text-color="white" icon="mic">
              Voice
            </q-chip>
          </div>

          <div class="text-caption text-grey-7 q-mt-xs">
            {{ dueLabel }}
          </div>

          <div v-if="task.notes" class="text-caption text-grey-8 q-mt-xs">
            {{ task.notes }}
          </div>
        </div>

        <div class="col-auto">
          <q-btn flat round dense icon="edit" color="grey-7" @click="$emit('edit', task)" />
          <q-btn flat round dense icon="delete" color="negative" @click="$emit('delete', task.id)" />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { TASK_CATEGORY_META, TASK_PRIORITY_META } from 'src/constants/taskMeta'
import { formatTaskDue } from 'src/utils/taskModel'

const props = defineProps({
  task: { type: Object, required: true }
})

defineEmits(['toggle', 'edit', 'delete'])

const categoryMeta = computed(() => TASK_CATEGORY_META[props.task.category] || TASK_CATEGORY_META.general)
const priorityMeta = computed(() => TASK_PRIORITY_META[props.task.priority] || TASK_PRIORITY_META.medium)
const dueLabel = computed(() => formatTaskDue(props.task))
</script>

<style scoped lang="scss">
.task-card {
  border-radius: 18px;
  border-color: rgba(148, 163, 184, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
  }
}

.done {
  opacity: 0.72;
}

.strike {
  text-decoration: line-through;
}
</style>

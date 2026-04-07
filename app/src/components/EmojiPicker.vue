<template>
  <div>
    <div class="text-subtitle2 q-mb-sm">Choose an emoji</div>
    <div class="emoji-grid">
      <div
        v-for="emoji in emojis"
        :key="emoji"
        class="emoji-item"
        :class="{ selected: modelValue === emoji }"
        @click="$emit('update:modelValue', emoji)"
      >
        {{ emoji }}
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' }
})
defineEmits(['update:modelValue'])

const emojis = [
  '🏃','💪','🧘','📚','✍️','🎯','💧','🥗',
  '😴','🚴','🏊','🧗','🎸','🎨','📖','💻',
  '🌱','☀️','🌙','⭐','🔥','💡','🏆','🎉',
  '🧠','❤️','🫁','🦷','🧴','🛏️','🍎','🥦',
  '🏋️','🤸','🧶','🎭','🎵','📝','��','✈️',
  '🐕','🌸','☕','🍵','💊','🧪','📷','🎮'
]
</script>

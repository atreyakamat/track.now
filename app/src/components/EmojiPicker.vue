<template>
  <div class="emoji-picker-wrap">
    <div class="text-caption text-weight-bold text-uppercase q-mb-sm text-grey-6 letter-spacing-05">Icon Protocol</div>
    <div class="emoji-grid glass-card q-pa-sm">
      <div
        v-for="emoji in emojis"
        :key="emoji"
        class="emoji-item emoji-font"
        :class="{ selected: modelValue === emoji }"
        @click="$emit('update:modelValue', emoji)"
      >
        {{ emoji }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.letter-spacing-05 {
  letter-spacing: 0.05em;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.emoji-item {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  font-size: 1.4rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    transform: scale(1.1);
  }

  &.selected {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
  }
}
</style>

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
  '🏋️','🤸','🧶','🎭','🎵','📝','🪴','✈️',
  '🐕','🌸','☕','🍵','💊','🧪','📷','🎮'
]
</script>

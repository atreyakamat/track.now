<template>
  <header class="app-page-header" :data-reveal="reveal ? '' : null">
    <div class="app-page-header__brand">
      <q-icon name="radio_button_checked" size="18px" />
      <span>Track.now</span>
    </div>

    <div class="app-page-header__content" v-if="title || subtitle || kicker || $slots.default">
      <p v-if="kicker" class="app-page-header__kicker">{{ kicker }}</p>
      <h1 v-if="title" class="app-page-header__title">{{ title }}</h1>
      <p v-if="subtitle" class="app-page-header__subtitle">{{ subtitle }}</p>
      <slot />
    </div>

    <div v-else class="app-page-header__content app-page-header__content--empty" aria-hidden="true" />

    <div v-if="$slots.right" class="app-page-header__right">
      <slot name="right" />
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  kicker: {
    type: String,
    default: ''
  },
  reveal: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped lang="scss">
.app-page-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--tn-space-3, 12px);
  margin-bottom: var(--tn-space-4, 16px);
}

.app-page-header__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: -0.03em;
  white-space: nowrap;
}

.app-page-header__content {
  min-width: 0;
}

.app-page-header__content--empty {
  min-height: 1px;
}

.app-page-header__kicker {
  margin: 0;
  color: #8f8f95;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.app-page-header__title {
  margin: 0;
  color: #fff;
  font-size: clamp(1.25rem, 2.8vw, 1.8rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.02;
}

.app-page-header__subtitle {
  margin: 4px 0 0;
  color: #a0a0a6;
  font-size: 0.84rem;
  line-height: 1.42;
}

.app-page-header__right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 860px) {
  .app-page-header {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .app-page-header__content--empty {
    display: none;
  }

  .app-page-header__right {
    justify-content: flex-start;
  }
}
</style>

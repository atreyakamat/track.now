<template>
  <q-layout view="lHh lpr lFf" class="auth-layout-shell">
    <q-page-container>
      <q-page class="auth-page">
        <div class="auth-bg" />

        <div class="auth-shell">
          <section class="auth-vision">
            <div class="brand-row">
              <span class="brand-dot" />
              <span class="brand-label">Track.now</span>
            </div>

            <h1>
              Consistency
              <br>
              is the only
              <br>
              secret.
            </h1>

            <p>
              Mission-based tracking for people who want calm execution, visible progress, and real identity change.
            </p>

            <div class="feature-list">
              <article v-for="feature in features" :key="feature.title" class="feature-item">
                <q-icon :name="feature.icon" size="18px" />
                <div>
                  <strong>{{ feature.title }}</strong>
                  <span>{{ feature.desc }}</span>
                </div>
              </article>
            </div>
          </section>

          <section class="auth-panel">
            <router-view />
          </section>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
const features = [
  { icon: 'flag', title: 'Mission-Based', desc: 'Sprints of 21, 45, or 90 days.' },
  { icon: 'bolt', title: 'Action-First', desc: 'One clear next action per moment.' },
  { icon: 'public', title: 'Shared Focus', desc: 'Optional accountability with quiet social pulse.' }
]
</script>

<style scoped lang="scss">
.auth-page {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  background: #000;
  color: #fff;
  display: grid;
  place-items: center;
  padding: 26px 16px;
}

.auth-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% 8%, rgba(255, 255, 255, 0.09), transparent 34%),
    radial-gradient(circle at 92% 86%, rgba(255, 255, 255, 0.07), transparent 34%),
    linear-gradient(180deg, #0a0a0a 0%, #000 100%);
}

.auth-shell {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(20px, 4vw, 56px);
  width: 100%;
  max-width: 1080px;
  align-items: center;
  padding: 18px;
}

.brand-row {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}

.brand-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #fff;
}

.brand-label {
  font-size: 1.06rem;
  font-weight: 900;
  letter-spacing: -0.05em;
  text-transform: uppercase;
}

.auth-vision {
  padding: clamp(8px, 3vw, 20px);
}

.auth-vision h1 {
  margin: 0;
  font-size: clamp(2.2rem, 6vw, 4.5rem);
  line-height: 0.92;
  letter-spacing: -0.03em;
  font-weight: 900;
}

.auth-vision p {
  margin: 18px 0 0;
  max-width: 520px;
  color: #b0b0b4;
  font-size: 1rem;
  line-height: 1.5;
}

.feature-list {
  margin-top: 28px;
  display: grid;
  gap: 12px;
}

.feature-item {
  display: grid;
  grid-template-columns: 26px 1fr;
  align-items: start;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(18, 18, 18, 0.88);
  padding: 10px 12px;

  strong {
    display: block;
    font-size: 0.88rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 2px;
  }

  span {
    display: block;
    color: #999;
    font-size: 0.78rem;
  }
}

.auth-panel {
  width: 100%;
  max-width: 470px;
  justify-self: end;
}

@media (max-width: 1024px) {
  .auth-shell {
    grid-template-columns: 1fr;
    max-width: 500px;
  }

  .auth-vision {
    display: none;
  }

  .auth-panel {
    justify-self: stretch;
    max-width: none;
  }
}
</style>

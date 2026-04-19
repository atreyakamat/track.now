<template>
  <q-page class="mission-family-page">
    <div class="grain-overlay" />

    <div class="family-shell">
      <header class="family-top">
        <div class="brand-wrap">
          <q-icon name="radio_button_checked" size="18px" />
          <span>Track.now</span>
        </div>

        <div class="title-block">
          <h1>Family</h1>
          <p>Supportive routines for the whole home.</p>
        </div>

        <q-btn no-caps unelevated class="family-space-btn" icon="open_in_new" label="View family space" to="/family/home" />
      </header>

      <main class="family-main">
        <section class="summary-grid">
          <article class="summary-card pro-card">
            <span>Family Plan Price</span>
            <strong>$9.99/mo</strong>
          </article>
          <article class="summary-card pro-card">
            <span>Included Members</span>
            <strong>Up to 6</strong>
          </article>
        </section>

        <section class="family-board">
          <article class="family-card pro-card">
            <div class="section-head compact">
              <h2>Why It Works</h2>
            </div>

            <div class="benefit-stack">
              <div v-for="benefit in benefits" :key="benefit.title" class="benefit-card">
                <strong>{{ benefit.title }}</strong>
                <p>{{ benefit.description }}</p>
              </div>
            </div>
          </article>

          <article class="family-card pro-card">
            <div class="section-head compact">
              <h2>Included Features</h2>
            </div>

            <ul class="feature-list">
              <li v-for="feature in features" :key="feature">
                <q-icon name="o_check" color="grey-5" size="16px" />
                <span>{{ feature }}</span>
              </li>
            </ul>

            <q-btn no-caps unelevated class="choose-btn" label="Choose Family plan" to="/pricing" />
          </article>
        </section>
      </main>
    </div>
  </q-page>
</template>

<script setup>
const benefits = [
  {
    title: 'Calm visibility',
    description: 'See whether the household stayed on track without turning family habits into a noisy scoreboard.'
  },
  {
    title: 'Shared rituals',
    description: 'Use the same mission model for morning routines, reading time, or device-free evenings.'
  },
  {
    title: 'Gentle accountability',
    description: 'Parents and guardians can encourage consistency without using punitive streak language.'
  }
]

const features = [
  'Everything in Pro',
  'Up to 6 members',
  'Shared family rituals',
  'Optional WhatsApp summaries',
  'Priority support'
]
</script>

<style scoped lang="scss">
.mission-family-page {
  position: relative;
  min-height: 100%;
  background: #000;
  color: #e5e2e1;
  padding-bottom: 118px;
}

.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
}

.family-shell {
  position: relative;
  z-index: 1;
  max-width: 1040px;
  margin: 0 auto;
  padding: clamp(16px, 2vw, 28px);
}

.family-top {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.title-block h1 {
  margin: 0;
  color: #fff;
  font-size: clamp(1.3rem, 3vw, 1.85rem);
  font-weight: 900;
  letter-spacing: -0.03em;
}

.title-block p {
  margin: 4px 0 0;
  color: #a0a0a6;
  font-size: 0.84rem;
}

.family-space-btn {
  border-radius: 12px;
  background: #fff;
  color: #000;
  font-weight: 700;
}

.family-main {
  display: grid;
  gap: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
}

.summary-card {
  border-radius: 16px;
  padding: 12px;
  display: grid;
  gap: 6px;
}

.summary-card span {
  color: #8f8f95;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.summary-card strong {
  color: #fff;
  font-size: 1.2rem;
  font-weight: 900;
}

.family-board {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 12px;
}

.family-card {
  border-radius: 18px;
  padding: 14px;
}

.section-head.compact {
  margin-bottom: 10px;
}

.section-head h2 {
  margin: 0;
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.benefit-stack {
  display: grid;
  gap: 8px;
}

.benefit-card {
  border-radius: 13px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(19, 19, 19, 0.92);
  padding: 11px;
}

.benefit-card strong {
  color: #fff;
  font-size: 0.87rem;
  font-weight: 700;
}

.benefit-card p {
  margin: 6px 0 0;
  color: #9f9fa5;
  font-size: 0.78rem;
  line-height: 1.4;
}

.feature-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 7px;
}

.feature-list li {
  display: grid;
  grid-template-columns: 16px 1fr;
  align-items: center;
  gap: 8px;
}

.feature-list span {
  color: #e3e3e7;
  font-size: 0.83rem;
}

.choose-btn {
  margin-top: 14px;
  border-radius: 11px;
  background: #fff;
  color: #000;
  font-weight: 700;
}

@media (max-width: 920px) {
  .family-top {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .family-board {
    grid-template-columns: 1fr;
  }
}
</style>

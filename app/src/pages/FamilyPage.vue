<template>
  <q-page class="page-container family-page">
    <div class="row items-end q-col-gutter-md q-mb-lg">
      <div class="col">
        <div class="text-overline text-primary section-kicker">Family</div>
        <div class="text-h4 text-weight-bold">Supportive routines for the whole home</div>
        <div class="text-body2 text-grey-7 q-mt-sm">
          Family mode packages the same calm habit model for multiple people under one shared plan.
        </div>
      </div>
      <div class="col-auto">
        <q-btn label="View family space" color="primary" unelevated no-caps icon="open_in_new" to="/family/home" />
      </div>
    </div>

    <div class="summary-grid q-mb-lg">
      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Family plan price</div>
          <div class="text-h5 text-weight-bold q-mt-xs">$9.99/mo</div>
        </q-card-section>
      </q-card>
      <q-card flat bordered class="summary-card">
        <q-card-section>
          <div class="text-caption text-grey-7">Included members</div>
          <div class="text-h5 text-weight-bold q-mt-xs">Up to 6</div>
        </q-card-section>
      </q-card>
    </div>

    <div class="row q-col-gutter-lg">
      <div class="col-12 col-lg-7">
        <q-card flat bordered class="family-card q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Why it works</div>
            <div class="column q-gutter-md">
              <div v-for="benefit in benefits" :key="benefit.title" class="benefit-card">
                <div class="text-body1 text-weight-bold">{{ benefit.title }}</div>
                <div class="text-body2 text-grey-7 q-mt-xs">{{ benefit.description }}</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-lg-5">
        <q-card flat bordered class="family-card">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Included features</div>
            <q-list dense>
              <q-item v-for="feature in features" :key="feature">
                <q-item-section avatar>
                  <q-icon name="check_circle" color="positive" />
                </q-item-section>
                <q-item-section>{{ feature }}</q-item-section>
              </q-item>
            </q-list>
            <q-btn class="q-mt-md" color="primary" unelevated no-caps label="Choose Family plan" to="/pricing" />
          </q-card-section>
        </q-card>
      </div>
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
.section-kicker {
  letter-spacing: 0.12em;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.summary-card,
.family-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.benefit-card {
  padding: 14px;
  border-radius: 18px;
  background: #fbfcfd;
  border: 1px solid rgba(148, 163, 184, 0.12);
}
</style>

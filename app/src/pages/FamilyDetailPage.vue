<template>
  <q-page class="page-container family-detail-page">
    <div class="family-hero q-mb-lg">
      <div class="text-overline text-primary">Family space</div>
      <div class="text-h4 text-weight-bold q-mt-sm">Shared household habits, without the chaos</div>
      <div class="text-body2 text-grey-7 q-mt-sm">
        Family mode is designed for supportive routines like reading time, tidy resets, or morning prep.
      </div>
    </div>

    <div class="row q-col-gutter-lg">
      <div class="col-12 col-lg-7">
        <q-card flat bordered class="family-card q-mb-lg">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Household rituals</div>
            <div class="column q-gutter-md">
              <div v-for="ritual in rituals" :key="ritual.title" class="ritual-card">
                <div class="text-body1 text-weight-bold">{{ ritual.title }}</div>
                <div class="text-body2 text-grey-7 q-mt-xs">{{ ritual.description }}</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-lg-5">
        <q-card flat bordered class="family-card">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold q-mb-md">Why families upgrade</div>
            <q-list dense>
              <q-item v-for="feature in features" :key="feature">
                <q-item-section avatar>
                  <q-icon name="check_circle" color="positive" />
                </q-item-section>
                <q-item-section>{{ feature }}</q-item-section>
              </q-item>
            </q-list>
            <q-btn class="q-mt-md" color="primary" unelevated no-caps label="See family pricing" to="/pricing" />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
const rituals = [
  { title: 'Morning ready routine', description: 'A simple shared checklist for the first hour of the day.' },
  { title: 'After-school reset', description: 'Homework, hydration, and a short tidy-up session.' },
  { title: 'Evening wind-down', description: 'Reading, reflection, and low-stimulation nighttime habits.' }
]

const features = [
  'Multiple members under one plan',
  'Shared accountability without public noise',
  'Simple rituals for children and adults',
  'Optional WhatsApp summaries for guardians'
]
</script>

<style scoped lang="scss">
.family-hero,
.family-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: #ffffff;
}

.family-hero {
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(36, 92, 104, 0.12), transparent 48%),
    #ffffff;
}

.ritual-card {
  padding: 14px;
  border-radius: 18px;
  background: #fbfcfd;
  border: 1px solid rgba(148, 163, 184, 0.12);
}
</style>

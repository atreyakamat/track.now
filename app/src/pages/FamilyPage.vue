<template>
  <q-page class="page-container">
    <div class="text-center q-py-xl">
      <div class="text-h2 q-mb-md">👨‍👩‍👧‍👦</div>
      <div class="text-h5 text-weight-bold q-mb-sm">Family Plan</div>
      <div class="text-grey q-mb-xl">Track habits together as a family. Up to 6 members, shared accountability.</div>

      <q-card flat bordered class="q-mb-xl">
        <q-card-section>
          <div class="text-h6 text-weight-bold q-mb-md">What's included</div>
          <q-list>
            <q-item v-for="feature in features" :key="feature">
              <q-item-section avatar>
                <q-icon name="check_circle" color="positive" />
              </q-item-section>
              <q-item-section>{{ feature }}</q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <div class="text-h4 text-weight-bold text-primary q-mb-xs">$9.99<span class="text-h6 text-grey">/mo</span></div>
      <div class="text-caption text-grey q-mb-lg">Up to 6 family members</div>

      <q-btn label="Upgrade to Family Plan" color="primary" unelevated size="lg" class="full-width q-mb-md" @click="upgradeToPremium" />
      <router-link to="/pricing" class="text-caption text-grey">See all plans</router-link>
    </div>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar'

const $q = useQuasar()

const features = [
  'Up to 6 family members',
  'Shared habit dashboard',
  'Family streaks and challenges',
  'Parental controls',
  'WhatsApp accountability check-ins',
  'Priority support'
]

function upgradeToPremium() {
  $q.notify({ message: 'Redirecting to upgrade...', color: 'primary' })
}
</script>

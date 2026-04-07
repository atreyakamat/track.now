<template>
  <q-layout view="lHh lpr lFf">
    <q-page-container>
      <q-page class="page-container q-py-xl">
        <div class="text-center q-mb-xl">
          <div class="text-h4 text-weight-bold q-mb-sm">Simple, honest pricing</div>
          <div class="text-grey">Start free, upgrade when you're ready</div>
        </div>

        <div class="row q-gutter-lg justify-center">
          <q-card v-for="plan in plans" :key="plan.name" flat bordered class="pricing-card" :class="{ 'featured-plan': plan.featured }">
            <q-card-section>
              <q-badge v-if="plan.badge" :color="plan.badgeColor" :label="plan.badge" class="q-mb-md" />
              <div class="text-h5 text-weight-bold q-mb-xs">{{ plan.name }}</div>
              <div class="text-h3 text-weight-bold text-primary">
                {{ plan.price }}<span class="text-h6 text-grey">{{ plan.period }}</span>
              </div>
              <div class="text-caption text-grey q-mb-lg">{{ plan.description }}</div>
              <q-list dense class="q-mb-lg">
                <q-item v-for="f in plan.features" :key="f">
                  <q-item-section avatar><q-icon name="check" color="positive" size="16px" /></q-item-section>
                  <q-item-section><span class="text-body2">{{ f }}</span></q-item-section>
                </q-item>
              </q-list>
              <q-btn
                :label="plan.cta"
                :color="plan.featured ? 'primary' : 'grey-3'"
                :text-color="plan.featured ? 'white' : 'dark'"
                unelevated
                class="full-width"
                @click="selectPlan(plan)"
              />
            </q-card-section>
          </q-card>
        </div>

        <div class="text-center q-mt-xl">
          <router-link to="/login" class="text-primary">← Back to app</router-link>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Perfect to get started',
    features: ['Up to 5 habits', 'Basic streak tracking', 'Calendar view', 'Mobile app'],
    cta: 'Get Started',
    featured: false
  },
  {
    name: 'Pro',
    price: '$4.99',
    period: '/mo',
    description: 'For serious habit builders',
    features: ['Unlimited habits', 'Advanced analytics', 'Friends & accountability', 'WhatsApp reminders', 'Custom categories', 'Export data'],
    cta: 'Go Pro',
    featured: true,
    badge: 'Most Popular',
    badgeColor: 'primary'
  },
  {
    name: 'Family',
    price: '$9.99',
    period: '/mo',
    description: 'For families building together',
    features: ['Everything in Pro', 'Up to 6 members', 'Family dashboard', 'Shared challenges', 'Parental controls', 'Priority support'],
    cta: 'Start Family Plan',
    featured: false,
    badge: 'Best Value',
    badgeColor: 'positive'
  }
]

function selectPlan() {
  router.push('/signup')
}
</script>

<style scoped>
.pricing-card {
  width: 280px;
  max-width: 100%;
}
.featured-plan {
  border: 2px solid #6366f1 !important;
}
</style>

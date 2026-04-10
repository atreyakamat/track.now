<template>
  <q-layout view="lHh lpr lFf">
    <q-page-container>
      <q-page class="page-container pricing-page q-py-xl">
        <div class="pricing-hero q-mb-xl">
          <div class="text-overline text-primary">Pricing</div>
          <div class="text-h3 text-weight-bold q-mt-sm">Simple plans for focused growth</div>
          <div class="text-body2 text-grey-7 q-mt-sm">
            Start free, move to Pro when analytics and reminders matter more, and use Family when the product becomes a shared household system.
          </div>
        </div>

        <div class="plan-grid q-mb-xl">
          <q-card v-for="plan in plans" :key="plan.name" flat bordered class="plan-card" :class="{ featured: plan.featured }">
            <q-card-section>
              <q-badge v-if="plan.badge" :label="plan.badge" color="primary" class="q-mb-md" />
              <div class="text-h5 text-weight-bold">{{ plan.name }}</div>
              <div class="text-h3 text-weight-bold text-primary q-mt-sm">
                {{ plan.price }}<span class="text-h6 text-grey-7">{{ plan.period }}</span>
              </div>
              <div class="text-body2 text-grey-7 q-mt-sm q-mb-lg">{{ plan.description }}</div>
              <q-list dense class="q-mb-lg">
                <q-item v-for="feature in plan.features" :key="feature">
                  <q-item-section avatar>
                    <q-icon name="check_circle" color="positive" />
                  </q-item-section>
                  <q-item-section>{{ feature }}</q-item-section>
                </q-item>
              </q-list>
              <q-btn
                :label="ctaLabel(plan)"
                :color="plan.featured ? 'primary' : 'grey-3'"
                :text-color="plan.featured ? 'white' : 'dark'"
                unelevated
                no-caps
                class="full-width"
                @click="selectPlan(plan.name)"
              />
            </q-card-section>
          </q-card>
        </div>

        <q-card flat bordered class="pricing-note">
          <q-card-section class="row items-center q-col-gutter-md">
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">Current plan: {{ authStore.currentPlan }}</div>
              <div class="text-body2 text-grey-7 q-mt-sm">
                Plan selection updates the account profile immediately. Payment processing can be connected to Stripe when keys are configured.
              </div>
            </div>
            <div class="col-auto">
              <q-btn flat no-caps label="Back to app" icon="arrow_back" @click="goBack" />
            </div>
          </q-card-section>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()

const plans = [
  {
    name: 'free',
    label: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Great for building the habit loop and keeping the product simple.',
    features: ['Up to 5 habits', 'Today view', 'Basic calendar history', 'Core mission tracking'],
    featured: false
  },
  {
    name: 'pro',
    label: 'Pro',
    price: '$4.99',
    period: '/mo',
    description: 'For users who want analytics, reminders, and deeper accountability.',
    features: ['Unlimited habits', 'Advanced analytics', 'WhatsApp summaries', 'Friends and groups'],
    featured: true,
    badge: 'Most popular'
  },
  {
    name: 'family',
    label: 'Family',
    price: '$9.99',
    period: '/mo',
    description: 'Shared routines and gentle household accountability for multiple members.',
    features: ['Everything in Pro', 'Up to 6 members', 'Family space', 'Priority support'],
    featured: false,
    badge: 'Best for households'
  }
]

onMounted(() => {
  if (authStore.isAuthenticated) {
    authStore.loadProfile()
  }
})

async function selectPlan(planName) {
  if (!authStore.isAuthenticated) {
    router.push('/signup')
    return
  }

  await authStore.updateAccountPlan(planName)
  $q.notify({ message: `Plan updated to ${planName}`, color: 'positive' })
}

function ctaLabel(plan) {
  return authStore.currentPlan === plan.name ? 'Current plan' : `Choose ${plan.label}`
}

function goBack() {
  if (authStore.isAuthenticated) {
    router.push('/dashboard')
    return
  }

  router.push('/login')
}
</script>

<style scoped lang="scss">
.pricing-hero,
.pricing-note,
.plan-card {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.pricing-hero {
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(36, 92, 104, 0.12), transparent 48%),
    #ffffff;
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.featured {
  border-color: rgba(36, 92, 104, 0.4);
  box-shadow: 0 18px 36px rgba(36, 92, 104, 0.08);
}
</style>

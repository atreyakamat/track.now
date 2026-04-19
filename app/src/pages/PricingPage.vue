<template>
  <q-page class="page-container pricing-page q-py-xl bg-mesh">
    <div class="pricing-hero q-mb-xl text-center">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest q-mb-md">
        Invest in yourself
      </div>
      <h1 class="text-h3 text-weight-bolder tracking-tighter text-slate-900 q-mt-none">Focused growth, <br/>simple pricing.</h1>
      <p class="text-h6 text-slate-500 text-weight-medium max-w-2xl mx-auto q-mt-md">
        Start for free, upgrade when your discipline demands more power.
      </p>
    </div>

    <div class="plan-grid q-mb-xl">
      <q-card v-for="plan in plans" :key="plan.name" flat class="plan-card glass-panel" :class="{ featured: plan.featured }">
        <q-card-section class="q-pa-xl">
          <div v-if="plan.badge" class="row justify-start q-mb-md">
            <span class="plan-badge">{{ plan.badge }}</span>
          </div>
          <div class="text-subtitle1 text-weight-bolder text-slate-400 uppercase tracking-widest">{{ plan.name }}</div>
          <div class="text-h2 text-weight-bolder text-slate-900 q-my-md">
            {{ plan.price }}<span class="text-h6 text-slate-400 font-medium lowercase">{{ plan.period }}</span>
          </div>
          <p class="text-body2 text-slate-500 q-mb-xl min-height-48">{{ plan.description }}</p>
          
          <q-list class="q-mb-xl">
            <q-item v-for="feature in plan.features" :key="feature" dense class="q-px-none q-mb-sm">
              <q-item-section avatar min-width="24px">
                <q-icon name="o_check_circle" color="primary" size="18px" />
              </q-item-section>
              <q-item-section class="text-slate-700 text-weight-medium">{{ feature }}</q-item-section>
            </q-item>
          </q-list>
          
          <q-btn
            :label="ctaLabel(plan)"
            :color="plan.featured ? 'primary' : 'slate-900'"
            :outline="!plan.featured"
            unelevated
            class="full-width glow-btn q-py-md text-weight-bolder"
            size="lg"
            @click="selectPlan(plan.name)"
          />
        </q-card-section>
      </q-card>
    </div>

    <div class="row justify-center">
      <q-card flat class="pricing-note glass-panel q-pa-lg max-w-xl full-width">
        <div class="row items-center justify-between no-wrap">
          <div>
            <div class="text-subtitle2 text-slate-400 uppercase tracking-widest font-bold">Your Status</div>
            <div class="text-h6 text-weight-bolder text-slate-900">Current plan: {{ authStore.currentPlan }}</div>
          </div>
          <q-btn flat color="slate-400" icon="o_arrow_back" label="Return" @click="goBack" class="text-weight-bolder" />
        </div>
      </q-card>
    </div>
  </q-page>
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
    description: 'Perfect for building the habit loop and starting your journey.',
    features: ['Up to 5 habits', 'Today focus view', '7-day momentum', 'Core mission tracking'],
    featured: false
  },
  {
    name: 'pro',
    label: 'Pro',
    price: '$4.99',
    period: '/mo',
    description: 'For power users who need advanced analytics and reminders.',
    features: ['Unlimited habits', 'Advanced analytics', 'WhatsApp summaries', 'Full friends & groups'],
    featured: true,
    badge: 'Highly Recommended'
  },
  {
    name: 'family',
    label: 'Family',
    price: '$9.99',
    period: '/mo',
    description: 'Collaborative tracking for teams or households of up to 6.',
    features: ['Everything in Pro', 'Up to 6 members', 'Shared missions', 'Priority response'],
    featured: false,
    badge: 'Household Choice'
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
  $q.notify({ message: `Plan upgraded to ${planName}`, color: 'primary', icon: 'o_auto_awesome' })
}

function ctaLabel(plan) {
  return authStore.currentPlan === plan.name ? 'Current' : `Upgrade to ${plan.label}`
}

function goBack() {
  if (authStore.isAuthenticated) {
    router.push('/today')
    return
  }

  router.push('/login')
}
</script>

<style scoped lang="scss">
.pricing-page {
  min-height: 100vh;
}

.bg-mesh {
  background-color: #f8fafc;
  background-image: 
    radial-gradient(at 0% 0%, rgba(79, 70, 229, 0.04) 0px, transparent 50%),
    radial-gradient(at 100% 0%, rgba(99, 102, 241, 0.04) 0px, transparent 50%);
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
  max-width: 1100px;
  margin-left: auto;
  margin-right: auto;
}

.plan-card {
  border-radius: 32px;
  border: 1px solid rgba(255,255,255,0.4);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.04);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;

  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.1);
    border-color: rgba($primary, 0.2);
  }

  &.featured {
    border: 2px solid $primary;
    box-shadow: 0 20px 40px -12px rgba($primary, 0.15);
  }
}

.plan-badge {
  padding: 4px 12px;
  background: $primary;
  color: white;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.min-height-48 {
  min-height: 48px;
}

.pricing-note {
  border-radius: 24px;
}

.glow-btn {
  box-shadow: 0 10px 15px -3px rgba($primary, 0.2);
  &:active {
    transform: scale(0.98);
  }
}

.text-slate-400 { color: #94a3b8; }
.text-slate-500 { color: #64748b; }
.text-slate-700 { color: #334155; }
.text-slate-900 { color: #0f172a; }

@media (max-width: 600px) {
  .plan-grid {
    grid-template-columns: 1fr;
  }
}
</style>

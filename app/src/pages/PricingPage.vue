<template>
  <transition name="fade" appear>
    <div class="full-width pricing-shell">
      <q-card flat class="pricing-card">
        <q-card-section class="q-pa-xl">
          <p class="brand-kicker">Track.now</p>
          <h1 class="lead-title">Consistency is the only secret.</h1>
          <p class="lead-copy">
            Mission-based tracking for people who want calm execution, visible progress, and real identity change.
          </p>

          <div class="pillar-grid">
            <article v-for="pillar in pillars" :key="pillar.title" class="pillar-card">
              <q-icon :name="pillar.icon" size="18px" color="grey-3" />
              <div>
                <strong>{{ pillar.title }}</strong>
                <span>{{ pillar.description }}</span>
              </div>
            </article>
          </div>

          <div class="pricing-head">
            <p>Invest in yourself</p>
            <h2>Focused growth, simple pricing.</h2>
            <span>Start for free, upgrade when your discipline demands more power.</span>
          </div>

          <div class="plan-stack">
            <article
              v-for="plan in plans"
              :key="plan.name"
              class="plan-card"
              :class="{ featured: plan.featured, current: currentPlan === plan.name }"
            >
              <div class="plan-top">
                <p class="plan-name">{{ plan.name }}</p>
                <span v-if="plan.badge" class="plan-badge">{{ plan.badge }}</span>
              </div>

              <div class="plan-price-wrap">
                <span class="plan-price">{{ plan.price }}</span>
                <span class="plan-period">{{ plan.period }}</span>
              </div>

              <p class="plan-description">{{ plan.description }}</p>

              <ul class="feature-list">
                <li v-for="feature in plan.features" :key="feature" class="feature-item">
                  <q-icon name="o_check" size="16px" color="grey-4" />
                  <span>{{ feature }}</span>
                </li>
              </ul>

              <q-btn
                :label="ctaLabel(plan)"
                :outline="!plan.featured"
                :color="plan.featured ? 'white' : 'grey-6'"
                :text-color="plan.featured ? 'black' : 'white'"
                unelevated
                class="full-width plan-btn"
                @click="selectPlan(plan.name)"
              />
            </article>
          </div>

          <div class="status-card">
            <div>
              <p>Your Status</p>
              <h3>Current plan: {{ currentPlan }}</h3>
            </div>

            <q-btn
              flat
              icon="o_arrow_back"
              label="Return"
              color="grey-5"
              class="status-return"
              @click="goBack"
            />
          </div>
        </q-card-section>
      </q-card>

      <div class="bottom-link-wrap" v-if="!authStore.isAuthenticated">
        <router-link to="/login" class="bottom-link">Back to sign in</router-link>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()

const pillars = [
  { title: 'Mission-Based', description: 'Sprints of 21, 45, or 90 days.', icon: 'flag' },
  { title: 'Action-First', description: 'One clear next action per moment.', icon: 'bolt' },
  { title: 'Shared Focus', description: 'Optional accountability with quiet social pulse.', icon: 'public' }
]

const plans = [
  {
    name: 'free',
    price: '$0',
    period: '/mo',
    description: 'Perfect for building the habit loop and starting your journey.',
    features: ['Up to 5 habits', 'Today focus view', '7-day momentum', 'Core mission tracking'],
    featured: false
  },
  {
    name: 'pro',
    price: '$4.99',
    period: '/mo',
    description: 'For power users who need advanced analytics and reminders.',
    features: ['Unlimited habits', 'Advanced analytics', 'WhatsApp summaries', 'Full friends & groups'],
    featured: true,
    badge: 'Highly Recommended'
  },
  {
    name: 'family',
    price: '$9.99',
    period: '/mo',
    description: 'Collaborative tracking for teams or households of up to 6.',
    features: ['Everything in Pro', 'Up to 6 members', 'Shared missions', 'Priority response'],
    featured: false,
    badge: 'Household Choice'
  }
]

const currentPlan = computed(() => String(authStore.currentPlan || 'free').toLowerCase())

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

  if (currentPlan.value === planName) {
    $q.notify({ message: 'This is already your active plan.', color: 'info', icon: 'o_done' })
    return
  }

  try {
    await authStore.updateAccountPlan(planName)
    $q.notify({ message: `Plan switched to ${planName}.`, color: 'primary', icon: 'o_verified' })
  } catch (error) {
    $q.notify({ message: error.message || 'Could not update plan.', color: 'negative', icon: 'o_error' })
  }
}

function ctaLabel(plan) {
  if (currentPlan.value === plan.name) {
    return 'Current plan'
  }

  if (!authStore.isAuthenticated && plan.name === 'free') {
    return 'Start free'
  }

  if (!authStore.isAuthenticated) {
    return `Choose ${plan.name}`
  }

  return `Switch to ${plan.name}`
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
.pricing-shell {
  width: 100%;
}

.pricing-card {
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(14, 14, 14, 0.94);
  box-shadow: 0 22px 52px rgba(0, 0, 0, 0.48);
}

.brand-kicker {
  margin: 0;
  color: #8f8f94;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.lead-title {
  margin: 8px 0 0;
  color: #fff;
  font-size: clamp(1.85rem, 5.4vw, 2.4rem);
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.lead-copy {
  margin: 14px 0 0;
  color: #a8a8ad;
  line-height: 1.48;
  font-size: 0.92rem;
}

.pillar-grid {
  margin-top: 20px;
  display: grid;
  gap: 10px;
}

.pillar-card {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(18, 18, 18, 0.9);
  padding: 10px 12px;

  strong {
    display: block;
    color: #fff;
    font-size: 0.84rem;
    font-weight: 700;
  }

  span {
    display: block;
    color: #9f9fa5;
    font-size: 0.78rem;
    margin-top: 2px;
    line-height: 1.32;
  }
}

.pricing-head {
  margin-top: 24px;

  p {
    margin: 0;
    color: #8d8d93;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h2 {
    margin: 8px 0 0;
    color: #fff;
    font-size: clamp(1.35rem, 4vw, 1.95rem);
    line-height: 1.05;
    letter-spacing: -0.03em;
    font-weight: 800;
  }

  span {
    margin-top: 8px;
    display: block;
    color: #9f9fa5;
    font-size: 0.9rem;
    line-height: 1.45;
  }
}

.plan-stack {
  margin-top: 18px;
  display: grid;
  gap: 12px;
}

.plan-card {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: rgba(17, 17, 17, 0.92);
  padding: 14px;
  transition: border-color 0.2s ease, transform 0.2s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.24);
    transform: translateY(-1px);
  }

  &.featured {
    border-color: rgba(255, 255, 255, 0.4);
    background: #1b1b1b;
  }

  &.current {
    border-color: #fff;
  }
}

.plan-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.plan-name {
  margin: 0;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.plan-badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #181818;
  background: #fff;
  border-radius: 999px;
  padding: 4px 9px;
  white-space: nowrap;
}

.plan-price-wrap {
  margin-top: 8px;
  display: flex;
  align-items: flex-end;
  gap: 4px;
}

.plan-price {
  color: #fff;
  font-size: 1.7rem;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.03em;
}

.plan-period {
  color: #a8a8ad;
  font-size: 0.84rem;
  font-weight: 600;
  margin-bottom: 2px;
}

.plan-description {
  margin: 9px 0 0;
  color: #b0b0b5;
  line-height: 1.44;
  font-size: 0.86rem;
}

.feature-list {
  list-style: none;
  margin: 12px 0;
  padding: 0;
  display: grid;
  gap: 7px;
}

.feature-item {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 8px;
  align-items: center;

  span {
    color: #f3f3f3;
    font-size: 0.84rem;
    font-weight: 500;
  }
}

.plan-btn {
  border-radius: 12px;
  font-weight: 700;
}

.status-card {
  margin-top: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(18, 18, 18, 0.92);
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;

  p {
    margin: 0;
    color: #8f8f95;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h3 {
    margin: 6px 0 0;
    color: #fff;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-transform: lowercase;
  }
}

.status-return {
  border-radius: 10px;
}

.bottom-link-wrap {
  text-align: center;
  margin-top: 14px;
}

.bottom-link {
  color: #8f8f95;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 700;
  font-size: 0.68rem;
  text-decoration: none;
}

@media (max-width: 520px) {
  .pricing-card :deep(.q-card__section) {
    padding: 18px;
  }

  .status-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

<template>
  <q-page class="page-container today-page">
    <div class="q-mb-xl">
      <div class="text-overline text-primary q-mb-xs">{{ formattedDate }}</div>
      <div class="text-h4 text-weight-bolder q-mt-none">{{ greeting }}, {{ firstName }}</div>
      <div class="text-body1 text-slate-500 q-mt-sm">
        Stay focused. One small action at a time.
      </div>
    </div>

    <q-inner-loading :showing="loading" class="transparent">
      <q-spinner-ripple color="primary" size="64px" />
    </q-inner-loading>

    <transition name="fade" appear>
      <div v-if="!loading">
        <!-- Hero Progress Card -->
        <q-card flat class="today-hero-card q-mb-xl overflow-hidden">
          <q-card-section class="row items-center q-col-gutter-xl">
            <div class="col-auto">
              <div class="hero-ring-wrapper">
                <q-circular-progress
                  show-value
                  size="120px"
                  :value="Math.round(completionRate * 100)"
                  :thickness="0.12"
                  color="primary"
                  track-color="slate-100"
                  class="hero-ring"
                >
                  <div class="column items-center">
                    <div class="text-h5 text-weight-bolder">{{ Math.round(completionRate * 100) }}%</div>
                    <div class="text-caption text-weight-medium opacity-60">today</div>
                  </div>
                </q-circular-progress>
              </div>
            </div>

            <div class="col">
              <div class="text-overline text-primary font-bold tracking-widest q-mb-xs">RIGHT NOW</div>
              <div class="text-h5 text-weight-bolder leading-tight">{{ headline }}</div>
              <div class="text-body2 text-slate-500 q-mt-sm">
                {{ supportText }}
              </div>

              <div class="row q-gutter-sm q-mt-lg">
                <div class="stat-badge">
                  <q-icon name="check_circle" size="14px" />
                  {{ completedCount }}/{{ todayHabits.length }}
                </div>
                <div class="stat-badge">
                  <q-icon name="local_fire_department" size="14px" color="orange" />
                  {{ momentum.percentage }}%
                </div>
                <div class="stat-badge" v-if="pendingHabits.length > 0">
                  <q-icon name="schedule" size="14px" />
                  {{ nextReminderLabel }}
                </div>
              </div>
            </div>
          </q-card-section>
          
          <!-- Subtle Progress Background -->
          <div class="hero-progress-bg" :style="{ width: `${completionRate * 100}%` }" />
        </q-card>

        <div v-if="todayHabits.length === 0" class="empty-state-glass text-center q-py-xl">
          <div class="text-h2 q-mb-md">🌱</div>
          <div class="text-h6 text-weight-bolder q-mb-sm">Ready for a new mission?</div>
          <div class="text-body1 text-slate-500 q-mb-xl">
            Add a small daily habit to start building momentum.
          </div>
          <q-btn 
            label="Create your first mission" 
            color="primary" 
            unelevated 
            padding="12px 32px"
            icon="add" 
            to="/add" 
            class="glow-btn"
          />
        </div>

        <div v-else>
          <!-- Active Habits -->
          <div v-if="!allDone">
            <div class="row items-center q-mb-md">
              <div class="text-overline text-slate-400 font-bold">UP NEXT</div>
            </div>

            <transition-group name="list" tag="div">
              <HabitCard
                v-for="(habit, index) in pendingHabits"
                :key="habit.id"
                :habit="habit"
                :is-completed="false"
                :class="{ 'pulse-next': index === 0 }"
                @completed="onCompleted"
              />
            </transition-group>
          </div>

          <!-- All Done State -->
          <transition name="fade">
            <div v-if="allDone" class="celebration-card text-center q-py-xl q-mb-xl">
              <div class="text-h2 q-mb-md">🎉</div>
              <div class="text-h5 text-weight-bolder q-mb-sm">Maximum Momentum!</div>
              <div class="text-body1 text-slate-500 q-mb-xl">
                You've cleared your focus for today.
              </div>
              <q-btn label="Review Progress" flat color="primary" icon="bar_chart" to="/analytics" />
            </div>
          </transition>

          <!-- Insights Grid -->
          <div class="insight-grid q-mt-xl">
            <q-card flat class="glass-card">
              <q-card-section>
                <div class="text-overline text-primary q-mb-xs">IDENTITY</div>
                <div class="text-h6 text-weight-bold">
                  {{ identityInsight ? identityInsight.meta.identity : 'The Beginning' }}
                </div>
                <div class="text-body2 text-slate-500 q-mt-sm">
                  {{ identityInsight
                    ? `Your actions this week reinforce being a ${identityInsight.meta.identity}.`
                    : 'Track.now reflects the person you are becoming through your habits.' }}
                </div>
              </q-card-section>
            </q-card>

            <q-card flat class="glass-card">
              <q-card-section>
                <div class="text-overline text-indigo q-mb-xs">GRACE</div>
                <div class="text-h6 text-weight-bold">Volume-Based Growth</div>
                <div class="text-body2 text-slate-500 q-mt-sm">
                  Missing a day doesn't break the mission. The total volume of your actions is what counts.
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Completed Section -->
          <div v-if="completedHabits.length > 0" class="q-mt-xl opacity-60">
            <div class="row items-center q-mb-md">
              <div class="text-overline text-slate-400 font-bold">COMPLETED TODAY</div>
            </div>
            <transition-group name="list" tag="div">
              <HabitCard
                v-for="habit in completedHabits"
                :key="habit.id"
                :habit="habit"
                :is-completed="true"
                @uncompleted="onUncompleted"
              />
            </transition-group>
          </div>
        </div>
      </div>
    </transition>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import confetti from 'canvas-confetti'
import HabitCard from 'src/components/HabitCard.vue'
import { useAuthStore } from 'src/stores/auth'
import { useCompletionsStore } from 'src/stores/completions'
import { useHabitsStore } from 'src/stores/habits'
import {
  buildIdentityInsight,
  calculateMomentum,
  formatTimeLabel,
  getHabitSessionProgressForDate,
  getTodayHeadline,
  isHabitCompleteOnDate
} from 'src/utils/habitModel'

const authStore = useAuthStore()
const habitsStore = useHabitsStore()
const completionsStore = useCompletionsStore()

const loading = ref(true)

const firstName = computed(() => {
  const name = authStore.displayName
  return name ? name.split(' ')[0] : 'there'
})

const formattedDate = computed(() => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).toUpperCase()
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
})

const todayHabits = computed(() => habitsStore.todayHabits)
const isHabitDoneToday = (habit) => isHabitCompleteOnDate(habit, completionsStore.completions)

const pendingHabits = computed(() => {
  return todayHabits.value.filter((habit) => !isHabitDoneToday(habit))
})

const completedHabits = computed(() => {
  return todayHabits.value.filter((habit) => isHabitDoneToday(habit))
})

const completedCount = computed(() => completedHabits.value.length)
const completionRate = computed(() => {
  return todayHabits.value.length > 0 ? completedCount.value / todayHabits.value.length : 0
})
const allDone = computed(() => todayHabits.value.length > 0 && pendingHabits.value.length === 0)

// Watch for "All Done" to fire celebration
watch(allDone, (newVal) => {
  if (newVal === true) {
    fireCelebration()
  }
})

const momentum = computed(() => {
  return calculateMomentum(habitsStore.habits, completionsStore.completions)
})

const identityInsight = computed(() => {
  return buildIdentityInsight(habitsStore.habits, completionsStore.completions)
})

const headline = computed(() => {
  return getTodayHeadline(todayHabits.value.length, pendingHabits.value.length, allDone.value)
})

const nextReminderLabel = computed(() => {
  if (pendingHabits.value.length === 0) return 'Done'

  const nextHabit = pendingHabits.value[0]
  const sessionProgress = getHabitSessionProgressForDate(nextHabit, completionsStore.completions)
  const nextSessionTime = sessionProgress.nextSessionId || nextHabit.time
  return formatTimeLabel(nextSessionTime)
})

const supportText = computed(() => {
  if (todayHabits.value.length === 0) {
    return 'Your dashboard will stay quiet until you schedule your first mission.'
  }
  if (allDone.value) {
    return 'You have reinforced your identity today. The rest of the day is yours.'
  }
  return 'Small, consistent actions lead to radical transformations.'
})

onMounted(async () => {
  await completionsStore.fetchLast90Days()
  loading.value = false
})

function fireCelebration() {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#4f46e5', '#10b981', '#f59e0b']
  })
}

function onCompleted() {
  if (allDone.value) fireCelebration()
}

function onUncompleted() {}
</script>

<style scoped lang="scss">
.today-page {
  padding-bottom: 120px;
}

.today-hero-card {
  position: relative;
  border-radius: 32px;
  background: white;
  border: 1px solid rgba(0,0,0,0.03);
  box-shadow: 0 20px 50px rgba(0,0,0,0.04);
  z-index: 1;
}

.hero-progress-bg {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: linear-gradient(90deg, rgba($primary, 0.03), transparent);
  z-index: -1;
  transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.hero-ring-wrapper {
  padding: 8px;
  background: #f8fafc;
  border-radius: 999px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f1f5f9;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
}

.glass-card {
  background: rgba(255,255,255,0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 24px;
}

.celebration-card {
  border-radius: 32px;
  background: linear-gradient(135deg, rgba($primary, 0.05), rgba($positive, 0.05));
  border: 2px dashed rgba($primary, 0.1);
}

.pulse-next {
  animation: cardPulse 3s infinite ease-in-out;
}

@keyframes cardPulse {
  0% { box-shadow: 0 0 0 0 rgba($primary, 0); }
  50% { box-shadow: 0 0 20px 0 rgba($primary, 0.1); }
  100% { box-shadow: 0 0 0 0 rgba($primary, 0); }
}

.empty-state-glass {
  background: #f8fafc;
  border-radius: 32px;
  border: 2px dashed #e2e8f0;
}

.glow-btn {
  box-shadow: 0 10px 20px -5px rgba($primary, 0.4);
}

.list-enter-active, .list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from, .list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>

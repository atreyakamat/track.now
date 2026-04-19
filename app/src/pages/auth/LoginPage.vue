<template>
  <transition name="fade" appear>
    <div class="full-width">
      <q-card flat class="auth-card glass-panel">
        <q-card-section class="q-pa-xl">
          <div class="text-h6 text-weight-bold q-mb-xs">Sign in</div>
          <p class="text-body2 text-slate-500 q-mb-lg">Continue your mission streak.</p>
          
          <q-banner v-if="demoMode" dense rounded class="q-mb-lg bg-indigo-50 text-indigo-700 border-indigo-100">
            <template #avatar>
              <q-icon name="o_info" color="primary" />
            </template>
            Demo mode is active.
          </q-banner>

          <q-form @submit="handleLogin" class="q-gutter-y-md">
            <q-input
              v-model="email"
              type="email"
              label="Email address"
              outlined
              bg-color="white"
              class="premium-input"
              :rules="[v => !!v || 'Required', v => /.+@.+/.test(v) || 'Invalid email']"
            >
              <template #prepend><q-icon name="o_mail" color="slate-400" /></template>
            </q-input>

            <q-input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              label="Password"
              outlined
              bg-color="white"
              class="premium-input"
              :rules="[v => !!v || 'Required']"
            >
              <template #prepend><q-icon name="o_lock" color="slate-400" /></template>
              <template #append>
                <q-icon 
                  :name="showPassword ? 'o_visibility_off' : 'o_visibility'" 
                  class="cursor-pointer" 
                  color="slate-400"
                  @click="showPassword = !showPassword" 
                />
              </template>
            </q-input>

            <q-btn
              type="submit"
              label="Sign in"
              color="primary"
              unelevated
              class="full-width glow-btn q-py-md"
              size="lg"
              :loading="loading"
            />

            <div class="row items-center q-my-md">
              <q-separator class="col" />
              <span class="q-px-md text-caption text-slate-400 font-bold">OR</span>
              <q-separator class="col" />
            </div>

            <q-btn
              outline
              color="slate-200"
              text-color="slate-900"
              label="Continue with Google"
              icon="img:https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
              class="full-width google-btn q-py-md"
              size="lg"
              :loading="loading"
              @click="handleGoogleLogin"
            />
          </q-form>

          <div class="text-center q-mt-xl">
            <span class="text-slate-500">New here? </span>
            <router-link to="/signup" class="text-primary text-weight-bolder no-decoration">Create account</router-link>
          </div>
        </q-card-section>
      </q-card>
      
      <div class="text-center q-mt-lg">
        <router-link to="/pricing" class="text-caption text-slate-400 text-weight-bold uppercase tracking-widest no-decoration hover-primary">
          View Pricing & Plans
        </router-link>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { usePreferencesStore } from 'src/stores/preferences'
import { isDemoMode } from 'src/boot/firebase'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const demoMode = isDemoMode

async function handleLogin() {
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    router.push(`/${preferencesStore.startPage || 'today'}`)
  } catch (error) {
    $q.notify({ message: error.message || 'Login failed', color: 'negative', icon: 'o_error' })
  } finally {
    loading.value = false
  }
}

async function handleGoogleLogin() {
  loading.value = true
  try {
    await authStore.loginWithGoogle()
    router.push(`/${preferencesStore.startPage || 'today'}`)
  } catch (error) {
    $q.notify({ message: error.message || 'Google Login failed', color: 'negative', icon: 'o_error' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.auth-card {
  border-radius: 32px;
  border: 1px solid rgba(255,255,255,0.4);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.google-btn {
  border: 1px solid #e2e8f0 !important;
  background: white !important;
  &:hover {
    background: #f8fafc !important;
  }
}

.no-decoration {
  text-decoration: none;
}

.text-slate-400 { color: #94a3b8; }
.text-slate-500 { color: #64748b; }
.text-slate-900 { color: #0f172a; }

.hover-primary:hover {
  color: $primary;
}

.glow-btn {
  box-shadow: 0 10px 15px -3px rgba($primary, 0.3);
  &:active {
    transform: scale(0.98);
  }
}
</style>

<template>
  <transition name="fade" appear>
    <div class="full-width">
      <q-card flat class="auth-form-card">
        <q-card-section class="q-pa-xl">
          <div class="form-head">
            <p>Track.now</p>
            <h2>Sign in</h2>
            <span>Continue your mission streak with one focused step.</span>
          </div>

          <q-banner v-if="demoMode" dense rounded class="demo-banner q-mb-lg">
            <template #avatar>
              <q-icon name="info" color="white" />
            </template>
            Demo mode is active.
          </q-banner>

          <q-form @submit="handleLogin" class="q-gutter-y-md">
            <q-input
              v-model="email"
              type="email"
              label="Email address"
              outlined
              dark
              class="auth-input"
              :rules="[v => !!v || 'Required', v => /.+@.+/.test(v) || 'Invalid email']"
            >
              <template #prepend><q-icon name="mail" color="grey-5" /></template>
            </q-input>

            <q-input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              label="Password"
              outlined
              dark
              class="auth-input"
              :rules="[v => !!v || 'Required']"
            >
              <template #prepend><q-icon name="lock" color="grey-5" /></template>
              <template #append>
                <q-icon
                  :name="showPassword ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  color="grey-5"
                  @click="showPassword = !showPassword"
                />
              </template>
            </q-input>

            <q-btn
              type="submit"
              label="Sign in"
              unelevated
              class="full-width primary-btn q-py-md"
              size="lg"
              :loading="loading"
            />

            <div class="divider-row">
              <q-separator dark class="col" />
              <span>OR</span>
              <q-separator dark class="col" />
            </div>

            <q-btn
              outline
              label="Continue with Google"
              icon="img:https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
              class="full-width google-btn q-py-md"
              size="lg"
              :loading="loading"
              @click="handleGoogleLogin"
            />
          </q-form>

          <div class="form-footer">
            <span>New here?</span>
            <router-link to="/signup">Create account</router-link>
          </div>
        </q-card-section>
      </q-card>

      <div class="bottom-link-wrap">
        <router-link to="/pricing" class="bottom-link">View Plans</router-link>
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
    $q.notify({ message: error.message || 'Login failed', color: 'negative', icon: 'error' })
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
    $q.notify({ message: error.message || 'Google Login failed', color: 'negative', icon: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.auth-form-card {
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(14, 14, 14, 0.92);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
}

.form-head {
  margin-bottom: 16px;

  p {
    margin: 0;
    color: #8c8c92;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 700;
  }

  h2 {
    margin: 6px 0 2px;
    color: #fff;
    font-size: 1.7rem;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  span {
    color: #a2a2a7;
    font-size: 0.92rem;
  }
}

.demo-banner {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.auth-input :deep(.q-field__control) {
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
}

.primary-btn {
  border-radius: 14px;
  background: #fff;
  color: #000;
  font-weight: 800;
}

.divider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 10px 0;

  span {
    color: #8b8b90;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.12em;
  }
}

.google-btn {
  border-radius: 14px;
  border-color: rgba(255, 255, 255, 0.22) !important;
  color: #e5e5e5;
}

.form-footer {
  margin-top: 20px;
  text-align: center;
  color: #9f9fa4;
  font-size: 0.88rem;

  a {
    color: #fff;
    text-decoration: none;
    font-weight: 700;
    margin-left: 6px;
  }
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
</style>

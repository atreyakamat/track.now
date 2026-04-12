<template>
  <q-card flat class="auth-card">
    <q-card-section>
      <div class="text-h6 text-weight-bold q-mb-xs">Create your account</div>
      <div class="text-body2 text-grey-7 q-mb-lg">Start with a simple habit and let the system grow around it.</div>
      <q-banner v-if="demoMode" dense rounded class="q-mb-md bg-blue-1 text-blue-9">
        Demo local mode is active. This account is stored only on this device.
      </q-banner>

      <q-form @submit="handleSignup" class="q-gutter-md">
        <q-input
          v-model="displayName"
          label="Your name"
          outlined
          :rules="[v => !!v || 'Name is required']"
        >
          <template #prepend><q-icon name="person" /></template>
        </q-input>

        <q-input
          v-model="email"
          type="email"
          label="Email"
          outlined
          :rules="[v => !!v || 'Email is required', v => /.+@.+/.test(v) || 'Invalid email']"
        >
          <template #prepend><q-icon name="email" /></template>
        </q-input>

        <q-input
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          label="Password"
          outlined
          :rules="[v => !!v || 'Password is required', v => v.length >= 6 || 'Min 6 characters']"
        >
          <template #prepend><q-icon name="lock" /></template>
          <template #append>
            <q-icon :name="showPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPassword = !showPassword" />
          </template>
        </q-input>

        <q-btn
          type="submit"
          label="Create account"
          color="primary"
          unelevated
          class="full-width"
          size="lg"
          :loading="loading"
        />

        <q-btn
          outline
          color="grey-8"
          label="Continue with Google"
          icon="img:https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
          class="full-width"
          size="lg"
          :loading="loading"
          @click="handleGoogleSignup"
        />
      </q-form>

      <div class="text-center q-mt-lg">
        <span class="text-grey-7">Already have an account? </span>
        <router-link to="/login" class="text-primary text-weight-bold">Sign in</router-link>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { isDemoMode } from 'src/boot/firebase'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()

const displayName = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const demoMode = isDemoMode

async function handleSignup() {
  loading.value = true
  try {
    await authStore.signup(email.value, password.value, displayName.value)
    router.push('/onboarding')
  } catch (error) {
    $q.notify({ message: error.message || 'Signup failed', color: 'negative', icon: 'error' })
  } finally {
    loading.value = false
  }
}

async function handleGoogleSignup() {
  loading.value = true
  try {
    await authStore.loginWithGoogle()
    router.push('/onboarding')
  } catch (error) {
    $q.notify({ message: error.message || 'Google Signup failed', color: 'negative', icon: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-card {
  border-radius: 22px;
}
</style>


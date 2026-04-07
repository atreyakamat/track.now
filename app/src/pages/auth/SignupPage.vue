<template>
  <q-card flat class="signup-card">
    <q-card-section>
      <div class="text-h6 text-weight-bold q-mb-xs">Create account</div>
      <div class="text-caption text-grey q-mb-lg">Start building better habits today</div>

      <q-form @submit="handleSignup" class="q-gutter-md">
        <q-input
          v-model="displayName"
          label="Your name"
          outlined
          dense
          :rules="[v => !!v || 'Name is required']"
        >
          <template #prepend><q-icon name="person" /></template>
        </q-input>

        <q-input
          v-model="email"
          type="email"
          label="Email"
          outlined
          dense
          :rules="[v => !!v || 'Email is required', v => /.+@.+/.test(v) || 'Invalid email']"
        >
          <template #prepend><q-icon name="email" /></template>
        </q-input>

        <q-input
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          label="Password"
          outlined
          dense
          :rules="[v => !!v || 'Password is required', v => v.length >= 6 || 'Min 6 characters']"
        >
          <template #prepend><q-icon name="lock" /></template>
          <template #append>
            <q-icon :name="showPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPassword = !showPassword" />
          </template>
        </q-input>

        <q-btn
          type="submit"
          label="Create Account"
          color="primary"
          unelevated
          class="full-width"
          size="lg"
          :loading="loading"
        />
      </q-form>

      <div class="text-center q-mt-md">
        <span class="text-grey">Already have an account? </span>
        <router-link to="/login" class="text-primary text-weight-bold">Sign In</router-link>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()

const displayName = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)

async function handleSignup() {
  loading.value = true
  try {
    await authStore.signup(email.value, password.value, displayName.value)
    router.push('/onboarding')
  } catch (e) {
    $q.notify({ message: e.message || 'Signup failed', color: 'negative', icon: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

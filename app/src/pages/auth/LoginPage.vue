<template>
  <q-card flat class="login-card">
    <q-card-section>
      <div class="text-h6 text-weight-bold q-mb-xs">Welcome back</div>
      <div class="text-caption text-grey q-mb-lg">Sign in to continue your habit journey</div>

      <q-form @submit="handleLogin" class="q-gutter-md">
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
          :rules="[v => !!v || 'Password is required']"
        >
          <template #prepend><q-icon name="lock" /></template>
          <template #append>
            <q-icon :name="showPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPassword = !showPassword" />
          </template>
        </q-input>

        <q-btn
          type="submit"
          label="Sign In"
          color="primary"
          unelevated
          class="full-width"
          size="lg"
          :loading="loading"
        />
      </q-form>

      <div class="text-center q-mt-md">
        <span class="text-grey">Don't have an account? </span>
        <router-link to="/signup" class="text-primary text-weight-bold">Sign Up</router-link>
      </div>
      <div class="text-center q-mt-sm">
        <router-link to="/pricing" class="text-caption text-grey">View Plans</router-link>
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

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)

async function handleLogin() {
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    router.push('/today')
  } catch (e) {
    $q.notify({ message: e.message || 'Login failed', color: 'negative', icon: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-card {
  border-radius: 16px;
}
</style>

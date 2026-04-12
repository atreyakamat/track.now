<template>
  <q-card flat class="auth-card">
    <q-card-section>
      <div class="text-h6 text-weight-bold q-mb-xs">Sign in</div>
      <div class="text-body2 text-grey-7 q-mb-lg">Continue your mission streak with one clean login.</div>

      <q-form @submit="handleLogin" class="q-gutter-md">
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
          :rules="[v => !!v || 'Password is required']"
        >
          <template #prepend><q-icon name="lock" /></template>
          <template #append>
            <q-icon :name="showPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPassword = !showPassword" />
          </template>
        </q-input>

        <q-btn
          type="submit"
          label="Sign in"
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
          @click="handleGoogleLogin"
        />
      </q-form>

      <div class="text-center q-mt-lg">
        <span class="text-grey-7">Need an account? </span>
        <router-link to="/signup" class="text-primary text-weight-bold">Create one</router-link>
      </div>
      <div class="text-center q-mt-sm">
        <router-link to="/pricing" class="text-caption text-grey-7">See plans</router-link>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { usePreferencesStore } from 'src/stores/preferences'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)

async function handleLogin() {
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    router.push(`/${preferencesStore.startPage}`)
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
    router.push(`/${preferencesStore.startPage}`)
  } catch (error) {
    $q.notify({ message: error.message || 'Google Login failed', color: 'negative', icon: 'error' })
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

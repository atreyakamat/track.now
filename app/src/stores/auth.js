import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from 'src/boot/firebase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const isAuthenticated = computed(() => !!user.value)
  const userId = computed(() => user.value?.uid || null)
  const displayName = computed(() => user.value?.displayName || user.value?.email || '')

  function setUser(firebaseUser) {
    user.value = firebaseUser
  }

  async function login(email, password) {
    loading.value = true
    error.value = null
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      user.value = credential.user
      return credential.user
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function signup(email, password, displayName) {
    loading.value = true
    error.value = null
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(credential.user, { displayName })
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        email,
        displayName,
        plan: 'free',
        createdAt: serverTimestamp()
      })
      user.value = credential.user
      return credential.user
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await signOut(auth)
    user.value = null
  }

  async function getUserProfile() {
    if (!user.value) return null
    const snap = await getDoc(doc(db, 'users', user.value.uid))
    return snap.exists() ? snap.data() : null
  }

  return { user, loading, error, isAuthenticated, userId, displayName, setUser, login, signup, logout, getUserProfile }
})

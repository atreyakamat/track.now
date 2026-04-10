import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as firebaseUpdateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from 'src/boot/firebase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const profile = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const isAuthenticated = computed(() => !!user.value)
  const userId = computed(() => user.value?.uid || null)
  const displayName = computed(() => user.value?.displayName || user.value?.email || '')
  const currentPlan = computed(() => profile.value?.plan || 'free')

  function setUser(firebaseUser) {
    user.value = firebaseUser
    if (!firebaseUser) {
      profile.value = null
    }
  }

  async function login(email, password) {
    loading.value = true
    error.value = null
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      user.value = credential.user
      await loadProfile()
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
      const baseProfile = {
        uid: credential.user.uid,
        email,
        displayName,
        plan: 'free',
        createdAt: serverTimestamp()
      }
      await firebaseUpdateProfile(credential.user, { displayName })
      await setDoc(doc(db, 'users', credential.user.uid), baseProfile)
      user.value = credential.user
      profile.value = {
        uid: credential.user.uid,
        email,
        displayName,
        plan: 'free'
      }
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
    profile.value = null
  }

  async function loadProfile() {
    if (!user.value) return null
    const snap = await getDoc(doc(db, 'users', user.value.uid))
    profile.value = snap.exists() ? snap.data() : null
    return profile.value
  }

  async function updateUserProfile(updates) {
    if (!user.value) return

    await updateDoc(doc(db, 'users', user.value.uid), updates)
    profile.value = {
      ...(profile.value || {}),
      ...updates
    }
  }

  async function updateAccountPlan(plan) {
    await updateUserProfile({ plan })
  }

  return {
    user,
    profile,
    loading,
    error,
    isAuthenticated,
    userId,
    displayName,
    currentPlan,
    setUser,
    login,
    signup,
    logout,
    loadProfile,
    updateUserProfile,
    updateAccountPlan
  }
})

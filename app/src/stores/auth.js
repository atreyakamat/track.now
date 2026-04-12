import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as firebaseUpdateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, isDemoMode } from 'src/boot/firebase'
import {
  clearDemoCurrentUser,
  createDemoId,
  getDemoProfile,
  getDemoUsers,
  saveDemoUsers,
  setDemoCurrentUser,
  updateDemoProfile
} from 'src/utils/demoMode'

function buildDemoAuthUser(profile) {
  if (!profile) return null
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName
  }
}

function sanitizeDemoProfile(profile) {
  if (!profile) return null
  const rest = { ...profile }
  delete rest.password
  return rest
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

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
      if (isDemoMode) {
        const normalizedEmail = normalizeEmail(email)
        const demoUser = getDemoUsers().find((entry) => entry.email === normalizedEmail)

        if (!demoUser || demoUser.password !== password) {
          throw new Error('Invalid email or password')
        }

        const authUser = buildDemoAuthUser(demoUser)
        user.value = authUser
        profile.value = sanitizeDemoProfile(demoUser)
        setDemoCurrentUser(authUser)
        return authUser
      }

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

  async function loginWithGoogle() {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode) {
        const demoProfile = {
          uid: createDemoId('user'),
          email: `google-${Date.now()}@tracknow.demo`,
          displayName: 'Google Demo User',
          plan: 'free',
          createdAt: new Date().toISOString()
        }

        saveDemoUsers([...getDemoUsers(), demoProfile])

        const authUser = buildDemoAuthUser(demoProfile)
        user.value = authUser
        profile.value = sanitizeDemoProfile(demoProfile)
        setDemoCurrentUser(authUser)
        return authUser
      }

      const provider = new GoogleAuthProvider()
      const credential = await signInWithPopup(auth, provider)
      const isNewUser = credential.additionalUserInfo?.isNewUser

      const baseProfile = {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName,
        plan: 'free',
        ...(isNewUser ? { createdAt: serverTimestamp() } : {})
      }

      await setDoc(doc(db, 'users', credential.user.uid), baseProfile, { merge: true })

      user.value = credential.user
      profile.value = {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName,
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

  async function signup(email, password, displayNameValue) {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode) {
        const normalizedEmail = normalizeEmail(email)
        const normalizedDisplayName = String(displayNameValue || '').trim() || 'Track.now User'
        const users = getDemoUsers()

        if (users.some((entry) => entry.email === normalizedEmail)) {
          throw new Error('An account with this email already exists')
        }

        const demoProfile = {
          uid: createDemoId('user'),
          email: normalizedEmail,
          displayName: normalizedDisplayName,
          password,
          plan: 'free',
          createdAt: new Date().toISOString()
        }

        saveDemoUsers([...users, demoProfile])
        const authUser = buildDemoAuthUser(demoProfile)

        user.value = authUser
        profile.value = sanitizeDemoProfile(demoProfile)
        setDemoCurrentUser(authUser)
        return authUser
      }

      const credential = await createUserWithEmailAndPassword(auth, email, password)
      const baseProfile = {
        uid: credential.user.uid,
        email,
        displayName: displayNameValue,
        plan: 'free',
        createdAt: serverTimestamp()
      }
      await firebaseUpdateProfile(credential.user, { displayName: displayNameValue })
      await setDoc(doc(db, 'users', credential.user.uid), baseProfile)
      user.value = credential.user
      profile.value = {
        uid: credential.user.uid,
        email,
        displayName: displayNameValue,
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
    if (isDemoMode) {
      clearDemoCurrentUser()
      user.value = null
      profile.value = null
      return
    }

    await signOut(auth)
    user.value = null
    profile.value = null
  }

  async function loadProfile() {
    if (!user.value) return null

    if (isDemoMode) {
      profile.value = sanitizeDemoProfile(getDemoProfile(user.value.uid))
      return profile.value
    }

    const snap = await getDoc(doc(db, 'users', user.value.uid))
    profile.value = snap.exists() ? snap.data() : null
    return profile.value
  }

  async function updateUserProfile(updates) {
    if (!user.value) return

    if (isDemoMode) {
      profile.value = sanitizeDemoProfile(updateDemoProfile(user.value.uid, updates))

      if ('displayName' in updates) {
        user.value = {
          ...user.value,
          displayName: updates.displayName
        }
      }

      return
    }

    await setDoc(doc(db, 'users', user.value.uid), updates, { merge: true })
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
    loginWithGoogle,
    signup,
    logout,
    loadProfile,
    updateUserProfile,
    updateAccountPlan
  }
})

import { boot } from 'quasar/wrappers'
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics'

function hasRealConfigValue(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return false

  const lower = normalized.toLowerCase()
  if (lower.startsWith('your_') || lower.startsWith('your-') || lower.startsWith('your-project')) return false
  if (lower.includes('<') || lower.includes('>')) return false

  return true
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
}

const explicitDemoMode = String(import.meta.env.VITE_USE_DEMO_MODE || '').toLowerCase() === 'true'
const strictProdFirebase = String(import.meta.env.VITE_REQUIRE_FIREBASE_IN_PROD || '').toLowerCase() === 'true'
const hasFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId
].every((value) => hasRealConfigValue(value))

export const isDemoMode = explicitDemoMode || !hasFirebaseConfig

if (import.meta.env.PROD && strictProdFirebase && isDemoMode) {
  throw new Error(
    'Firebase production configuration is missing. Set VITE_FIREBASE_* values and VITE_USE_DEMO_MODE=false in .env.production.'
  )
}

const firebaseApp = isDemoMode ? null : initializeApp(firebaseConfig)
const auth = firebaseApp ? getAuth(firebaseApp) : null
const db = firebaseApp ? getFirestore(firebaseApp) : null

// Initialize Analytics if supported and not in demo mode
if (firebaseApp) {
  isAnalyticsSupported().then(supported => {
    if (supported) getAnalytics(firebaseApp)
  })
}

export { auth, db }

export default boot(({ app }) => {
  app.config.globalProperties.$firebase = firebaseApp
  app.config.globalProperties.$auth = auth
  app.config.globalProperties.$db = db
  app.config.globalProperties.$isDemoMode = isDemoMode
})

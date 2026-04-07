import { boot } from 'quasar/wrappers'
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Replace these placeholder values with your actual Firebase project config.
// For production, load from environment variables (e.g. import.meta.env.VITE_FIREBASE_API_KEY).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'tracknow-app.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'tracknow-app',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'tracknow-app.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'YOUR_APP_ID'
}

const firebaseApp = initializeApp(firebaseConfig)
const auth = getAuth(firebaseApp)
const db = getFirestore(firebaseApp)

export { auth, db }

export default boot(({ app }) => {
  app.config.globalProperties.$firebase = firebaseApp
  app.config.globalProperties.$auth = auth
  app.config.globalProperties.$db = db
})

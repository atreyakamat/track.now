import { boot } from 'quasar/wrappers'
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'tracknow-app.firebaseapp.com',
  projectId: 'tracknow-app',
  storageBucket: 'tracknow-app.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
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

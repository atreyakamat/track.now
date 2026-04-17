import { boot } from 'quasar/wrappers'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, isDemoMode } from './firebase'
import { useAuthStore } from 'src/stores/auth'
import { usePreferencesStore } from 'src/stores/preferences'
import { getDemoCurrentUser } from 'src/utils/demoMode'

export default boot(({ router, store }) => {
  return new Promise((resolve) => {
    const authStore = useAuthStore(store)

    if (isDemoMode) {
      authStore.setUser(getDemoCurrentUser())
      Promise.resolve(authStore.loadProfile()).finally(() => resolve())
    } else {
      onAuthStateChanged(auth, async (user) => {
        authStore.setUser(user)
        if (user) {
          await authStore.loadProfile()
        }
        resolve()
      })
    }

    router.beforeEach((to, from, next) => {
      const preferencesStore = usePreferencesStore(store)
      const requiresAuth = to.meta.requiresAuth
      const isAuth = authStore.isAuthenticated
      const preferredStartPage = preferencesStore.startPage || 'today'

      if (requiresAuth && !isAuth) {
        next('/login')
      } else if ((to.path === '/login' || to.path === '/signup') && isAuth) {
        next(`/${preferredStartPage}`)
      } else {
        next()
      }
    })
  })
})

import { boot } from 'quasar/wrappers'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { useAuthStore } from 'src/stores/auth'
import { usePreferencesStore } from 'src/stores/preferences'

export default boot(({ router }) => {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      const authStore = useAuthStore()
      authStore.setUser(user)
      if (user) {
        await authStore.loadProfile()
      }
      resolve()
    })

    router.beforeEach((to, from, next) => {
      const authStore = useAuthStore()
      const preferencesStore = usePreferencesStore()
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

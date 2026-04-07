import { boot } from 'quasar/wrappers'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { useAuthStore } from 'src/stores/auth'

export default boot(({ router }) => {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      const authStore = useAuthStore()
      authStore.setUser(user)
      resolve()
    })

    router.beforeEach((to, from, next) => {
      const authStore = useAuthStore()
      const requiresAuth = to.meta.requiresAuth
      const isAuth = authStore.isAuthenticated

      if (requiresAuth && !isAuth) {
        next('/login')
      } else if ((to.path === '/login' || to.path === '/signup') && isAuth) {
        next('/today')
      } else {
        next()
      }
    })
  })
})

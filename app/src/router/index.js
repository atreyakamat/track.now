import { route } from 'quasar/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/today'
  },
  {
    path: '/',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      { path: '/login', component: () => import('pages/auth/LoginPage.vue') },
      { path: '/signup', component: () => import('pages/auth/SignupPage.vue') },
      { path: '/pricing', component: () => import('pages/PricingPage.vue') }
    ]
  },
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '/onboarding', component: () => import('pages/OnboardingPage.vue') },
      { path: '/dashboard', component: () => import('pages/DashboardPage.vue'), meta: { requiresAuth: true } },
      { path: '/today', component: () => import('pages/TodayPage.vue'), meta: { requiresAuth: true } },
      { path: '/planner', component: () => import('pages/PlanningPage.vue'), meta: { requiresAuth: true } },
      { path: '/habits', component: () => import('pages/HabitsPage.vue'), meta: { requiresAuth: true } },
      { path: '/habit/:id', component: () => import('pages/HabitDetailPage.vue'), meta: { requiresAuth: true } },
      { path: '/add', component: () => import('pages/AddHabitPage.vue'), meta: { requiresAuth: true } },
      { path: '/calendar', component: () => import('pages/CalendarPage.vue'), meta: { requiresAuth: true } },
      { path: '/analytics', component: () => import('pages/AnalyticsPage.vue'), meta: { requiresAuth: true } },
      { path: '/notifications', component: () => import('pages/NotificationsPage.vue'), meta: { requiresAuth: true } },
      { path: '/settings', component: () => import('pages/SettingsPage.vue'), meta: { requiresAuth: true } },
      { path: '/friends', component: () => import('pages/FriendsPage.vue'), meta: { requiresAuth: true } },
      { path: '/user/:username', component: () => import('pages/UserProfilePage.vue'), meta: { requiresAuth: true } },
      { path: '/groups', component: () => import('pages/GroupsPage.vue'), meta: { requiresAuth: true } },
      { path: '/group/:id', component: () => import('pages/GroupDetailPage.vue'), meta: { requiresAuth: true } },
      { path: '/family', component: () => import('pages/FamilyPage.vue'), meta: { requiresAuth: true } },
      { path: '/family/:id', component: () => import('pages/FamilyDetailPage.vue'), meta: { requiresAuth: true } }
    ]
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/TodayPage.vue')
  }
]

export default route(function () {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  return createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })
})

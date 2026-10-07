import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, PublicRoute } from './ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'

import { LoginPage } from '@/pages/auth/LoginPage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TracksPage } from '@/pages/tracks/TracksPage'
import { NewTrackPage } from '@/pages/tracks/NewTrackPage'
import { TrackDetailPage } from '@/pages/tracks/TrackDetailPage'
import { NewPlanPage } from '@/pages/plans/NewPlanPage'
import { PlanDetailPage } from '@/pages/plans/PlanDetailPage'
import { TodayPage } from '@/pages/TodayPage'
import { ReviewsPage } from '@/pages/ReviewsPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      {/* Authenticated application shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tracks" element={<TracksPage />} />
          <Route path="/tracks/new" element={<NewTrackPage />} />
          <Route path="/tracks/:trackId" element={<TrackDetailPage />} />
          <Route path="/tracks/:trackId/plans/new" element={<NewPlanPage />} />
          <Route path="/tracks/:trackId/plans/:planId" element={<PlanDetailPage />} />
          <Route path="/plans/:planId" element={<PlanDetailPage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

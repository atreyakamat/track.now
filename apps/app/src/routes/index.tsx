import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, PublicRoute } from './ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'

import { LoginPage } from '@/pages/auth/LoginPage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
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
import { ArcPage } from '@/pages/arcs/ArcPage'
import { StartPage } from '@/pages/StartPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { SharedPlanPage } from '@/pages/SharedPlanPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* Password recovery: reachable with the recovery session the email link creates */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/* Public, read-only shared Plan (accountability partner link). */}
      <Route path="/share/:token" element={<SharedPlanPage />} />

      {/* Public auth routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      {/* Authenticated application shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/today" replace />} />
          {/* Today is the home screen; old /dashboard links keep working. */}
          <Route path="/dashboard" element={<Navigate to="/today" replace />} />
          <Route path="/tracks" element={<TracksPage />} />
          <Route path="/tracks/new" element={<NewTrackPage />} />
          <Route path="/tracks/:trackId" element={<TrackDetailPage />} />
          <Route path="/tracks/:trackId/plans/new" element={<NewPlanPage />} />
          <Route path="/tracks/:trackId/plans/:planId" element={<PlanDetailPage />} />
          <Route path="/plans/:planId" element={<PlanDetailPage />} />
          <Route path="/arcs/:arcKey" element={<ArcPage />} />
          <Route path="/start" element={<StartPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
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

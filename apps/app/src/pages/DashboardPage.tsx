import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Calendar, Clock, Plus, Target } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { listTracks, setTrackArchived } from '@/services/tracksService'
import { listItemSummaries, listPlans } from '@/services/plansService'
import { listUserDailyCompletionCounts } from '@/services/executionService'
import { summarizeTrack, type TrackSummary } from '@/domain/progress'
import { greeting } from '@/domain/dates'
import { ButtonLink, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { TrackCard } from '@/components/tracks/TrackCard'
import { CalendarHeatmap } from '@/components/analytics/CalendarHeatmap'

export function DashboardPage() {
  const { user, displayName } = useAuth()
  const [summaries, setSummaries] = useState<TrackSummary[]>([])
  const [dailyCompletionCounts, setDailyCompletionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [tracks, plans, items, dailyCounts] = await Promise.all([
        listTracks(),
        listPlans(),
        listItemSummaries(),
        user ? listUserDailyCompletionCounts(user.id).catch(() => ({})) : Promise.resolve({}),
      ])

      const trackSummaries = tracks.map((track) => summarizeTrack(track, plans, items))
      setSummaries(trackSummaries)
      setDailyCompletionCounts(dailyCounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  const handleToggleArchive = async (trackId: string, currentStatus: string) => {
    try {
      setBusyTrackId(trackId)
      await setTrackArchived(trackId, currentStatus !== 'archived')
      await loadData()
    } catch (err) {
      console.error('Failed to toggle archive:', err)
    } finally {
      setBusyTrackId(null)
    }
  }

  const activeTrackSummaries = summaries.filter((s) => s.track.status === 'active')
  const totalItems = activeTrackSummaries.reduce((acc, s) => acc + s.progress.total, 0)
  const completedItems = activeTrackSummaries.reduce((acc, s) => acc + s.progress.done, 0)
  const overallPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  return (
    <div>
      <PageHeader
        eyebrow={greeting()}
        title={displayName}
        description="What matters right now? Focus your day on execution across your active life tracks."
        actions={
          <ButtonLink to="/tracks/new" variant="primary" icon>
            <Plus size={16} />
            <span>Create Track</span>
          </ButtonLink>
        }
      />

      {loading && <LoadingState label="Loading your personal OS…" />}
      {error && <ErrorState message={error} onRetry={loadData} />}

      {!loading && !error && (
        <div className="stack" style={{ gap: 'var(--space-6)' }}>
          {/* Quick Metrics Bar */}
          <div className="stat-grid">
            <div className="stat">
              <span className="t-meta">Active Tracks</span>
              <span className="stat__value">{activeTrackSummaries.length}</span>
            </div>
            <div className="stat">
              <span className="t-meta">Active Plans</span>
              <span className="stat__value">
                {activeTrackSummaries.reduce((acc, s) => acc + s.activePlans.length, 0)}
              </span>
            </div>
            <div className="stat">
              <span className="t-meta">Total Items</span>
              <span className="stat__value">{totalItems}</span>
            </div>
            <div className="stat">
              <span className="t-meta">Overall Execution</span>
              <span className="stat__value" style={{ color: 'var(--accent-primary-text)' }}>
                {overallPercent}%
              </span>
            </div>
          </div>

          {/* Active Tracks Section */}
          <section className="section" style={{ marginTop: 0 }}>
            <div className="section__head">
              <h2 className="t-h2">Active Tracks</h2>
              <Link to="/tracks" className="t-caption" style={{ textDecoration: 'none' }}>
                View all ({summaries.length})
              </Link>
            </div>

            {activeTrackSummaries.length === 0 ? (
              <EmptyState
                icon={<Target size={24} />}
                title="No active Tracks yet"
                description="Tracks represent major areas of your life like Fitness, Career, Finance, or Learning. Start by creating your first Track."
                action={
                  <ButtonLink to="/tracks/new" variant="primary">
                    <Plus size={16} /> Choose a Track Template
                  </ButtonLink>
                }
              />
            ) : (
              <div className="grid">
                {activeTrackSummaries.map((summary) => (
                  <TrackCard
                    key={summary.track.id}
                    summary={summary}
                    onToggleArchive={handleToggleArchive}
                    busy={busyTrackId === summary.track.id}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Consistency & Habit Heatmap */}
          <section className="section" style={{ marginTop: 0 }}>
            <CalendarHeatmap
              dailyCounts={dailyCompletionCounts}
              title="Execution & Habit Consistency"
              subtitle="Rolling 12-week consistency heatmap across all your life tracks."
              weeksCount={12}
            />
          </section>

          {/* Today & Execution Highlights */}
          <div className="grid grid--2">
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <h3 className="t-h3" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} />
                  <span>Today's Execution</span>
                </h3>
                <Link to="/today" className="t-caption" style={{ textDecoration: 'none' }}>
                  Open Today <ArrowRight size={12} />
                </Link>
              </div>
              <p className="t-caption" style={{ marginBottom: 'var(--space-3)' }}>
                Single-purpose daily workspace answering: "What do I need to execute today?"
              </p>
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <Link to="/today" className="btn btn--secondary btn--sm">
                  Review Day's Queue
                </Link>
              </div>
            </div>

            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <h3 className="t-h3" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} />
                  <span>Upcoming & Reviews</span>
                </h3>
                <Link to="/reviews" className="t-caption" style={{ textDecoration: 'none' }}>
                  Open Reviews <ArrowRight size={12} />
                </Link>
              </div>
              <p className="t-caption" style={{ marginBottom: 'var(--space-3)' }}>
                Periodic review cycles and reflection milestones across your life areas.
              </p>
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <Link to="/reviews" className="btn btn--secondary btn--sm">
                  View Review System
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

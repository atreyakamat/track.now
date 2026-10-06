import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { getTrack, setTrackArchived } from '@/services/tracksService'
import { listItemSummaries, listPlans, setPlanArchived } from '@/services/plansService'
import { summarizeTrack, type TrackSummary } from '@/domain/progress'
import type { Track } from '@/types/domain'
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ProgressCircle,
} from '@/components/ui'
import { TrackIcon } from '@/components/tracks/TrackIcon'
import { PlanCard } from '@/components/plans/PlanCard'

export function TrackDetailPage() {
  const { trackId } = useParams<{ trackId: string }>()
  const [searchParams] = useSearchParams()
  const justCreated = searchParams.get('created') === 'true'

  const [track, setTrack] = useState<Track | null>(null)
  const [summary, setSummary] = useState<TrackSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null)

  const loadData = async () => {
    if (!trackId) return
    try {
      setLoading(true)
      setError(null)
      const [fetchedTrack, allPlans, items] = await Promise.all([
        getTrack(trackId),
        listPlans(trackId),
        listItemSummaries(),
      ])
      setTrack(fetchedTrack)
      setSummary(summarizeTrack(fetchedTrack, allPlans, items))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load track')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [trackId])

  const handleToggleTrackArchive = async () => {
    if (!track) return
    try {
      await setTrackArchived(track.id, track.status !== 'archived')
      await loadData()
    } catch (err) {
      console.error('Failed to toggle track archive:', err)
    }
  }

  const handleTogglePlanArchive = async (planId: string, currentStatus: string) => {
    try {
      setBusyPlanId(planId)
      await setPlanArchived(planId, currentStatus !== 'archived')
      await loadData()
    } catch (err) {
      console.error('Failed to toggle plan archive:', err)
    } finally {
      setBusyPlanId(null)
    }
  }

  if (loading) return <LoadingState label="Opening track workspace…" />
  if (error || !track || !summary) {
    return (
      <div>
        <PageHeader back={{ to: '/tracks', label: 'All Tracks' }} title="Track" />
        <ErrorState message={error || 'Track not found'} onRetry={loadData} />
      </div>
    )
  }

  const isArchived = track.status === 'archived'

  return (
    <div>
      <PageHeader
        back={{ to: '/tracks', label: 'All Tracks' }}
        eyebrow={track.template_type !== 'custom' ? `${track.template_type} track` : 'Custom Track'}
        title={
          <div className="row" style={{ alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              className="icon-chip"
              style={{ background: track.color, color: '#141414' }}
              aria-hidden="true"
            >
              <TrackIcon name={track.icon} size={22} />
            </div>
            <span>{track.name}</span>
            {isArchived && <Badge>Archived</Badge>}
          </div>
        }
        description={track.description || 'Dedicated operating space for this area of life.'}
        actions={
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <Button
              variant="ghost"
              onClick={handleToggleTrackArchive}
              title={isArchived ? 'Restore Track' : 'Archive Track'}
            >
              {isArchived ? (
                <>
                  <RotateCcw size={16} /> Restore Track
                </>
              ) : (
                <>
                  <Archive size={16} /> Archive Track
                </>
              )}
            </Button>
            <ButtonLink to={`/tracks/${track.id}/plans/new`} variant="primary">
              <Plus size={16} />
              <span>Create Plan</span>
            </ButtonLink>
          </div>
        }
      />

      {justCreated && summary.activePlans.length === 0 && (
        <div className="alert alert--info" style={{ marginBottom: 'var(--space-5)' }}>
          <strong>Welcome to your new {track.name} Track!</strong> Next step: Create your first Plan or execution arc (e.g. "Winter Arc", "30-Day Sprint").
        </div>
      )}

      {/* Progress & Overview Card */}
      <div className="hero-progress" style={{ marginBottom: 'var(--space-6)' }}>
        <ProgressCircle
          percent={summary.progress.percent}
          color={track.color}
          size={100}
          label={`${track.name} overall progress`}
        />
        <div style={{ flex: 1, minWidth: '220px' }}>
          <h2 className="t-h2">{summary.progress.percent}% Overall Progress</h2>
          <p className="t-caption" style={{ marginTop: '4px' }}>
            {summary.progress.total > 0
              ? `Derived from ${summary.progress.done} completed items across ${summary.activePlans.length} active plans.`
              : 'Add execution items (habits, tasks, milestones) to your Plans to start tracking real progress.'}
          </p>
        </div>
      </div>

      {/* Active Plans Section */}
      <section className="section" style={{ marginTop: 0 }}>
        <div className="section__head">
          <h2 className="t-h2">Plans & Execution Arcs</h2>
          <ButtonLink to={`/tracks/${track.id}/plans/new`} variant="secondary" size="sm">
            <Plus size={14} /> New Plan
          </ButtonLink>
        </div>

        {summary.activePlans.length === 0 ? (
          <EmptyState
            title="No active Plans yet"
            description="A Plan is an execution period or mission inside this Track, like 'Winter Arc', 'Q4 Sprint', or '50-Day Habit Reset'."
            action={
              <ButtonLink to={`/tracks/${track.id}/plans/new`} variant="primary">
                <Plus size={16} /> Create Your First Plan
              </ButtonLink>
            }
          />
        ) : (
          <div className="plan-list">
            {summary.activePlans.map((planSummary) => (
              <PlanCard
                key={planSummary.plan.id}
                summary={planSummary}
                trackColor={track.color}
                onToggleArchive={handleTogglePlanArchive}
                busy={busyPlanId === planSummary.plan.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Expandable Archived Plans Section */}
      {summary.archivedPlans.length > 0 && (
        <section className="section" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-5)' }}>
          <button
            type="button"
            className="disclosure"
            onClick={() => setShowArchived((prev) => !prev)}
            aria-expanded={showArchived}
          >
            {showArchived ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <span>Archived Plans ({summary.archivedPlans.length})</span>
          </button>

          {showArchived && (
            <div className="plan-list" style={{ marginTop: 'var(--space-4)' }}>
              {summary.archivedPlans.map((planSummary) => (
                <PlanCard
                  key={planSummary.plan.id}
                  summary={planSummary}
                  trackColor={track.color}
                  onToggleArchive={handleTogglePlanArchive}
                  busy={busyPlanId === planSummary.plan.id}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

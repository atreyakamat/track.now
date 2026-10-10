import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Edit2,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { deleteTrack, getTrack, setTrackArchived, updateTrack } from '@/services/tracksService'
import { listItemSummaries, listPlans, setPlanArchived } from '@/services/plansService'
import { summarizeTrack, type TrackSummary } from '@/domain/progress'
import { TRACK_COLORS, TRACK_ICONS } from '@/constants/trackTemplates'
import type { Track } from '@/types/domain'
import {
  Badge,
  Button,
  ButtonLink,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  ProgressCircle,
  Select,
  Textarea,
} from '@/components/ui'
import { TrackIcon } from '@/components/tracks/TrackIcon'
import { PlanCard } from '@/components/plans/PlanCard'
import { pluralize } from '@/utils/format'

export function TrackDetailPage() {
  const { trackId } = useParams<{ trackId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const justCreated = searchParams.get('created') === 'true'

  const [track, setTrack] = useState<Track | null>(null)
  const [summary, setSummary] = useState<TrackSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null)

  // Edit Track modal
  const [editTrackOpen, setEditTrackOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editIcon, setEditIcon] = useState('Activity')
  const [editColor, setEditColor] = useState('#c8f169')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete Track dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

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

  const handleOpenEditTrack = () => {
    if (!track) return
    setEditName(track.name)
    setEditDesc(track.description || '')
    setEditIcon(track.icon || 'Activity')
    setEditColor(track.color || '#c8f169')
    setEditError(null)
    setEditTrackOpen(true)
  }

  const handleSaveEditTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!track) return
    if (!editName.trim()) {
      setEditError('Track name is required')
      return
    }
    try {
      setEditBusy(true)
      setEditError(null)
      const updated = await updateTrack(track.id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        icon: editIcon,
        color: editColor,
      })
      setTrack(updated)
      setEditTrackOpen(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update track')
    } finally {
      setEditBusy(false)
    }
  }

  const handleDeleteTrack = async () => {
    if (!track) return
    try {
      setDeleteBusy(true)
      await deleteTrack(track.id)
      navigate('/tracks')
    } catch (err) {
      console.error('Failed to delete track:', err)
      setDeleteBusy(false)
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
        eyebrow={(track.template_key || track.template_type) && (track.template_key || track.template_type) !== 'custom' ? `${track.template_key || track.template_type} track` : 'Custom Track'}
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
            <Button variant="ghost" onClick={handleOpenEditTrack} title="Edit Track">
              <Edit2 size={16} /> Edit Track
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(true)}
              title="Delete Track"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={16} /> Delete Track
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
              ? `Derived from ${pluralize(summary.progress.done, 'completed item')} across ${pluralize(summary.activePlans.length, 'active plan')}.`
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

      {/* Edit Track Modal */}
      <Modal
        open={editTrackOpen}
        onClose={() => setEditTrackOpen(false)}
        title="Edit Track"
        actions={
          <>
            <Button variant="ghost" onClick={() => setEditTrackOpen(false)} disabled={editBusy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEditTrack} disabled={editBusy}>
              {editBusy ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveEditTrack} className="form" style={{ gap: 'var(--space-3)' }}>
          {editError && <div className="alert alert--error">{editError}</div>}
          <Input
            label="Track Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Textarea
            label="Description (Optional)"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
          />
          <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
            <Select
              label="Icon"
              value={editIcon}
              onChange={(e) => setEditIcon(e.target.value)}
            >
              {TRACK_ICONS.map((iconName) => (
                <option key={iconName} value={iconName}>
                  {iconName}
                </option>
              ))}
            </Select>
            <Select
              label="Accent Color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
            >
              {TRACK_COLORS.map((c) => (
                <option key={c.key} value={c.value}>
                  {c.label} ({c.value})
                </option>
              ))}
            </Select>
          </div>
        </form>
      </Modal>

      {/* Delete Track Confirm Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={`Delete Track "${track.name}"?`}
        message="This will permanently delete this track along with all associated plans, execution items, and completions. This action cannot be undone."
        confirmLabel={deleteBusy ? 'Deleting…' : 'Delete Track'}
        destructive
        busy={deleteBusy}
        onConfirm={handleDeleteTrack}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}

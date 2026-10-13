import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Edit2,
  Plus,
  RotateCcw,
  SearchX,
  Trash2,
} from 'lucide-react'
import { getTrack, updateTrack } from '@/services/tracksService'
import { listItemSummaries, listPlans } from '@/services/plansService'
import {
  deleteTrackWithCleanup,
  setPlanArchivedWithCleanup,
  setTrackArchivedWithCleanup,
} from '@/services/trackLifecycle'
import { listCompletionsForDate } from '@/services/executionService'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
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

/** Track ids are UUIDs; anything else cannot exist, so treat it as not-found instead of a server error. */
const RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function TrackDetailPage() {
  const { trackId } = useParams<{ trackId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const justCreated = searchParams.get('created') === 'true'
  const seedFailed = searchParams.get('seed') === 'failed'
  const { user } = useAuth()
  const { showToast } = useToast()
  const [archiveBusy, setArchiveBusy] = useState(false)

  const [track, setTrack] = useState<Track | null>(null)
  const [summary, setSummary] = useState<TrackSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
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
  // Synchronous guard: state updates are async, so a fast double submit could slip past `editBusy`.
  const editBusyRef = useRef(false)
  const editFormId = useId()

  // Delete Track dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const deleteBusyRef = useRef(false)

  // Monotonic request id: only the latest load may write state. Bumped on unmount and
  // on trackId/user change, so a slow response for a previous Track is discarded.
  const requestRef = useRef(0)

  const loadData = async (opts: { silent?: boolean } = {}) => {
    const requestId = ++requestRef.current
    if (!opts.silent) setLoading(true)
    setError(null)
    if (!trackId || !RECORD_ID_RE.test(trackId)) {
      setNotFound(true)
      setTrack(null)
      setSummary(null)
      setLoading(false)
      return
    }
    try {
      const [fetchedTrack, allPlans, items, completedTodayIds] = await Promise.all([
        getTrack(trackId),
        listPlans(trackId),
        listItemSummaries(),
        user ? listCompletionsForDate(user.id) : Promise.resolve([] as string[]),
      ])
      if (requestId !== requestRef.current) return
      if (!fetchedTrack) {
        // Deleted, never existed, or hidden by RLS (another user's Track).
        setNotFound(true)
        setTrack(null)
        setSummary(null)
        return
      }
      setNotFound(false)
      setTrack(fetchedTrack)
      setSummary(
        summarizeTrack(fetchedTrack, allPlans, items, { completedTodayIds: new Set(completedTodayIds) }),
      )
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load track')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    return () => {
      // Invalidate any in-flight load for the previous trackId (or after unmount).
      requestRef.current += 1
    }
  }, [trackId, user?.id])

  const showError = (title: string, err: unknown) =>
    showToast({ title, message: err instanceof Error ? err.message : 'Please try again.', type: 'warning', duration: 8000 })

  const handleToggleTrackArchive = async () => {
    if (!track || archiveBusy) return
    const willArchive = track.status !== 'archived'
    try {
      setArchiveBusy(true)
      await setTrackArchivedWithCleanup(user?.id, track.id, willArchive)
      showToast({
        title: willArchive ? 'Track archived' : 'Track restored',
        message: willArchive
          ? 'Its items are hidden from Today and their reminders were cancelled.'
          : 'Its active plans are back in Today.',
        type: 'info',
      })
      await loadData({ silent: true })
    } catch (err) {
      showError(willArchive ? 'Could not archive Track' : 'Could not restore Track', err)
    } finally {
      setArchiveBusy(false)
    }
  }

  const handleTogglePlanArchive = async (planId: string, currentStatus: string) => {
    try {
      setBusyPlanId(planId)
      await setPlanArchivedWithCleanup(user?.id, planId, currentStatus !== 'archived')
      await loadData({ silent: true })
    } catch (err) {
      showError('Could not update the Plan', err)
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

  const handleSaveEditTrack = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!track || editBusyRef.current) return
    if (!editName.trim()) {
      setEditError('Track name is required')
      return
    }
    try {
      editBusyRef.current = true
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
      editBusyRef.current = false
      setEditBusy(false)
    }
  }

  const handleDeleteTrack = async () => {
    if (!track || deleteBusyRef.current) return
    try {
      deleteBusyRef.current = true
      setDeleteBusy(true)
      await deleteTrackWithCleanup(user?.id, track.id)
      showToast({ title: 'Track deleted', message: `“${track.name}” and everything in it were removed.`, type: 'info' })
      navigate('/tracks')
    } catch (err) {
      deleteBusyRef.current = false
      setDeleteBusy(false)
      setDeleteConfirmOpen(false)
      showError('Could not delete Track', err)
    }
  }

  if (loading) return <LoadingState label="Opening track workspace…" />
  if (notFound) {
    return (
      <div>
        <PageHeader back={{ to: '/tracks', label: 'All Tracks' }} title="Track" />
        <EmptyState
          icon={<SearchX size={20} />}
          title="Track not found"
          description="It may have been deleted, or you may not have access to it."
          action={
            <ButtonLink to="/tracks" variant="primary">
              Back to Tracks
            </ButtonLink>
          }
        />
      </div>
    )
  }
  if (error || !track || !summary) {
    return (
      <div>
        <PageHeader back={{ to: '/tracks', label: 'All Tracks' }} title="Track" />
        <ErrorState message={error || 'Track not found'} onRetry={() => loadData()} />
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
          <span className="row page-header__title-row" style={{ alignItems: 'center', gap: 'var(--space-3)' }}>
            <span
              className="icon-chip"
              style={{ background: track.color, color: '#141414' }}
              aria-hidden="true"
            >
              <TrackIcon name={track.icon} size={22} />
            </span>
            <span className="page-header__title-text">{track.name}</span>
            {isArchived && <Badge>Archived</Badge>}
          </span>
        }
        description={track.description || 'Dedicated operating space for this area of life.'}
        actions={
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <Button
              variant="ghost"
              onClick={handleToggleTrackArchive}
              disabled={archiveBusy}
              title={isArchived ? 'Restore Track' : 'Archive Track'}
            >
              {isArchived ? (
                <>
                  <RotateCcw size={16} aria-hidden="true" /> Restore Track
                </>
              ) : (
                <>
                  <Archive size={16} aria-hidden="true" /> Archive Track
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={handleOpenEditTrack} title="Edit Track">
              <Edit2 size={16} aria-hidden="true" /> Edit Track
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(true)}
              title="Delete Track"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={16} aria-hidden="true" /> Delete Track
            </Button>
            <ButtonLink to={`/tracks/${track.id}/plans/new`} variant="primary">
              <Plus size={16} aria-hidden="true" />
              <span>Create Plan</span>
            </ButtonLink>
          </div>
        }
      />

      {seedFailed && (
        <div className="alert alert--error" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
          The Track was created, but its starter plan or items could not all be added. Check the plans below and add
          anything that is missing.
        </div>
      )}

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
            <Plus size={14} aria-hidden="true" /> New Plan
          </ButtonLink>
        </div>

        {summary.activePlans.length === 0 ? (
          <EmptyState
            title="No active Plans yet"
            description="A Plan is an execution period or mission inside this Track, like 'Winter Arc', 'Q4 Sprint', or '50-Day Habit Reset'."
            action={
              <ButtonLink to={`/tracks/${track.id}/plans/new`} variant="primary">
                <Plus size={16} aria-hidden="true" /> Create Your First Plan
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
            {showArchived ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
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
        onClose={() => {
          if (!editBusyRef.current) setEditTrackOpen(false)
        }}
        dismissible={!editBusy}
        title="Edit Track"
        actions={
          <>
            <Button variant="ghost" onClick={() => setEditTrackOpen(false)} disabled={editBusy}>
              Cancel
            </Button>
            {/* Submits the form below (rendered outside it), so Enter and click share one guarded path. */}
            <Button type="submit" form={editFormId} variant="primary" disabled={editBusy} aria-busy={editBusy || undefined}>
              {editBusy ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <form id={editFormId} onSubmit={handleSaveEditTrack} className="form" style={{ gap: 'var(--space-3)' }}>
          {editError && <div className="alert alert--error" role="alert">{editError}</div>}
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

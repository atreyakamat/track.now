import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Archive,
  CheckCircle2,
  Edit2,
  Flag,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { getTrack } from '@tracknow/core/services/tracksService'
import {
  completePlan,
  deletePlan,
  getPlan,
  listPlans,
  setPlanArchived,
  setPlanStatus,
  updatePlan,
} from '@tracknow/core/services/plansService'
import {
  listCompletionsForDate,
  listCompletionsForItems,
  listExecutionItems,
} from '@tracknow/core/services/executionService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { addDays } from '@tracknow/core/domain/streaks'
import { CalendarHeatmap } from '@/components/analytics/CalendarHeatmap'
import { arcKey, arcNames } from '@tracknow/core/domain/arcs'
import { ArcField } from '@/components/plans/ArcField'
import { arcPath } from '@/components/plans/ArcCard'
import { SharePlanCard } from '@/components/plans/SharePlanCard'
import { summarizePlan } from '@tracknow/core/domain/progress'
import { formatDateRange } from '@tracknow/core/utils/format'
import {
  PLAN_KIND_LABEL,
  PLAN_STATUS_LABEL,
  buildPlanOutcomeReport,
  isDueForReview,
  planKindOf,
  planTimeline,
} from '@tracknow/core/domain/plans'
import { NEEDS_MIGRATION_MESSAGE, isLegacySchema } from '@tracknow/core/services/schemaCompat'
import type { ExecutionItem, ItemType, NewExecutionItemInput, Plan, PlanKind, Track } from '@tracknow/core/types/domain'
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
  ProgressBar,
  Select,
  Textarea,
} from '@/components/ui'
import { ExecutionItemCard } from '@/components/execution/ExecutionItemCard'
import { CreateItemModal } from '@/components/execution/CreateItemModal'
import { EditItemModal } from '@/components/execution/EditItemModal'
import { useToast } from '@/features/notifications/ToastContext'
import { cancelRemindersForPlan } from '@tracknow/core/services/reminderService'
import { useExecutionItemActions } from '@/hooks/useExecutionItemActions'
import type { ReminderPreset } from '@tracknow/core/types/notifications'

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

export function PlanDetailPage() {
  const { trackId, planId } = useParams<{ trackId?: string; planId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id
  const { showToast } = useToast()

  const [track, setTrack] = useState<Track | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const requestRef = useRef(0)

  // Item creation / editing / deletion
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDefaultType, setModalDefaultType] = useState<ItemType>('task')
  const [editingItem, setEditingItem] = useState<ExecutionItem | null>(null)
  const [pendingDeleteItem, setPendingDeleteItem] = useState<ExecutionItem | null>(null)

  // Plan editing modal
  const [editPlanOpen, setEditPlanOpen] = useState(false)
  const [editPlanName, setEditPlanName] = useState('')
  const [editPlanDesc, setEditPlanDesc] = useState('')
  const [editPlanStart, setEditPlanStart] = useState('')
  const [editPlanEnd, setEditPlanEnd] = useState('')
  const [editPlanKind, setEditPlanKind] = useState<PlanKind>('time_bound')
  const [editPlanOutcome, setEditPlanOutcome] = useState('')
  const [editPlanCriteria, setEditPlanCriteria] = useState('')
  const [editPlanArc, setEditPlanArc] = useState('')
  const [knownArcs, setKnownArcs] = useState<string[]>([])
  const [editPlanBusy, setEditPlanBusy] = useState(false)
  const [editPlanError, setEditPlanError] = useState<string | null>(null)

  // Completion review
  const [completeOpen, setCompleteOpen] = useState(false)
  const [resultNotes, setResultNotes] = useState('')
  const [lessons, setLessons] = useState('')
  const [nextDecision, setNextDecision] = useState('')
  const [completeBusy, setCompleteBusy] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  // Plan deletion / lifecycle
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)

  const actionsRef = useRef<ReturnType<typeof useExecutionItemActions> | null>(null)

  const loadData = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!planId) return
      const requestId = ++requestRef.current
      const snapshot = actionsRef.current?.snapshotToken() ?? 0
      try {
        if (!opts.silent) setLoading(true)
        setError(null)
        setNotFound(false)
        const p = await getPlan(planId)
        if (!p) {
          if (requestId !== requestRef.current) return
          setPlan(null)
          setNotFound(true)
          return
        }
        // The plan's own track is authoritative. A URL naming a different track would show
        // the wrong header and file new items under the wrong track: fix the URL instead.
        if (trackId && trackId !== p.track_id) {
          navigate(`/tracks/${p.track_id}/plans/${p.id}`, { replace: true })
        }
        const today = getTodayDateString()
        const [t, itemList, todayIds] = await Promise.all([
          getTrack(p.track_id),
          listExecutionItems(planId),
          userId ? listCompletionsForDate(userId, today) : Promise.resolve([] as string[]),
        ])
        // History for every item (streaks, recent activity and the outcome report), bounded to
        // the Plan's own dates or roughly the last year.
        const since = p.start_date && p.start_date > addDays(today, -400) ? p.start_date : addDays(today, -400)
        const history = itemList.length ? await listCompletionsForItems(itemList.map((i) => i.id), since) : {}
        if (requestId !== requestRef.current) return
        if (!t) {
          setPlan(null)
          setNotFound(true)
          return
        }
        setTrack(t)
        setPlan(p)
        if (actionsRef.current && !actionsRef.current.acceptSnapshot(snapshot)) return
        setItems(itemList)
        actionsRef.current?.setCompletionState(todayIds, history)
      } catch (err) {
        if (requestId !== requestRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load plan')
      } finally {
        if (requestId === requestRef.current) setLoading(false)
      }
    },
    [planId, trackId, userId, navigate],
  )

  const actions = useExecutionItemActions({
    userId,
    items,
    setItems,
    reload: () => loadData({ silent: true }),
  })
  actionsRef.current = actions

  useEffect(() => {
    void loadData()
  }, [loadData])

  const habitDailyCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    items
      .filter((i) => i.type === 'habit')
      .forEach((h) => {
        ;(actions.completionDates[h.id] || []).forEach((d) => {
          counts[d] = (counts[d] || 0) + 1
        })
      })
    return counts
  }, [items, actions.completionDates])

  const recentActivity = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]))
    const rows: { item: ExecutionItem; date: string }[] = []
    for (const [id, dates] of Object.entries(actions.completionDates)) {
      const item = byId.get(id)
      if (item) dates.forEach((date) => rows.push({ item, date }))
    }
    return rows.sort((a, b) => (a.date === b.date ? a.item.name.localeCompare(b.item.name) : a.date < b.date ? 1 : -1)).slice(0, 8)
  }, [items, actions.completionDates])

  const showError = (title: string, err: unknown) =>
    showToast({
      title,
      message: err instanceof Error ? err.message : 'Please try again.',
      type: 'warning',
      duration: 8000,
    })

  const handleArchive = async (archive: boolean) => {
    if (!plan || statusBusy) return
    try {
      setStatusBusy(true)
      await setPlanArchived(plan.id, archive)
      if (archive && userId) cancelRemindersForPlan(userId, plan.id)
      showToast({
        title: archive ? 'Plan archived' : 'Plan restored',
        message: archive
          ? 'Its items are hidden from Today and its reminders were cancelled. History is kept.'
          : 'Its items are back in Today. Set reminders again if you need them.',
        type: 'info',
      })
      await loadData({ silent: true })
    } catch (err) {
      showError(archive ? 'Could not archive plan' : 'Could not restore plan', err)
    } finally {
      setStatusBusy(false)
    }
  }

  const handleStatus = async (status: 'active' | 'paused') => {
    if (!plan || statusBusy) return
    try {
      setStatusBusy(true)
      const updated = await setPlanStatus(plan.id, status)
      setPlan(updated)
      showToast({
        title: status === 'paused' ? 'Plan paused' : plan.status === 'completed' ? 'Plan re-opened' : 'Plan resumed',
        message:
          status === 'paused'
            ? 'Its items leave Today until you resume. Nothing is lost and streaks are not penalised by the app.'
            : 'Its items are back in Today.',
        type: 'info',
      })
    } catch (err) {
      showError('Could not change the Plan', err)
    } finally {
      setStatusBusy(false)
    }
  }

  const handleOpenEditPlan = () => {
    if (!plan) return
    setEditPlanName(plan.name)
    setEditPlanDesc(plan.description || '')
    setEditPlanStart(plan.start_date || '')
    setEditPlanEnd(plan.end_date || '')
    setEditPlanKind(planKindOf(plan))
    setEditPlanOutcome(plan.outcome || '')
    setEditPlanCriteria(plan.success_criteria || '')
    setEditPlanArc(plan.arc_name || '')
    listPlans()
      .then((all) => setKnownArcs(arcNames(all)))
      .catch(() => undefined)
    setEditPlanError(null)
    setEditPlanOpen(true)
  }

  const handleSaveEditPlan = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!plan || editPlanBusy) return
    const trimmed = editPlanName.trim()
    if (!trimmed) return setEditPlanError('Plan name is required.')
    if (editPlanKind === 'time_bound' && !editPlanEnd) return setEditPlanError('An Arc needs an end date. Choose “Ongoing” for no end date.')
    if (editPlanStart && editPlanEnd && editPlanEnd < editPlanStart) {
      return setEditPlanError('The end date cannot be before the start date.')
    }
    try {
      setEditPlanBusy(true)
      setEditPlanError(null)
      const updated = await updatePlan(plan.id, {
        name: trimmed,
        description: editPlanDesc.trim() || null,
        start_date: editPlanStart || null,
        end_date: editPlanKind === 'ongoing' ? null : editPlanEnd || null,
        plan_kind: editPlanKind,
        outcome: editPlanOutcome,
        success_criteria: editPlanCriteria,
        arc_name: editPlanArc,
      })
      setPlan(updated)
      setEditPlanOpen(false)
      if ((editPlanOutcome.trim() || editPlanCriteria.trim() || editPlanArc.trim()) && isLegacySchema()) {
        showToast({ id: 'needs-migration', title: 'Plan saved', message: NEEDS_MIGRATION_MESSAGE, type: 'warning', duration: 9000 })
      }
    } catch (err) {
      setEditPlanError(err instanceof Error ? err.message : 'Failed to update plan')
    } finally {
      setEditPlanBusy(false)
    }
  }

  const openComplete = () => {
    if (!plan) return
    setResultNotes(plan.result_notes || '')
    setLessons(plan.lessons_learned || '')
    setNextDecision(plan.next_decision || '')
    setCompleteError(null)
    setCompleteOpen(true)
  }

  const handleComplete = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!plan || completeBusy) return
    try {
      setCompleteBusy(true)
      setCompleteError(null)
      const updated = await completePlan(plan.id, {
        result_notes: resultNotes,
        lessons_learned: lessons,
        next_decision: nextDecision,
      })
      if (userId) cancelRemindersForPlan(userId, plan.id)
      setPlan(updated)
      setCompleteOpen(false)
      showToast({
        id: `plan-complete-${plan.id}`,
        title: `Plan complete: ${plan.name}`,
        message:
          isLegacySchema() && (resultNotes.trim() || lessons.trim() || nextDecision.trim())
            ? 'Completed. Your review notes need the latest database update to be stored.'
            : 'Its history and results are kept. Start the next chapter whenever you are ready.',
        type: 'success',
        duration: 8000,
      })
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Could not complete the Plan.')
    } finally {
      setCompleteBusy(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!plan) return
    try {
      setDeleteBusy(true)
      await deletePlan(plan.id)
      if (userId) cancelRemindersForPlan(userId, plan.id)
      showToast({ title: 'Plan deleted', message: `“${plan.name}” and its items were removed.`, type: 'info' })
      navigate(`/tracks/${plan.track_id}`)
    } catch (err) {
      setDeleteBusy(false)
      setDeleteConfirmOpen(false)
      showError('Could not delete plan', err)
    }
  }

  const findItem = (id: string) => items.find((i) => i.id === id)
  // Deleting cascades completion history, so it always asks first.
  const handleDeleteItem = (itemId: string) => {
    const it = findItem(itemId)
    if (it) setPendingDeleteItem(it)
  }
  const confirmDeleteItem = async () => {
    if (!pendingDeleteItem) return
    const ok = await actions.remove(pendingDeleteItem)
    if (ok) setPendingDeleteItem(null)
  }

  const handleCreateItem = async (
    input: NewExecutionItemInput,
    reminderOptions?: { preset: ReminderPreset; exactTime?: string },
  ) => {
    await actions.create(input, reminderOptions)
  }

  const openCreateModalForType = (type: ItemType) => {
    setModalDefaultType(type)
    setModalOpen(true)
  }

  const isBusy = (id: string) => actions.busyIds.has(id)

  if (loading) return <LoadingState label="Opening plan…" />
  if (notFound) {
    return (
      <div>
        <PageHeader back={{ to: '/tracks', label: 'Back to Tracks' }} title="Plan not found" />
        <EmptyState
          title="This plan isn't available"
          description="It may have been deleted, or the link belongs to a different account."
          action={
            <Button variant="primary" onClick={() => navigate('/tracks')}>
              Go to Tracks
            </Button>
          }
        />
      </div>
    )
  }
  if (error || !plan || !track) {
    return (
      <div>
        <PageHeader back={{ to: trackId ? `/tracks/${trackId}` : '/tracks', label: 'Back to Track' }} title="Plan" />
        <ErrorState message={error || 'Plan not found'} onRetry={loadData} />
      </div>
    )
  }

  const kind = planKindOf(plan)
  const timeline = planTimeline(plan)
  const dueForReview = isDueForReview(plan)
  const isArchived = plan.status === 'archived'
  const isCompleted = plan.status === 'completed'
  const isPaused = plan.status === 'paused'
  const dateRange = formatDateRange(plan.start_date, plan.end_date)
  // Habits count as done only when completed today (their status can be stale from earlier days).
  const progress = summarizePlan(plan, items, { completedTodayIds: actions.completedTodayIds }).progress
  const report = buildPlanOutcomeReport(plan, items, actions.completionDates)

  const milestones = items.filter((i) => i.type === 'milestone')
  const habits = items.filter((i) => i.type === 'habit')
  const work = items.filter((i) => i.type === 'task' || i.type === 'checklist' || i.type === 'project')
  // Items finished today stay in place (instant feedback, easy undo); older ones fold away.
  const openWork = work.filter((i) => i.status !== 'done' || actions.completedTodayIds.has(i.id))
  const doneWork = work.filter((i) => i.status === 'done' && !actions.completedTodayIds.has(i.id))

  const renderCard = (item: ExecutionItem) => (
    <ExecutionItemCard
      key={item.id}
      item={item}
      isCompletedOverride={item.type === 'habit' ? actions.completedTodayIds.has(item.id) : undefined}
      streakSummary={item.type === 'habit' ? actions.streakSummaries[item.id] : undefined}
      weekDone={
        item.type === 'habit' && item.schedule?.times_per_week
          ? actions.streakSummaries[item.id]?.weekDone
          : undefined
      }
      onToggleStatus={(id) => {
        const it = findItem(id)
        if (it) void actions.toggle(it)
      }}
      onUpdateCount={(id, n) => {
        const it = findItem(id)
        if (it) void actions.setCount(it, n)
      }}
      onStepCount={(id, d) => {
        const it = findItem(id)
        if (it) void actions.step(it, d)
      }}
      onToggleChecklistEntry={(it, entryId) => void actions.toggleChecklistEntry(it, entryId)}
      onEdit={(it) => setEditingItem(it)}
      onDelete={handleDeleteItem}
      onSnoozeReminder={actions.snooze}
      onRemoveReminder={actions.removeReminder}
      busy={isBusy(item.id)}
    />
  )

  const group = (title: string, list: ExecutionItem[], addType: ItemType, addLabel: string, empty: string) => (
    <section className="section plan-group" aria-label={`${title} (${list.length})`}>
      <div className="section__head">
        <h2 className="t-h3">
          {title} <span className="t-meta">({list.length})</span>
        </h2>
        {!isArchived && (
          <Button size="sm" variant="ghost" onClick={() => openCreateModalForType(addType)}>
            <Plus size={14} /> {addLabel}
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="t-meta plan-group__empty">{empty}</p>
      ) : (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {list.map(renderCard)}
        </div>
      )}
    </section>
  )

  return (
    <div>
      <PageHeader
        back={{ to: `/tracks/${track.id}`, label: track.name }}
        eyebrow={`${track.name} · ${PLAN_KIND_LABEL[kind]}`}
        title={
          <div className="row" style={{ alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span>{plan.name}</span>
            {plan.status !== 'active' && <Badge>{PLAN_STATUS_LABEL[plan.status]}</Badge>}
          </div>
        }
        description={plan.description || undefined}
        actions={
          <div className="row plan-actions" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {!isArchived && !isCompleted && (
              <Button variant="primary" onClick={() => openCreateModalForType('task')}>
                <Plus size={16} />
                <span>Add Item</span>
              </Button>
            )}
            {(plan.status === 'active' || isPaused) && (
              <Button variant="secondary" onClick={openComplete} disabled={statusBusy}>
                <Trophy size={16} /> Complete
              </Button>
            )}
            {plan.status === 'active' && (
              <Button variant="ghost" onClick={() => void handleStatus('paused')} disabled={statusBusy}>
                <Pause size={16} /> Pause
              </Button>
            )}
            {(isPaused || isCompleted || plan.status === 'draft') && (
              <Button variant="ghost" onClick={() => void handleStatus('active')} disabled={statusBusy}>
                <Play size={16} /> {isCompleted ? 'Re-open' : isPaused ? 'Resume' : 'Activate'}
              </Button>
            )}
            <Button variant="ghost" onClick={() => void handleArchive(!isArchived)} disabled={statusBusy}>
              {isArchived ? (
                <>
                  <RotateCcw size={16} /> Restore
                </>
              ) : (
                <>
                  <Archive size={16} /> Archive
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={handleOpenEditPlan} title="Edit Plan">
              <Edit2 size={16} /> Edit
            </Button>
          </div>
        }
      />

      {plan.arc_name?.trim() && (
        <p className="t-meta" style={{ marginBottom: 'var(--space-3)' }}>
          Part of the Arc{' '}
          <Link to={arcPath({ key: arcKey(plan.arc_name) })}>{plan.arc_name.trim()}</Link>
        </p>
      )}

      {userId && !isArchived && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <SharePlanCard userId={userId} planId={plan.id} />
        </div>
      )}

      {dueForReview && (
        <div className="alert alert--warning plan-review-banner" role="status">
          <span>
            This {kind === 'time_bound' ? 'Arc' : 'Plan'} reached its end date ({fmtDay(plan.end_date!)}). Review how it went,
            then complete it or extend the date. Nothing has been closed for you.
          </span>
          <Button size="sm" variant="primary" onClick={openComplete}>
            Review &amp; complete
          </Button>
        </div>
      )}
      {isPaused && (
        <div className="alert alert--info" role="status" style={{ marginBottom: 'var(--space-4)' }}>
          Paused: its items are not on Today. Resume whenever you are ready.
        </div>
      )}

      {/* Overview: time, outcome, progress */}
      <div className="card plan-overview">
        <div className="plan-overview__grid">
          <div className="plan-overview__time">
            {timeline ? (
              <>
                <span className="t-meta">
                  {timeline.phase === 'not_started'
                    ? `Starts in ${timeline.startsInDays} day${timeline.startsInDays === 1 ? '' : 's'}`
                    : timeline.phase === 'ended'
                      ? 'Arc ended'
                      : `${timeline.daysLeft} day${timeline.daysLeft === 1 ? '' : 's'} left`}
                </span>
                <span className="plan-overview__big">
                  {timeline.phase === 'running' ? `Day ${timeline.day}` : timeline.phase === 'ended' ? `${timeline.totalDays} days` : 'Day 0'}
                  <span className="t-meta"> of {timeline.totalDays}</span>
                </span>
                <ProgressBar percent={timeline.elapsedPercent} label="Time elapsed" hideValue />
                {dateRange && <span className="t-meta">{dateRange}</span>}
              </>
            ) : (
              <>
                <span className="t-meta">{PLAN_KIND_LABEL[kind]}</span>
                <span className="plan-overview__big">No end date</span>
                {plan.start_date && <span className="t-meta">Since {fmtDay(plan.start_date)}</span>}
              </>
            )}
          </div>
          <div className="plan-overview__progress">
            <span className="t-meta">{habits.length && !isCompleted ? 'Progress today' : 'Progress'}</span>
            <span className="plan-overview__big">{progress.percent}%</span>
            <ProgressBar percent={progress.percent} color={track.color} label={`${plan.name} progress`} hideValue />
            <span className="t-meta">
              {progress.total > 0 ? `${progress.done} of ${progress.total} done` : 'Nothing to do yet'}
              {report.milestones.total > 0 && ` · ${report.milestones.done}/${report.milestones.total} milestones`}
            </span>
          </div>
        </div>
        {(plan.outcome || plan.success_criteria) && (
          <dl className="plan-overview__goals">
            {plan.outcome && (
              <div>
                <dt className="t-meta">Desired outcome</dt>
                <dd>{plan.outcome}</dd>
              </div>
            )}
            {plan.success_criteria && (
              <div>
                <dt className="t-meta">Success criteria</dt>
                <dd style={{ whiteSpace: 'pre-line' }}>{plan.success_criteria}</dd>
              </div>
            )}
          </dl>
        )}
        {!plan.outcome && !plan.success_criteria && !isArchived && (
          <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }} onClick={handleOpenEditPlan}>
            <Flag size={14} /> Add a desired outcome
          </button>
        )}
      </div>

      {/* Completed: results and the next chapter */}
      {isCompleted && (
        <section className="card plan-result" aria-label="Plan results">
          <div className="row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
            <Trophy size={18} aria-hidden="true" />
            <h2 className="t-h3">
              Completed{plan.completed_at ? ` on ${fmtDay(getTodayDateString(new Date(plan.completed_at)))}` : ''}
            </h2>
          </div>
          <div className="stat-grid stat-grid--compact">
            <div className="stat">
              <span className="t-meta">Milestones</span>
              <span className="stat__value">
                {report.milestones.done}/{report.milestones.total}
              </span>
            </div>
            <div className="stat">
              <span className="t-meta">Tasks done</span>
              <span className="stat__value">
                {report.tasks.done}/{report.tasks.total}
              </span>
            </div>
            <div className="stat">
              <span className="t-meta">Habit consistency</span>
              <span className="stat__value">{report.habitConsistency === null ? '—' : `${report.habitConsistency}%`}</span>
            </div>
            <div className="stat">
              <span className="t-meta">Active days</span>
              <span className="stat__value">{report.activeDays}</span>
            </div>
          </div>
          {(plan.result_notes || plan.lessons_learned || plan.next_decision) && (
            <dl className="plan-overview__goals">
              {plan.result_notes && (
                <div>
                  <dt className="t-meta">Actual result</dt>
                  <dd style={{ whiteSpace: 'pre-line' }}>{plan.result_notes}</dd>
                </div>
              )}
              {plan.lessons_learned && (
                <div>
                  <dt className="t-meta">Lessons learned</dt>
                  <dd style={{ whiteSpace: 'pre-line' }}>{plan.lessons_learned}</dd>
                </div>
              )}
              {plan.next_decision && (
                <div>
                  <dt className="t-meta">Next decision</dt>
                  <dd style={{ whiteSpace: 'pre-line' }}>{plan.next_decision}</dd>
                </div>
              )}
            </dl>
          )}
          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <ButtonLink to={`/tracks/${track.id}/plans/new`} variant="primary">
              Start the next Arc in {track.name}
            </ButtonLink>
            <ButtonLink to={`/tracks/${track.id}/plans/new?kind=ongoing`} variant="secondary">
              Continue as an ongoing Plan
            </ButtonLink>
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={24} />}
          title="Nothing in this Plan yet"
          description="Add the habits, tasks and milestones that move it forward."
          action={
            !isArchived ? (
              <Button variant="primary" onClick={() => openCreateModalForType('habit')}>
                <Plus size={16} /> Add Your First Item
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="stack" style={{ gap: 'var(--space-6)' }}>
          {group('Milestones', milestones, 'milestone', 'Milestone', 'No milestones yet. Add a target date for a key result.')}
          {group('Habits', habits, 'habit', 'Habit', 'No habits yet.')}
          {habits.length > 0 && (
            <details className="plan-details">
              <summary>Habit calendar (12 weeks)</summary>
              <CalendarHeatmap
                dailyCounts={habitDailyCounts}
                title="Habit consistency"
                subtitle="Completions across this Plan’s habits."
                weeksCount={12}
              />
            </details>
          )}
          {group('Tasks & checklists', openWork, 'task', 'Task', doneWork.length ? 'All tasks are done.' : 'No tasks yet.')}
          {doneWork.length > 0 && (
            <details className="plan-details">
              <summary>Completed tasks ({doneWork.length})</summary>
              <div className="stack" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                {doneWork.map(renderCard)}
              </div>
            </details>
          )}
          {recentActivity.length > 0 && (
            <section className="section" aria-label="Recent activity">
              <div className="section__head">
                <h2 className="t-h3">Recent activity</h2>
              </div>
              <ul className="activity-list">
                {recentActivity.map((r) => (
                  <li key={`${r.item.id}-${r.date}`}>
                    <CheckCircle2 size={14} aria-hidden="true" />
                    <span>{r.item.name}</span>
                    <span className="t-meta">{fmtDay(r.date)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <CreateItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        planId={plan.id}
        trackId={track.id}
        defaultType={modalDefaultType}
        onSubmit={handleCreateItem}
      />

      <EditItemModal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        onSubmit={actions.saveEdit}
        completedToday={editingItem ? actions.completedTodayIds.has(editingItem.id) : false}
      />

      {/* Edit Plan */}
      <Modal
        open={editPlanOpen}
        onClose={() => setEditPlanOpen(false)}
        title="Edit Plan"
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setEditPlanOpen(false)
                setDeleteConfirmOpen(true)
              }}
              disabled={editPlanBusy}
              style={{ color: 'var(--danger)', marginRight: 'auto' }}
              aria-label={`Delete Plan ${plan.name}`}
            >
              <Trash2 size={16} /> Delete
            </Button>
            <Button variant="ghost" onClick={() => setEditPlanOpen(false)} disabled={editPlanBusy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEditPlan} disabled={editPlanBusy}>
              {editPlanBusy ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveEditPlan} className="form" style={{ gap: 'var(--space-3)' }}>
          {editPlanError && (
            <div className="alert alert--error" role="alert">
              {editPlanError}
            </div>
          )}
          <Input label="Plan name" value={editPlanName} onChange={(e) => setEditPlanName(e.target.value)} required maxLength={120} />
          <Select label="Type" value={editPlanKind} onChange={(e) => setEditPlanKind(e.target.value as PlanKind)}>
            <option value="time_bound">Arc (has an end date)</option>
            <option value="ongoing">Ongoing (no end date)</option>
          </Select>
          <Textarea label="Purpose (optional)" value={editPlanDesc} onChange={(e) => setEditPlanDesc(e.target.value)} maxLength={2000} />
          <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
            <Input label="Start date" type="date" value={editPlanStart} onChange={(e) => setEditPlanStart(e.target.value)} />
            {editPlanKind === 'time_bound' && (
              <Input label="End date" type="date" value={editPlanEnd} min={editPlanStart || undefined} onChange={(e) => setEditPlanEnd(e.target.value)} />
            )}
          </div>
          <ArcField value={editPlanArc} onChange={setEditPlanArc} names={knownArcs} />
          <Textarea label="Desired outcome (optional)" value={editPlanOutcome} onChange={(e) => setEditPlanOutcome(e.target.value)} maxLength={2000} />
          <Textarea label="Success criteria (optional)" value={editPlanCriteria} onChange={(e) => setEditPlanCriteria(e.target.value)} maxLength={4000} />
        </form>
      </Modal>

      {/* Complete Plan: completion review */}
      <Modal
        open={completeOpen}
        onClose={() => (completeBusy ? undefined : setCompleteOpen(false))}
        title={`Complete “${plan.name}”`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setCompleteOpen(false)} disabled={completeBusy}>
              Not yet
            </Button>
            <Button variant="primary" onClick={() => void handleComplete()} disabled={completeBusy} aria-busy={completeBusy}>
              {completeBusy ? 'Completing…' : 'Complete Plan'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleComplete} className="form" style={{ gap: 'var(--space-3)' }}>
          {completeError && (
            <div className="alert alert--error" role="alert">
              {completeError}
            </div>
          )}
          <div className="stat-grid stat-grid--compact" aria-label="Results so far">
            <div className="stat">
              <span className="t-meta">Milestones</span>
              <span className="stat__value">
                {report.milestones.done}/{report.milestones.total}
              </span>
            </div>
            <div className="stat">
              <span className="t-meta">Tasks</span>
              <span className="stat__value">
                {report.tasks.done}/{report.tasks.total}
              </span>
            </div>
            <div className="stat">
              <span className="t-meta">Habit consistency</span>
              <span className="stat__value">{report.habitConsistency === null ? '—' : `${report.habitConsistency}%`}</span>
            </div>
            <div className="stat">
              <span className="t-meta">Active days</span>
              <span className="stat__value">{report.activeDays}</span>
            </div>
          </div>
          {plan.outcome && (
            <p className="t-caption">
              <strong>You set out to:</strong> {plan.outcome}
            </p>
          )}
          <Textarea label="What actually happened?" value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} maxLength={4000} />
          <Textarea label="Lessons learned" value={lessons} onChange={(e) => setLessons(e.target.value)} maxLength={4000} />
          <Textarea
            label="Next decision"
            placeholder="Continue, change or stop? e.g. Keep gym 4×/week as an ongoing Plan"
            value={nextDecision}
            onChange={(e) => setNextDecision(e.target.value)}
            maxLength={2000}
          />
          <p className="t-meta">Saved with the Plan and synced to your account. History, streaks and completions are kept.</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDeleteItem)}
        title={pendingDeleteItem ? `Delete “${pendingDeleteItem.name}”?` : 'Delete item?'}
        message="This permanently deletes the item, its schedule, and its completion history (streaks and analytics will no longer include it). This cannot be undone."
        confirmLabel={pendingDeleteItem && isBusy(pendingDeleteItem.id) ? 'Deleting…' : 'Delete Item'}
        destructive
        busy={pendingDeleteItem ? isBusy(pendingDeleteItem.id) : false}
        onConfirm={() => void confirmDeleteItem()}
        onCancel={() => setPendingDeleteItem(null)}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={`Delete Plan "${plan.name}"?`}
        message="This will permanently delete this plan and all associated execution items and completion logs. Completing or archiving keeps the history instead. This cannot be undone."
        confirmLabel={deleteBusy ? 'Deleting…' : 'Delete Plan'}
        destructive
        busy={deleteBusy}
        onConfirm={handleDeletePlan}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}

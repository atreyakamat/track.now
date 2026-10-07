import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Archive,
  CheckCircle2,
  Edit2,
  FolderKanban,
  ListCheck,
  Milestone,
  Plus,
  Repeat,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { getTrack } from '@/services/tracksService'
import { deletePlan, getPlan, setPlanArchived, updatePlan } from '@/services/plansService'
import {
  createExecutionItem,
  deleteExecutionItem,
  editExecutionItem,
  listCompletionsForDate,
  listExecutionItems,
  toggleHabitTodayCompletion,
  toggleItemStatus,
  updateItemProgress,
} from '@/services/executionService'
import { getTodayDateString } from '@/domain/dates'
import { summarizePlan } from '@/domain/progress'
import { formatDateRange } from '@/utils/format'
import type {
  ExecutionItem,
  ItemType,
  NewExecutionItemInput,
  Plan,
  Track,
  UpdateExecutionItemInput,
} from '@/types/domain'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  ProgressBar,
  ProgressCircle,
  TabPanel,
  Tabs,
  Textarea,
} from '@/components/ui'
import { ExecutionItemCard } from '@/components/execution/ExecutionItemCard'
import { CreateItemModal } from '@/components/execution/CreateItemModal'
import { EditItemModal } from '@/components/execution/EditItemModal'

export function PlanDetailPage() {
  const { trackId, planId } = useParams<{ trackId?: string; planId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [track, setTrack] = useState<Track | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tabs
  const [activeTab, setActiveTab] = useState('overview')

  // Item creation modal
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDefaultType, setModalDefaultType] = useState<ItemType>('task')
  const [editingItem, setEditingItem] = useState<ExecutionItem | null>(null)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)

  // Plan editing modal
  const [editPlanOpen, setEditPlanOpen] = useState(false)
  const [editPlanName, setEditPlanName] = useState('')
  const [editPlanDesc, setEditPlanDesc] = useState('')
  const [editPlanStart, setEditPlanStart] = useState('')
  const [editPlanEnd, setEditPlanEnd] = useState('')
  const [editPlanBusy, setEditPlanBusy] = useState(false)
  const [editPlanError, setEditPlanError] = useState<string | null>(null)

  // Plan deletion
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [todayCompletedIds, setTodayCompletedIds] = useState<string[]>([])

  const loadData = async () => {
    if (!planId) return
    try {
      setLoading(true)
      setError(null)
      const p = await getPlan(planId)
      const targetTrackId = trackId || p.track_id
      const [t, itemList, completions] = await Promise.all([
        getTrack(targetTrackId),
        listExecutionItems(planId),
        user ? listCompletionsForDate(user.id, getTodayDateString()).catch(() => []) : Promise.resolve([]),
      ])
      setTrack(t)
      setPlan(p)
      setItems(itemList)
      setTodayCompletedIds(completions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [trackId, planId, user?.id])

  const handleTogglePlanArchive = async () => {
    if (!plan) return
    try {
      await setPlanArchived(plan.id, plan.status !== 'archived')
      await loadData()
    } catch (err) {
      console.error('Failed to toggle plan archive:', err)
    }
  }

  const handleOpenEditPlan = () => {
    if (!plan) return
    setEditPlanName(plan.name)
    setEditPlanDesc(plan.description || '')
    setEditPlanStart(plan.start_date || '')
    setEditPlanEnd(plan.end_date || '')
    setEditPlanError(null)
    setEditPlanOpen(true)
  }

  const handleSaveEditPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plan) return
    if (!editPlanName.trim()) {
      setEditPlanError('Plan name is required')
      return
    }

    try {
      setEditPlanBusy(true)
      setEditPlanError(null)
      const updated = await updatePlan(plan.id, {
        name: editPlanName.trim(),
        description: editPlanDesc.trim() || null,
        start_date: editPlanStart || null,
        end_date: editPlanEnd || null,
      })
      setPlan(updated)
      setEditPlanOpen(false)
    } catch (err) {
      setEditPlanError(err instanceof Error ? err.message : 'Failed to update plan')
    } finally {
      setEditPlanBusy(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!plan) return
    try {
      setDeleteBusy(true)
      await deletePlan(plan.id)
      navigate(`/tracks/${plan.track_id}`)
    } catch (err) {
      console.error('Failed to delete plan:', err)
      setDeleteBusy(false)
    }
  }

  const handleToggleItemStatus = async (itemId: string, currentStatus: ExecutionItem['status']) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    try {
      setBusyItemId(itemId)
      if (item.type === 'habit') {
        const isDoneToday = todayCompletedIds.includes(itemId)
        if (user) {
          const nextDone = await toggleHabitTodayCompletion(user.id, itemId, isDoneToday)
          setTodayCompletedIds((prev) =>
            nextDone ? [...prev, itemId] : prev.filter((id) => id !== itemId),
          )
          const target = Math.max(1, item.target_count ?? 1)
          const newCount = nextDone ? target : 0
          if ((item.current_count ?? 0) !== newCount) {
            const updated = await updateItemProgress(itemId, newCount, user.id)
            setItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)))
          }
        } else {
          setTodayCompletedIds((prev) =>
            isDoneToday ? prev.filter((id) => id !== itemId) : [...prev, itemId],
          )
        }
      } else {
        const updated = await toggleItemStatus(itemId, currentStatus, user?.id)
        setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)))
      }
    } catch (err) {
      console.error('Failed to update item status:', err)
    } finally {
      setBusyItemId(null)
    }
  }

  const handleUpdateItemCount = async (itemId: string, newCount: number) => {
    try {
      setBusyItemId(itemId)
      const updated = await updateItemProgress(itemId, newCount, user?.id)
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)))
      const item = items.find((i) => i.id === itemId)
      if (item && item.type === 'habit') {
        const target = Math.max(1, updated.target_count ?? 1)
        if (newCount >= target) {
          setTodayCompletedIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]))
        } else {
          setTodayCompletedIds((prev) => prev.filter((id) => id !== itemId))
        }
      }
    } catch (err) {
      console.error('Failed to update item count:', err)
    } finally {
      setBusyItemId(null)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    try {
      setBusyItemId(itemId)
      await deleteExecutionItem(itemId)
      setItems((prev) => prev.filter((item) => item.id !== itemId))
    } catch (err) {
      console.error('Failed to delete item:', err)
    } finally {
      setBusyItemId(null)
    }
  }

  const handleSaveEditItem = async (itemId: string, input: UpdateExecutionItemInput) => {
    if (!user) return
    try {
      setBusyItemId(itemId)
      const updated = await editExecutionItem(itemId, input, user.id)
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)))
      setEditingItem(null)
    } catch (err) {
      console.error('Failed to update execution item:', err)
      throw err
    } finally {
      setBusyItemId(null)
    }
  }

  const handleCreateItem = async (input: NewExecutionItemInput) => {
    if (!user) return
    const created = await createExecutionItem(user.id, input)
    setItems((prev) => [...prev, created])
  }

  const openCreateModalForType = (type: ItemType) => {
    setModalDefaultType(type)
    setModalOpen(true)
  }

  if (loading) return <LoadingState label="Opening plan workspace…" />
  if (error || !plan || !track) {
    return (
      <div>
        <PageHeader
          back={{ to: trackId ? `/tracks/${trackId}` : '/tracks', label: 'Back to Track' }}
          title="Plan"
        />
        <ErrorState message={error || 'Plan not found'} onRetry={loadData} />
      </div>
    )
  }

  const isArchived = plan.status === 'archived'
  const dateRange = formatDateRange(plan.start_date, plan.end_date)
  const planSummary = summarizePlan(plan, items)
  const progress = planSummary.progress

  // Filter items by type
  const tasks = items.filter((i) => i.type === 'task')
  const habits = items.filter((i) => i.type === 'habit')
  const checklists = items.filter((i) => i.type === 'checklist')
  const projects = items.filter((i) => i.type === 'project')
  const milestones = items.filter((i) => i.type === 'milestone')

  const tabList = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: `Tasks (${tasks.length})` },
    { id: 'habits', label: `Habits (${habits.length})` },
    { id: 'checklists', label: `Checklists (${checklists.length})` },
    { id: 'projects', label: `Projects (${projects.length})` },
    { id: 'milestones', label: `Milestones (${milestones.length})` },
    { id: 'progress', label: 'Progress' },
  ]

  return (
    <div>
      <PageHeader
        back={{ to: `/tracks/${track.id}`, label: track.name }}
        eyebrow={`${track.name} Track · Plan Arc`}
        title={
          <div className="row" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
            <span>{plan.name}</span>
            {isArchived && <Badge>Archived</Badge>}
          </div>
        }
        description={plan.description || (dateRange ? `Execution arc: ${dateRange}` : 'Plan workspace')}
        actions={
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <Button
              variant="ghost"
              onClick={handleTogglePlanArchive}
              title={isArchived ? 'Restore Plan' : 'Archive Plan'}
            >
              {isArchived ? <><RotateCcw size={16} /> Restore</> : <><Archive size={16} /> Archive</>}
            </Button>
            <Button variant="ghost" onClick={handleOpenEditPlan} title="Edit Plan">
              <Edit2 size={16} /> Edit
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(true)}
              title="Delete Plan"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={16} /> Delete
            </Button>
            <Button variant="primary" onClick={() => openCreateModalForType('task')}>
              <Plus size={16} />
              <span>Add Item</span>
            </Button>
          </div>
        }
      />

      {/* Hero Progress Banner */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="t-meta">Plan Progress</span>
            <h2 className="t-h2">{progress.percent}% Completed</h2>
          </div>
          <span className="t-caption">
            {progress.total > 0
              ? `${progress.done} of ${progress.total} items done`
              : 'No execution items yet'}
          </span>
        </div>
        <div style={{ marginTop: 'var(--space-2)' }}>
          <ProgressBar percent={progress.percent} color={track.color} label={`${plan.name} progress`} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <Tabs
          label="Plan Workspace Views"
          tabs={tabList}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* 1. Overview Panel */}
      <TabPanel id="overview" active={activeTab}>
        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          <div className="stat-grid">
            <div className="stat">
              <span className="t-meta">Tasks</span>
              <span className="stat__value">{tasks.length}</span>
            </div>
            <div className="stat">
              <span className="t-meta">Habits</span>
              <span className="stat__value">{habits.length}</span>
            </div>
            <div className="stat">
              <span className="t-meta">Checklists</span>
              <span className="stat__value">{checklists.length}</span>
            </div>
            <div className="stat">
              <span className="t-meta">Milestones</span>
              <span className="stat__value">{milestones.length}</span>
            </div>
            <div className="stat">
              <span className="t-meta">Projects</span>
              <span className="stat__value">{projects.length}</span>
            </div>
          </div>

          <section className="section" style={{ marginTop: 0 }}>
            <div className="section__head">
              <h3 className="t-h3">All Execution Items ({items.length})</h3>
              <Button size="sm" onClick={() => openCreateModalForType('task')}>
                <Plus size={14} /> Add Item
              </Button>
            </div>

            {items.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={24} />}
                title="No execution items yet"
                description="Add tasks, recurring habits, checklists, milestones, or projects to this plan."
                action={
                  <Button variant="primary" onClick={() => openCreateModalForType('task')}>
                    <Plus size={16} /> Add Your First Item
                  </Button>
                }
              />
            ) : (
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {items.map((item) => (
                  <ExecutionItemCard
                    key={item.id}
                    item={item}
                    isCompletedOverride={item.type === 'habit' ? todayCompletedIds.includes(item.id) : undefined}
                    onToggleStatus={handleToggleItemStatus}
                    onUpdateCount={handleUpdateItemCount}
                    onEdit={(item) => setEditingItem(item)}
                    onDelete={handleDeleteItem}
                    busy={busyItemId === item.id}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </TabPanel>

      {/* 2. Tasks Panel */}
      <TabPanel id="tasks" active={activeTab}>
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 className="t-h3">Tasks</h3>
            <Button size="sm" onClick={() => openCreateModalForType('task')}>
              <Plus size={14} /> Add Task
            </Button>
          </div>
          {tasks.length === 0 ? (
            <EmptyState
              title="No tasks in this plan"
              description="Tasks are actionable to-dos with priorities and due dates."
              action={
                <Button size="sm" onClick={() => openCreateModalForType('task')}>
                  <Plus size={14} /> Add Task
                </Button>
              }
            />
          ) : (
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {tasks.map((item) => (
                <ExecutionItemCard
                  key={item.id}
                  item={item}
                  isCompletedOverride={item.type === 'habit' ? todayCompletedIds.includes(item.id) : undefined}
                  onToggleStatus={handleToggleItemStatus}
                  onUpdateCount={handleUpdateItemCount}
                  onEdit={(item) => setEditingItem(item)}
                  onDelete={handleDeleteItem}
                  busy={busyItemId === item.id}
                />
              ))}
            </div>
          )}
        </div>
      </TabPanel>

      {/* 3. Habits Panel */}
      <TabPanel id="habits" active={activeTab}>
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 className="t-h3">Habits</h3>
            <Button size="sm" onClick={() => openCreateModalForType('habit')}>
              <Plus size={14} /> Add Habit
            </Button>
          </div>
          {habits.length === 0 ? (
            <EmptyState
              icon={<Repeat size={24} />}
              title="No habits in this plan"
              description="Habits are recurring routines tied to this execution arc (e.g. morning stretch, 30-min reading)."
              action={
                <Button size="sm" onClick={() => openCreateModalForType('habit')}>
                  <Plus size={14} /> Add Habit
                </Button>
              }
            />
          ) : (
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {habits.map((item) => (
                <ExecutionItemCard
                  key={item.id}
                  item={item}
                  isCompletedOverride={item.type === 'habit' ? todayCompletedIds.includes(item.id) : undefined}
                  onToggleStatus={handleToggleItemStatus}
                  onUpdateCount={handleUpdateItemCount}
                  onEdit={(item) => setEditingItem(item)}
                  onDelete={handleDeleteItem}
                  busy={busyItemId === item.id}
                />
              ))}
            </div>
          )}
        </div>
      </TabPanel>

      {/* 4. Checklists Panel */}
      <TabPanel id="checklists" active={activeTab}>
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 className="t-h3">Checklists</h3>
            <Button size="sm" onClick={() => openCreateModalForType('checklist')}>
              <Plus size={14} /> Add Checklist Item
            </Button>
          </div>
          {checklists.length === 0 ? (
            <EmptyState
              icon={<ListCheck size={24} />}
              title="No checklist items in this plan"
              description="Checklist items are simple pass/fail verification points."
              action={
                <Button size="sm" onClick={() => openCreateModalForType('checklist')}>
                  <Plus size={14} /> Add Item
                </Button>
              }
            />
          ) : (
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {checklists.map((item) => (
                <ExecutionItemCard
                  key={item.id}
                  item={item}
                  isCompletedOverride={item.type === 'habit' ? todayCompletedIds.includes(item.id) : undefined}
                  onToggleStatus={handleToggleItemStatus}
                  onUpdateCount={handleUpdateItemCount}
                  onEdit={(item) => setEditingItem(item)}
                  onDelete={handleDeleteItem}
                  busy={busyItemId === item.id}
                />
              ))}
            </div>
          )}
        </div>
      </TabPanel>

      {/* 5. Projects Panel */}
      <TabPanel id="projects" active={activeTab}>
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 className="t-h3">Projects</h3>
            <Button size="sm" onClick={() => openCreateModalForType('project')}>
              <Plus size={14} /> Add Project
            </Button>
          </div>
          {projects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban size={24} />}
              title="No projects in this plan"
              description="Projects represent larger deliverables or initiatives composed of tasks."
              action={
                <Button size="sm" onClick={() => openCreateModalForType('project')}>
                  <Plus size={14} /> Add Project
                </Button>
              }
            />
          ) : (
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {projects.map((item) => (
                <ExecutionItemCard
                  key={item.id}
                  item={item}
                  isCompletedOverride={item.type === 'habit' ? todayCompletedIds.includes(item.id) : undefined}
                  onToggleStatus={handleToggleItemStatus}
                  onUpdateCount={handleUpdateItemCount}
                  onEdit={(item) => setEditingItem(item)}
                  onDelete={handleDeleteItem}
                  busy={busyItemId === item.id}
                />
              ))}
            </div>
          )}
        </div>
      </TabPanel>

      {/* 6. Milestones Panel */}
      <TabPanel id="milestones" active={activeTab}>
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 className="t-h3">Milestones</h3>
            <Button size="sm" onClick={() => openCreateModalForType('milestone')}>
              <Plus size={14} /> Add Milestone
            </Button>
          </div>
          {milestones.length === 0 ? (
            <EmptyState
              icon={<Milestone size={24} />}
              title="No milestones in this plan"
              description="Milestones are significant marker achievements along this arc."
              action={
                <Button size="sm" onClick={() => openCreateModalForType('milestone')}>
                  <Plus size={14} /> Add Milestone
                </Button>
              }
            />
          ) : (
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {milestones.map((item) => (
                <ExecutionItemCard
                  key={item.id}
                  item={item}
                  isCompletedOverride={item.type === 'habit' ? todayCompletedIds.includes(item.id) : undefined}
                  onToggleStatus={handleToggleItemStatus}
                  onUpdateCount={handleUpdateItemCount}
                  onEdit={(item) => setEditingItem(item)}
                  onDelete={handleDeleteItem}
                  busy={busyItemId === item.id}
                />
              ))}
            </div>
          )}
        </div>
      </TabPanel>

      {/* 7. Progress Panel */}
      <TabPanel id="progress" active={activeTab}>
        <div className="card">
          <div className="row" style={{ alignItems: 'center', gap: 'var(--space-5)' }}>
            <ProgressCircle
              percent={progress.percent}
              color={track.color}
              size={120}
              label={`${plan.name} progress`}
            />
            <div>
              <h3 className="t-h2">{progress.percent}% Completion Rate</h3>
              <p className="t-caption" style={{ marginTop: '4px' }}>
                {progress.total > 0
                  ? `${progress.done} of ${progress.total} items completed.`
                  : 'Add execution items to see your progress curve.'}
              </p>
              <div className="row" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                <span className="badge">Done: {progress.done}</span>
                <span className="badge">Pending: {progress.total - progress.done}</span>
                <span className="badge">Total: {progress.total}</span>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      {/* Create Item Modal */}
      <CreateItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        planId={plan.id}
        trackId={track.id}
        defaultType={modalDefaultType}
        onSubmit={handleCreateItem}
      />

      {/* Edit Item Modal */}
      <EditItemModal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        onSubmit={handleSaveEditItem}
      />

      {/* Edit Plan Modal */}
      <Modal
        open={editPlanOpen}
        onClose={() => setEditPlanOpen(false)}
        title="Edit Plan"
        actions={
          <>
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
          {editPlanError && <div className="alert alert--error">{editPlanError}</div>}
          <Input
            label="Plan Name"
            value={editPlanName}
            onChange={(e) => setEditPlanName(e.target.value)}
            required
          />
          <Textarea
            label="Description (Optional)"
            value={editPlanDesc}
            onChange={(e) => setEditPlanDesc(e.target.value)}
          />
          <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
            <Input
              label="Start Date (Optional)"
              type="date"
              value={editPlanStart}
              onChange={(e) => setEditPlanStart(e.target.value)}
            />
            <Input
              label="End Date (Optional)"
              type="date"
              value={editPlanEnd}
              onChange={(e) => setEditPlanEnd(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Plan Confirm Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={`Delete Plan "${plan.name}"?`}
        message="This will permanently delete this plan and all associated execution items and completion logs. This action cannot be undone."
        confirmLabel={deleteBusy ? 'Deleting…' : 'Delete Plan'}
        destructive
        busy={deleteBusy}
        onConfirm={handleDeletePlan}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}

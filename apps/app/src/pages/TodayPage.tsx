import { useEffect, useState } from 'react'
import { CheckCircle2, Clock } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  editExecutionItem,
  listCompletionsForDate,
  listTodayExecutionItems,
  stepItemCount,
  toggleHabitTodayCompletion,
  toggleItemStatus,
  updateItemProgress,
} from '@/services/executionService'
import {
  getTodayDateString,
  isDueToday,
  isHabitScheduledForToday,
  isOverdue,
  isUpcoming,
} from '@/domain/dates'
import type { ExecutionItem, UpdateExecutionItemInput } from '@/types/domain'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { ExecutionItemCard } from '@/components/execution/ExecutionItemCard'
import { EditItemModal } from '@/components/execution/EditItemModal'

export function TodayPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [todayCompletedIds, setTodayCompletedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<ExecutionItem | null>(null)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const allItems = await listTodayExecutionItems()
      setItems(allItems)
      if (user) {
        const todayDate = getTodayDateString()
        const completedIds = await listCompletionsForDate(user.id, todayDate)
        setTodayCompletedIds(completedIds)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load today items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  const handleToggleStatus = async (itemId: string, currentStatus: ExecutionItem['status']) => {
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
        setItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)))
      }
    } catch (err) {
      console.error('Failed to toggle status:', err)
    } finally {
      setBusyItemId(null)
    }
  }

  const handleUpdateCount = async (itemId: string, newCount: number) => {
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

  const handleStepCount = async (itemId: string, delta: number) => {
    try {
      setBusyItemId(itemId)
      const updated = await stepItemCount(itemId, delta, user?.id)
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)))
      const item = items.find((i) => i.id === itemId)
      if (item && item.type === 'habit') {
        const target = Math.max(1, updated.target_count ?? 1)
        if ((updated.current_count ?? 0) >= target) {
          setTodayCompletedIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]))
        } else {
          setTodayCompletedIds((prev) => prev.filter((id) => id !== itemId))
        }
      }
    } catch (err) {
      console.error('Failed to step item count:', err)
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

  if (loading) return <LoadingState label="Preparing today's queue…" />
  if (error) return <ErrorState message={error} onRetry={loadData} />

  // Partition items into Overdue, Today, Upcoming, and Completed
  const isItemCompleted = (i: ExecutionItem) => {
    if (i.type === 'habit') {
      return todayCompletedIds.includes(i.id)
    }
    return i.status === 'done'
  }

  const uncompleted = items.filter((i) => !isItemCompleted(i) && i.status !== 'archived')
  const completed = items.filter((i) => isItemCompleted(i) && i.status !== 'archived')

  const overdueItems = uncompleted.filter((i) => i.type !== 'habit' && isOverdue(i.due_date))

  const todayItems = uncompleted.filter((i) => {
    if (i.type === 'habit') {
      return !i.schedule || isHabitScheduledForToday(i.schedule)
    }
    return isDueToday(i.due_date)
  })

  const upcomingItems = uncompleted.filter((i) => {
    if (i.type === 'habit') {
      return Boolean(i.schedule && !isHabitScheduledForToday(i.schedule))
    }
    return isUpcoming(i.due_date)
  })

  const anytimeItems = uncompleted.filter((i) => {
    if (i.type === 'habit') return false
    return !i.due_date
  })

  const totalOpen = uncompleted.length

  return (
    <div>
      <PageHeader
        title="Today"
        description="What do you need to execute today? Focus on the items that move your life tracks forward."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={24} />}
          title="No execution items found"
          description="Create plans and execution items in your Tracks to see them scheduled here."
        />
      ) : totalOpen === 0 && completed.length > 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={24} color="var(--success)" />}
          title="All caught up for today"
          description={`You have completed all scheduled items. Consistency protected.`}
        />
      ) : (
        <div className="stack" style={{ gap: 'var(--space-6)' }}>
          {/* Overdue Section */}
          {overdueItems.length > 0 && (
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section__head">
                <h2 className="t-h2" style={{ color: 'var(--danger)' }}>
                  Overdue ({overdueItems.length})
                </h2>
              </div>
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {overdueItems.map((item) => (
                  <ExecutionItemCard
                    key={item.id}
                    item={item}
                    isCompletedOverride={item.type === 'habit' ? todayCompletedIds.includes(item.id) : undefined}
                    onToggleStatus={handleToggleStatus}
                    onUpdateCount={handleUpdateCount}
                    onStepCount={handleStepCount}
                    onEdit={(item) => setEditingItem(item)}
                    busy={busyItemId === item.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Today's Section */}
          {todayItems.length > 0 && (
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section__head">
                <h2 className="t-h2">Due Today ({todayItems.length})</h2>
              </div>
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {todayItems.map((item) => (
                  <ExecutionItemCard
                    key={item.id}
                    item={item}
                    isCompletedOverride={item.type === 'habit' ? todayCompletedIds.includes(item.id) : undefined}
                    onToggleStatus={handleToggleStatus}
                    onUpdateCount={handleUpdateCount}
                    onStepCount={handleStepCount}
                    onEdit={(item) => setEditingItem(item)}
                    busy={busyItemId === item.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* General Queue / Anytime */}
          {anytimeItems.length > 0 && (
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section__head">
                <h2 className="t-h2">Action Queue ({anytimeItems.length})</h2>
              </div>
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {anytimeItems.map((item) => (
                  <ExecutionItemCard
                    key={item.id}
                    item={item}
                    isCompletedOverride={item.type === 'habit' ? todayCompletedIds.includes(item.id) : undefined}
                    onToggleStatus={handleToggleStatus}
                    onUpdateCount={handleUpdateCount}
                    onStepCount={handleStepCount}
                    onEdit={(item) => setEditingItem(item)}
                    busy={busyItemId === item.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming Section */}
          {upcomingItems.length > 0 && (
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section__head">
                <h2 className="t-h2">
                  <Clock size={16} /> Upcoming ({upcomingItems.length})
                </h2>
              </div>
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {upcomingItems.map((item) => (
                  <ExecutionItemCard
                    key={item.id}
                    item={item}
                    isCompletedOverride={item.type === 'habit' ? todayCompletedIds.includes(item.id) : undefined}
                    onToggleStatus={handleToggleStatus}
                    onUpdateCount={handleUpdateCount}
                    onStepCount={handleStepCount}
                    onEdit={(item) => setEditingItem(item)}
                    busy={busyItemId === item.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Completed Section */}
          {completed.length > 0 && (
            <section className="section" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-5)' }}>
              <div className="section__head">
                <h2 className="t-h2" style={{ color: 'var(--text-secondary)' }}>
                  Completed Items ({completed.length})
                </h2>
              </div>
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {completed.map((item) => (
                  <ExecutionItemCard
                    key={item.id}
                    item={item}
                    isCompletedOverride={item.type === 'habit' ? todayCompletedIds.includes(item.id) : undefined}
                    onToggleStatus={handleToggleStatus}
                    onUpdateCount={handleUpdateCount}
                    onStepCount={handleStepCount}
                    onEdit={(item) => setEditingItem(item)}
                    busy={busyItemId === item.id}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Edit Item Modal */}
      <EditItemModal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        onSubmit={handleSaveEditItem}
      />
    </div>
  )
}

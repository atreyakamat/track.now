import { useEffect, useState } from 'react'
import { CheckCircle2, Clock } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  listTodayExecutionItems,
  toggleItemStatus,
} from '@/services/executionService'
import { isDueToday, isOverdue, isUpcoming } from '@/domain/dates'
import type { ExecutionItem } from '@/types/domain'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { ExecutionItemCard } from '@/components/execution/ExecutionItemCard'

export function TodayPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const allItems = await listTodayExecutionItems()
      setItems(allItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load today items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggleStatus = async (itemId: string, currentStatus: ExecutionItem['status']) => {
    try {
      setBusyItemId(itemId)
      const updated = await toggleItemStatus(itemId, currentStatus, user?.id)
      setItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)))
    } catch (err) {
      console.error('Failed to toggle status:', err)
    } finally {
      setBusyItemId(null)
    }
  }

  if (loading) return <LoadingState label="Preparing today's queue…" />
  if (error) return <ErrorState message={error} onRetry={loadData} />

  // Partition items into Overdue, Today, Upcoming, and Completed
  const uncompleted = items.filter((i) => i.status !== 'done' && i.status !== 'archived')
  const completed = items.filter((i) => i.status === 'done')

  const overdueItems = uncompleted.filter((i) => isOverdue(i.due_date))
  const todayItems = uncompleted.filter((i) => isDueToday(i.due_date))
  const upcomingItems = uncompleted.filter((i) => isUpcoming(i.due_date))
  const anytimeItems = uncompleted.filter((i) => !i.due_date)

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
                    onToggleStatus={handleToggleStatus}
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
                    onToggleStatus={handleToggleStatus}
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
                    onToggleStatus={handleToggleStatus}
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
                    onToggleStatus={handleToggleStatus}
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
                    onToggleStatus={handleToggleStatus}
                    busy={busyItemId === item.id}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  listCompletionsForDate,
  listCompletionsForItems,
  listTodayExecutionItems,
} from '@/services/executionService'
import { getTodayDateString } from '@/domain/dates'
import { groupTodayItems } from '@/domain/today'
import type { ExecutionItem } from '@/types/domain'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { ExecutionItemCard } from '@/components/execution/ExecutionItemCard'
import { EditItemModal } from '@/components/execution/EditItemModal'
import { reconcileRemindersWithActiveItems } from '@/services/reminderService'
import { buildWidgetDataPayload, saveWidgetData } from '@/services/widgetDataService'
import { useExecutionItemActions } from '@/hooks/useExecutionItemActions'
import { addDays } from '@/domain/streaks'

export function TodayPage() {
  const { user } = useAuth()
  const userId = user?.id
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<ExecutionItem | null>(null)
  const [loadedDate, setLoadedDate] = useState(getTodayDateString())
  const requestRef = useRef(0)

  const persistWidget = useCallback(
    (list: ExecutionItem[], completedTodayIds: string[]) => {
      if (!userId) return
      buildWidgetDataPayload(userId, list, { completedTodayIds })
        .then(saveWidgetData)
        .catch(() => undefined)
    },
    [userId],
  )

  const actionsRef = useRef<ReturnType<typeof useExecutionItemActions> | null>(null)

  const loadData = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!userId) return
      const requestId = ++requestRef.current
      try {
        if (!opts.silent) setLoading(true)
        setError(null)
        const today = getTodayDateString()
        const [allItems, todayIds] = await Promise.all([
          listTodayExecutionItems(),
          listCompletionsForDate(userId, today),
        ])
        const habitIds = allItems.filter((i) => i.type === 'habit').map((h) => h.id)
        // Streaks only need roughly the last year of history.
        const history = habitIds.length ? await listCompletionsForItems(habitIds, addDays(today, -400)) : {}
        if (requestId !== requestRef.current) return

        setItems(allItems)
        actionsRef.current?.setCompletionState(todayIds, history)
        setLoadedDate(today)
        // Reminders for items that were deleted elsewhere or whose plan/track is archived.
        reconcileRemindersWithActiveItems(userId, allItems.map((i) => i.id))
        persistWidget(allItems, todayIds)
      } catch (err) {
        if (requestId !== requestRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load today’s items.')
      } finally {
        if (requestId === requestRef.current) setLoading(false)
      }
    },
    [userId, persistWidget],
  )

  const actions = useExecutionItemActions({
    userId,
    items,
    setItems,
    reload: () => loadData({ silent: true }),
    onChanged: ({ items: list, completedTodayIds }) => persistWidget(list, completedTodayIds),
  })
  actionsRef.current = actions

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Midnight rollover: if the page stays open past midnight, reload so habits reset.
  useEffect(() => {
    const check = () => {
      if (getTodayDateString() !== loadedDate) void loadData({ silent: true })
    }
    const id = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [loadedDate, loadData])

  if (loading) return <LoadingState label="Preparing today’s queue…" />
  if (error) return <ErrorState message={error} onRetry={() => void loadData()} />

  const groups = groupTodayItems(items, actions.completedTodayIds)
  const totalOpen = groups.overdue.length + groups.dueToday.length + groups.anytime.length
  const byId = new Map(items.map((i) => [i.id, i]))

  const renderCard = (item: ExecutionItem) => (
    <ExecutionItemCard
      key={item.id}
      item={item}
      isCompletedOverride={item.type === 'habit' ? actions.completedTodayIds.has(item.id) : undefined}
      streakSummary={item.type === 'habit' ? actions.streakSummaries[item.id] : undefined}
      onToggleStatus={(id) => {
        const it = byId.get(id)
        if (it) void actions.toggle(it)
      }}
      onUpdateCount={(id, n) => {
        const it = byId.get(id)
        if (it) void actions.setCount(it, n)
      }}
      onStepCount={(id, delta) => {
        const it = byId.get(id)
        if (it) void actions.step(it, delta)
      }}
      onEdit={(it) => setEditingItem(it)}
      onSnoozeReminder={actions.snooze}
      onRemoveReminder={actions.removeReminder}
      busy={actions.busyIds.has(item.id)}
    />
  )

  const section = (title: string, list: ExecutionItem[], opts: { danger?: boolean; icon?: boolean; muted?: boolean } = {}) =>
    list.length > 0 && (
      <section
        className="section"
        style={opts.muted ? { borderTop: '1px solid var(--border)', paddingTop: 'var(--space-5)', marginTop: 0 } : { marginTop: 0 }}
        aria-label={`${title} (${list.length})`}
      >
        <div className="section__head">
          <h2
            className="t-h2"
            style={opts.danger ? { color: 'var(--danger)' } : opts.muted ? { color: 'var(--text-secondary)' } : undefined}
          >
            {opts.icon && <Clock size={16} aria-hidden="true" />} {title} ({list.length})
          </h2>
        </div>
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {list.map(renderCard)}
        </div>
      </section>
    )

  const nothingAtAll = items.filter((i) => i.status !== 'archived').length === 0

  return (
    <div>
      <PageHeader
        title="Today"
        description="What needs to happen today across your active Tracks and Plans."
      />

      {nothingAtAll ? (
        <EmptyState
          icon={<CheckCircle2 size={24} />}
          title="No execution items yet"
          description="Create a Plan inside one of your Tracks and add habits or tasks to see them here."
        />
      ) : (
        <div className="stack" style={{ gap: 'var(--space-6)' }}>
          {totalOpen === 0 && (
            <div className="alert alert--success" role="status">
              {groups.completedToday.length > 0
                ? 'All caught up for today. Completed items are listed below if you need to undo one.'
                : 'Nothing is due today.'}
            </div>
          )}
          {section('Overdue', groups.overdue, { danger: true })}
          {section('Due Today', groups.dueToday)}
          {section('Anytime', groups.anytime)}
          {section('Upcoming', groups.upcoming, { icon: true })}
          {section('Completed Today', groups.completedToday, { muted: true })}
        </div>
      )}

      <EditItemModal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        onSubmit={actions.saveEdit}
        completedToday={editingItem ? actions.completedTodayIds.has(editingItem.id) : false}
      />
    </div>
  )
}

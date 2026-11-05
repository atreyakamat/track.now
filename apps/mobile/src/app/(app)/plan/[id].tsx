import { Feather } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  listCompletionsForDate,
  listCompletionsForItems,
  listExecutionItems,
} from '@tracknow/core/services/executionService'
import { getPlan } from '@tracknow/core/services/plansService'
import { deletePlanWithCleanup, setPlanArchivedWithCleanup } from '@tracknow/core/services/trackLifecycle'
import { calcProgress } from '@tracknow/core/domain/progress'
import { formatDateRange, pluralize } from '@tracknow/core/utils/format'
import type { ExecutionItem, Plan } from '@tracknow/core/types/domain'
import { AppBar } from '@/components/AppBar'
import { ExecutionItemCard } from '@/components/execution/ExecutionItemCard'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  ProgressBar,
  Text,
} from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { useExecutionItemActions } from '@/hooks/useExecutionItemActions'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

const RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { colors } = useTheme()
  const router = useRouter()

  const [plan, setPlan] = useState<Plan | null>(null)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<ExecutionItem | null>(null)
  const requestRef = useRef(0)

  const valid = typeof id === 'string' && RECORD_ID_RE.test(id)

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const reqId = ++requestRef.current
      if (!opts.silent) setLoading(true)
      else setRefreshing(true)
      setError(null)
      if (!valid) {
        setNotFound(true)
        setLoading(false)
        return
      }
      try {
        const [fetchedPlan, planItems, completedToday] = await Promise.all([
          getPlan(id),
          listExecutionItems(id),
          user ? listCompletionsForDate(user.id) : Promise.resolve([] as string[]),
        ])
        if (reqId !== requestRef.current) return
        if (!fetchedPlan) {
          setNotFound(true)
          setPlan(null)
          setItems([])
          return
        }
        const datesByItem = await listCompletionsForItems(planItems.map((i) => i.id))
        if (reqId !== requestRef.current) return
        setNotFound(false)
        setPlan(fetchedPlan)
        setItems(planItems)
        actions.setCompletionState(completedToday, datesByItem)
      } catch (err) {
        if (reqId !== requestRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load plan')
      } finally {
        if (reqId === requestRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, user?.id, valid],
  )

  const actions = useExecutionItemActions({
    userId: user?.id,
    items,
    setItems,
    reload: async () => {
      await load({ silent: true })
    },
  })

  useEffect(() => {
    void load()
    return () => {
      requestRef.current += 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  const header = (title?: string, right?: React.ReactNode) => (
    <View style={{ paddingHorizontal: spacing[4] }}>
      <AppBar title={title} right={right} />
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header()}
        <LoadingState label="Loading plan…" />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header()}
        <View style={{ padding: spacing[4] }}>
          <ErrorState description={error} onRetry={() => load()} />
        </View>
      </SafeAreaView>
    )
  }

  if (notFound || !plan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header()}
        <View style={{ padding: spacing[4] }}>
          <EmptyState
            icon={<Feather name="search" size={22} color={colors.textSecondary} />}
            title="Plan not found"
            description="It may have been deleted, or it belongs to another account."
            action={{ label: 'Go back', onPress: () => router.back() }}
          />
        </View>
      </SafeAreaView>
    )
  }

  const activeItems = items.filter((i) => i.status !== 'archived')
  const progressItems = activeItems.map((i) => ({
    id: i.id,
    type: i.type,
    status: i.status,
    schedule: i.schedule ? { frequency: i.schedule.frequency, days_of_week: i.schedule.days_of_week } : null,
  }))
  const progress = calcProgress(progressItems, { completedTodayIds: actions.completedTodayIds })
  const dateRange = formatDateRange(plan.start_date, plan.end_date)
  const isArchived = plan.status === 'archived'

  const completed = activeItems.filter((i) => actions.isCompletedToday(i) || i.status === 'done')
  const open = activeItems.filter((i) => !completed.includes(i))

  const renderCard = (item: ExecutionItem) => (
    <ExecutionItemCard
      key={item.id}
      item={item}
      busy={actions.busyIds.has(item.id)}
      isCompletedOverride={item.type === 'habit' ? actions.isCompletedToday(item) : undefined}
      streakSummary={actions.streakSummaries[item.id] ?? null}
      onToggle={actions.toggle}
      onStep={actions.step}
      onEdit={(it) => router.push(`/item/${it.id}/edit`)}
      onDelete={(it) => setItemToDelete(it)}
      onSnooze={actions.snooze}
      onRemoveReminder={actions.removeReminder}
    />
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {header(
        plan.name,
        <Pressable
          onPress={() => router.push(`/plan/${plan.id}/edit`)}
          hitSlop={8}
          accessibilityLabel="Edit plan"
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="edit-2" size={18} color={colors.textPrimary} />
        </Pressable>,
      )}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[7], gap: spacing[4] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ silent: true })} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
            <Text variant="h2" style={{ flexShrink: 1 }} numberOfLines={2}>
              {plan.name}
            </Text>
            {isArchived ? <Badge label="Archived" /> : null}
          </View>
          {plan.description ? (
            <Text variant="caption" tone="secondary">
              {plan.description}
            </Text>
          ) : null}
          {dateRange ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="calendar" size={12} color={colors.textTertiary} />
              <Text variant="meta" tone="tertiary">
                {dateRange}
              </Text>
            </View>
          ) : null}
          <ProgressBar value={progress.percent} />
          <Text variant="caption" tone="secondary">
            {progress.done}/{progress.total} done today · {pluralize(activeItems.length, 'item')}
          </Text>
        </View>

        <Button
          title="Add item"
          block
          icon={<Feather name="plus" size={16} color={colors.controlText} />}
          onPress={() => router.push(`/item/new?planId=${plan.id}${plan.track_id ? `&trackId=${plan.track_id}` : ''}`)}
        />

        {activeItems.length === 0 ? (
          <EmptyState
            icon={<Feather name="check-square" size={22} color={colors.textSecondary} />}
            title="No items yet"
            description="Add habits, tasks, checklists, milestones or projects to this plan."
          />
        ) : (
          <View style={{ gap: spacing[4] }}>
            {open.length > 0 ? (
              <View style={{ gap: spacing[2] }}>
                <Text variant="meta" tone="tertiary">
                  To do ({open.length})
                </Text>
                {open.map(renderCard)}
              </View>
            ) : null}
            {completed.length > 0 ? (
              <View style={{ gap: spacing[2] }}>
                <Text variant="meta" tone="tertiary">
                  Done ({completed.length})
                </Text>
                {completed.map(renderCard)}
              </View>
            ) : null}
          </View>
        )}

        <View style={{ gap: spacing[2], marginTop: spacing[3] }}>
          <Button
            title={isArchived ? 'Restore plan' : 'Archive plan'}
            variant="ghost"
            block
            loading={archiveBusy}
            onPress={async () => {
              if (archiveBusy) return
              setArchiveBusy(true)
              try {
                await setPlanArchivedWithCleanup(user?.id, plan.id, !isArchived)
                await load({ silent: true })
              } catch (err) {
                showToast({
                  title: isArchived ? 'Could not restore plan' : 'Could not archive plan',
                  message: err instanceof Error ? err.message : 'Please try again.',
                  type: 'warning',
                })
              } finally {
                setArchiveBusy(false)
              }
            }}
          />
          <Pressable onPress={() => setConfirmDelete(true)} style={{ alignItems: 'center', paddingVertical: spacing[3] }}>
            <Text variant="caption" tone="danger" weight="medium">
              Delete plan
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this plan?"
        message="This permanently removes the plan and all its items. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false)
          try {
            await deletePlanWithCleanup(user?.id, plan.id)
            router.back()
          } catch (err) {
            showToast({
              title: 'Could not delete plan',
              message: err instanceof Error ? err.message : 'Please try again.',
              type: 'warning',
            })
          }
        }}
      />

      <ConfirmDialog
        visible={itemToDelete !== null}
        title={itemToDelete ? `Delete "${itemToDelete.name}"?` : 'Delete item?'}
        message="This removes the item and its completion history. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setItemToDelete(null)}
        onConfirm={async () => {
          const target = itemToDelete
          setItemToDelete(null)
          if (target) await actions.remove(target)
        }}
      />
    </SafeAreaView>
  )
}

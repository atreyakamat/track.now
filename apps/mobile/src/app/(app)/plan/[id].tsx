import { Feather } from '@expo/vector-icons'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listCompletionsForDate, listCompletionsForItems, listExecutionItems } from '@tracknow/core/services/executionService'
import { getPlan, reopenPlan, setPlanStatus } from '@tracknow/core/services/plansService'
import { deletePlanWithCleanup, setPlanArchivedWithCleanup } from '@tracknow/core/services/trackLifecycle'
import { calcProgress } from '@tracknow/core/domain/progress'
import { PLAN_KIND_LABEL, PLAN_STATUS_LABEL, isDueForReview, planKindOf, planTimeline } from '@tracknow/core/domain/plans'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { addDays } from '@tracknow/core/domain/streaks'
import { weeklyTargetStatus } from '@tracknow/core/domain/schedule'
import { arcKey } from '@tracknow/core/domain/arcs'
import { formatDateRange, pluralize } from '@tracknow/core/utils/format'
import type { ExecutionItem, Plan, PlanStatus } from '@tracknow/core/types/domain'
import { AppBar } from '@/components/AppBar'
import { ExecutionItemCard } from '@/components/execution/ExecutionItemCard'
import { arcPath } from '@/components/plans/ArcCard'
import { SharePlanCard } from '@/components/plans/SharePlanCard'
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, ListSkeleton, ProgressBar, Text } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/features/notifications/ToastContext'
import { useExecutionItemActions } from '@/hooks/useExecutionItemActions'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

const RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { colors } = useTheme()
  const router = useRouter()

  const [plan, setPlan] = useState<Plan | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [completedTodayIds, setCompletedTodayIds] = useState<string[]>([])
  const requestRef = useRef(0)
  const hasDataRef = useRef(false)

  const valid = typeof id === 'string' && RECORD_ID_RE.test(id)

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const reqId = ++requestRef.current
      const snapshot = actions.snapshotToken()
      if (!opts.silent) setLoading(true)
      else setRefreshing(true)
      setError(null)
      if (!valid) {
        setNotFound(true)
        setLoading(false)
        return
      }
      try {
        const today = getTodayDateString()
        const [fetchedPlan, planItems, completedToday] = await Promise.all([
          getPlan(id),
          listExecutionItems(id),
          user ? listCompletionsForDate(user.id, today) : Promise.resolve([] as string[]),
        ])
        if (reqId !== requestRef.current) return
        if (!fetchedPlan) {
          setNotFound(true)
          setPlan(null)
          setItems([])
          return
        }
        const since = fetchedPlan.start_date && fetchedPlan.start_date > addDays(today, -400) ? fetchedPlan.start_date : addDays(today, -400)
        const datesByItem = planItems.length ? await listCompletionsForItems(planItems.map((i) => i.id), since) : {}
        if (reqId !== requestRef.current) return
        setNotFound(false)
        setPlan(fetchedPlan)
        // Taps saved while this was loading are newer than this snapshot: keep them (the hook re-syncs).
        if (!actions.acceptSnapshot(snapshot)) return
        setItems(planItems)
        setCompletedTodayIds(completedToday)
        actions.setCompletionState(completedToday, datesByItem)
        hasDataRef.current = true
      } catch (err) {
        if (reqId !== requestRef.current) return
        const message = err instanceof Error ? err.message : 'Failed to load plan'
        // A failed background refresh must never blank a page the user is already looking at:
        // keep what is shown and say the refresh failed instead.
        if (opts.silent && hasDataRef.current) {
          showToast({ id: 'refresh-failed', title: 'Could not refresh', message: 'Showing the last loaded state.', type: 'warning' })
          return
        }
        setError(message)
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

  useFocusEffect(
    useCallback(() => {
      if (plan) void load({ silent: true })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  )

  const changeStatus = async (next: PlanStatus) => {
    if (!plan || statusBusy) return
    setStatusBusy(true)
    try {
      const updated = plan.status === 'completed' && next === 'active' ? await reopenPlan(plan.id) : await setPlanStatus(plan.id, next)
      setPlan(updated)
      showToast({ title: `Plan ${PLAN_STATUS_LABEL[next].toLowerCase()}`, type: 'info' })
    } catch (err) {
      showToast({ title: 'Could not update the plan', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
    } finally {
      setStatusBusy(false)
    }
  }

  const header = (title?: string, right?: React.ReactNode) => (
    <View style={{ paddingHorizontal: spacing[4] }}>
      <AppBar title={title} right={right} />
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header()}
        <ListSkeleton count={4} />
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
          <EmptyState icon={<Feather name="search" size={22} color={colors.textSecondary} />} title="Plan not found" description="It may have been deleted, or it belongs to another account." action={{ label: 'Go back', onPress: () => router.back() }} />
        </View>
      </SafeAreaView>
    )
  }

  const kind = planKindOf(plan)
  const timeline = planTimeline(plan)
  const dueForReview = isDueForReview(plan)
  const isArchived = plan.status === 'archived'
  const isCompleted = plan.status === 'completed'
  const isPaused = plan.status === 'paused'
  const activeItems = items.filter((i) => i.status !== 'archived')
  const progress = calcProgress(
    activeItems.map((i) => ({ id: i.id, type: i.type, status: i.status, schedule: i.schedule, start_date: i.start_date })),
    { completedTodayIds: actions.completedTodayIds },
  )
  const dateRange = formatDateRange(plan.start_date, plan.end_date)
  const today = getTodayDateString()
  const completedTodaySet = new Set(completedTodayIds)
  const milestones = activeItems.filter((i) => i.type === 'milestone')
  const habits = activeItems.filter((i) => i.type === 'habit')
  const oneOff = activeItems.filter((i) => i.type !== 'milestone' && i.type !== 'habit')
  const openTasks = oneOff.filter((i) => i.status !== 'done' || completedTodaySet.has(i.id) || actions.isCompletedToday(i))
  const doneTasks = oneOff.filter((i) => !openTasks.includes(i))

  const renderCard = (item: ExecutionItem) => {
    const weekly = item.type === 'habit' ? weeklyTargetStatus(item.schedule, actions.completionDates[item.id] ?? [], today) : null
    return (
      <ExecutionItemCard
        key={item.id}
        item={item}
        busy={actions.busyIds.has(item.id)}
        isCompletedOverride={item.type === 'habit' ? actions.isCompletedToday(item) : undefined}
        streakSummary={actions.streakSummaries[item.id] ?? null}
        weekDone={weekly?.done}
        onToggle={actions.toggle}
        onStep={actions.step}
        onToggleChecklistEntry={(it, entryId) => void actions.toggleChecklistEntry(it, entryId)}
        onEdit={(it) => router.push(`/item/${it.id}/edit`)}
        onOpenDetail={(it) => router.push(`/item/${it.id}`)}
        onDelete={(it) => actions.remove(it)}
        onSnooze={actions.snooze}
        onRemoveReminder={actions.removeReminder}
      />
    )
  }

  const group = (title: string, list: ExecutionItem[], muted = false) =>
    list.length > 0 ? (
      <View style={{ gap: spacing[2] }}>
        <Text variant="meta" tone="tertiary">
          {title} ({list.length})
        </Text>
        <View style={{ gap: spacing[2], opacity: muted ? 0.8 : 1 }}>{list.map(renderCard)}</View>
      </View>
    ) : null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {header(
        plan.name,
        <Pressable onPress={() => router.push(`/plan/${plan.id}/edit`)} hitSlop={8} accessibilityLabel="Edit plan" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
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
            <Badge label={PLAN_KIND_LABEL[kind]} />
            {plan.status !== 'active' ? <Badge label={PLAN_STATUS_LABEL[plan.status]} /> : null}
          </View>
          {plan.description ? (
            <Text variant="caption" tone="secondary">
              {plan.description}
            </Text>
          ) : null}
          {plan.arc_name?.trim() ? (
            <Pressable onPress={() => router.push(arcPath({ key: arcKey(plan.arc_name!) }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityRole="link">
              <Feather name="layers" size={12} color={colors.textSecondary} />
              <Text variant="caption" tone="secondary" style={{ textDecorationLine: 'underline' }}>
                Part of the Arc {plan.arc_name.trim()}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {dueForReview ? (
          <Card style={{ borderColor: colors.warning, gap: spacing[2] }}>
            <Text variant="caption">
              This {PLAN_KIND_LABEL[kind]} reached its end date ({fmtDay(plan.end_date!)}). Review how it went, then complete it or extend the date. Nothing has been closed for you.
            </Text>
            <Button title="Review & complete" size="sm" onPress={() => router.push(`/plan/${plan.id}/complete`)} />
          </Card>
        ) : null}
        {isPaused ? (
          <Card tone="muted">
            <Text variant="caption" tone="secondary">
              Paused: its items are not on Today. Resume whenever you are ready.
            </Text>
          </Card>
        ) : null}

        <Card style={{ gap: spacing[3] }}>
          {timeline ? (
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text variant="h3">
                  {timeline.phase === 'not_started' ? `Starts in ${timeline.startsInDays} ${timeline.startsInDays === 1 ? 'day' : 'days'}` : timeline.phase === 'ended' ? 'Arc ended' : `Day ${timeline.day} of ${timeline.totalDays}`}
                </Text>
                {dateRange ? (
                  <Text variant="meta" tone="tertiary">
                    {dateRange}
                  </Text>
                ) : null}
              </View>
              <ProgressBar value={timeline.elapsedPercent} showValue={false} />
            </View>
          ) : dateRange ? (
            <Text variant="meta" tone="tertiary">
              {dateRange}
            </Text>
          ) : null}
          <View style={{ gap: 4 }}>
            <Text variant="caption" tone="secondary">
              {progress.done}/{progress.total} done · {pluralize(activeItems.length, 'item')}
            </Text>
            <ProgressBar value={progress.percent} />
          </View>
          {plan.outcome || plan.success_criteria ? (
            <View style={{ gap: spacing[2], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing[2] }}>
              {plan.outcome ? (
                <View>
                  <Text variant="meta" tone="tertiary">
                    Desired outcome
                  </Text>
                  <Text variant="caption">{plan.outcome}</Text>
                </View>
              ) : null}
              {plan.success_criteria ? (
                <View>
                  <Text variant="meta" tone="tertiary">
                    Success criteria
                  </Text>
                  <Text variant="caption">{plan.success_criteria}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </Card>

        {isCompleted ? (
          <Card style={{ gap: spacing[2], borderColor: colors.success }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="award" size={16} color={colors.success} />
              <Text variant="h3">Completed{plan.completed_at ? ` · ${fmtDay(plan.completed_at.slice(0, 10))}` : ''}</Text>
            </View>
            {plan.result_notes ? <Text variant="caption">{plan.result_notes}</Text> : null}
            {plan.lessons_learned ? (
              <Text variant="caption" tone="secondary">
                Learned: {plan.lessons_learned}
              </Text>
            ) : null}
            {plan.next_decision ? (
              <Text variant="caption" tone="secondary">
                Next: {plan.next_decision}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap', marginTop: spacing[1] }}>
              {kind === 'time_bound' ? (
                <Button title="Start the next Arc" size="sm" onPress={() => router.push(`/plan/new?trackId=${plan.track_id}${plan.arc_name ? `&arc=${encodeURIComponent(plan.arc_name)}` : ''}`)} />
              ) : null}
              <Button title="Continue as ongoing" size="sm" variant="secondary" onPress={() => router.push(`/plan/new?trackId=${plan.track_id}&kind=ongoing`)} />
            </View>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
          {!isArchived && !isCompleted ? (
            <Button title="Add item" size="sm" icon={<Feather name="plus" size={14} color={colors.controlText} />} onPress={() => router.push(`/item/new?planId=${plan.id}${plan.track_id ? `&trackId=${plan.track_id}` : ''}`)} />
          ) : null}
          {plan.status === 'active' || isPaused ? (
            <Button title="Complete" size="sm" variant="secondary" icon={<Feather name="award" size={14} color={colors.textPrimary} />} onPress={() => router.push(`/plan/${plan.id}/complete`)} disabled={statusBusy} />
          ) : null}
          {plan.status === 'active' ? <Button title="Pause" size="sm" variant="ghost" onPress={() => void changeStatus('paused')} disabled={statusBusy} /> : null}
          {isPaused || isCompleted || plan.status === 'draft' ? (
            <Button title={isCompleted ? 'Re-open' : isPaused ? 'Resume' : 'Activate'} size="sm" variant="ghost" onPress={() => void changeStatus('active')} disabled={statusBusy} />
          ) : null}
        </View>

        {activeItems.length === 0 ? (
          <EmptyState icon={<Feather name="check-square" size={22} color={colors.textSecondary} />} title="No items yet" description="Add habits, tasks, checklists, milestones or projects to this plan." />
        ) : (
          <View style={{ gap: spacing[4] }}>
            {group('Milestones', milestones)}
            {group('Habits', habits)}
            {group('Tasks & checklists', openTasks)}
            {group('Completed', doneTasks, true)}
          </View>
        )}

        {user?.id && !isArchived ? <SharePlanCard userId={user.id} planId={plan.id} planName={plan.name} /> : null}

        <View style={{ gap: spacing[2], marginTop: spacing[3] }}>
          <Button
            title={isArchived ? 'Restore plan' : 'Archive plan'}
            variant="ghost"
            block
            loading={statusBusy}
            onPress={async () => {
              if (statusBusy) return
              setStatusBusy(true)
              try {
                await setPlanArchivedWithCleanup(user?.id, plan.id, !isArchived)
                await load({ silent: true })
              } catch (err) {
                showToast({ title: isArchived ? 'Could not restore plan' : 'Could not archive plan', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
              } finally {
                setStatusBusy(false)
              }
            }}
          />
          <Pressable onPress={() => setConfirmDelete(true)} style={{ alignItems: 'center', paddingVertical: spacing[3], borderRadius: radius.md }}>
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
            showToast({ title: 'Could not delete plan', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
          }
        }}
      />
    </SafeAreaView>
  )
}

import { Feather } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  listCompletionsForDate,
  listCompletionsForItems,
  listTodayExecutionItems,
} from '@tracknow/core/services/executionService'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { reconcileRemindersWithActiveItems } from '@tracknow/core/services/reminderService'
import { addDays } from '@tracknow/core/domain/streaks'
import { groupTodayItems } from '@tracknow/core/domain/today'
import { greeting } from '@tracknow/core/utils/format'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import { updateTodayWidget } from '@/widgets/update'
import { ExecutionItemCard } from '@/components/execution/ExecutionItemCard'
import { PageHeader } from '@/components/PageHeader'
import { Card, EmptyState, ErrorState, LoadingState, Text } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useExecutionItemActions } from '@/hooks/useExecutionItemActions'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

export default function TodayScreen() {
  const { user, displayName } = useAuth()
  const userId = user?.id
  const { colors } = useTheme()
  const router = useRouter()
  const [items, setItems] = useState<ExecutionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedDate, setLoadedDate] = useState(getTodayDateString())
  const requestRef = useRef(0)
  const actionsRef = useRef<ReturnType<typeof useExecutionItemActions> | null>(null)

  const loadData = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!userId) return
      const requestId = ++requestRef.current
      try {
        if (!opts.silent) setLoading(true)
        else setRefreshing(true)
        setError(null)
        const today = getTodayDateString()
        const [allItems, todayIds] = await Promise.all([
          listTodayExecutionItems(),
          listCompletionsForDate(userId, today),
        ])
        const habitIds = allItems.filter((i) => i.type === 'habit').map((h) => h.id)
        const history = habitIds.length ? await listCompletionsForItems(habitIds, addDays(today, -400)) : {}
        if (requestId !== requestRef.current) return
        setItems(allItems)
        actionsRef.current?.setCompletionState(todayIds, history)
        setLoadedDate(today)
        reconcileRemindersWithActiveItems(userId, allItems.map((i) => i.id))
        updateTodayWidget(allItems, new Set(todayIds))
      } catch (err) {
        if (requestId !== requestRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load today’s items.')
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [userId],
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

  // Reload when returning to the tab (e.g. after adding/editing an item elsewhere).
  useFocusEffect(
    useCallback(() => {
      if (getTodayDateString() !== loadedDate) void loadData({ silent: true })
      else void loadData({ silent: true })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadedDate]),
  )

  const renderCard = (item: ExecutionItem) => (
    <ExecutionItemCard
      key={item.id}
      item={item}
      busy={actions.busyIds.has(item.id)}
      isCompletedOverride={item.type === 'habit' ? actions.completedTodayIds.has(item.id) : undefined}
      streakSummary={item.type === 'habit' ? actions.streakSummaries[item.id] : undefined}
      onToggle={actions.toggle}
      onStep={actions.step}
      onEdit={(it) => router.push(`/item/${it.id}/edit`)}
      onSnooze={actions.snooze}
      onRemoveReminder={actions.removeReminder}
    />
  )

  const section = (title: string, list: ExecutionItem[], tone?: 'danger' | 'muted') =>
    list.length > 0 ? (
      <View style={{ gap: spacing[2] }}>
        <Text variant="meta" style={{ color: tone === 'danger' ? colors.danger : tone === 'muted' ? colors.textTertiary : colors.textSecondary }}>
          {title} ({list.length})
        </Text>
        {list.map(renderCard)}
      </View>
    ) : null

  const groups = groupTodayItems(items, actions.completedTodayIds)
  const totalOpen = groups.overdue.length + groups.dueToday.length + groups.anytime.length
  const nothingAtAll = items.filter((i) => i.status !== 'archived').length === 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[7] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData({ silent: true })} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Today" subtitle={`${greeting()}, ${displayName}.`} />

        {loading ? (
          <LoadingState label="Preparing today’s queue…" />
        ) : error ? (
          <ErrorState description={error} onRetry={() => loadData()} />
        ) : nothingAtAll ? (
          <EmptyState
            icon={<Feather name="check-circle" size={22} color={colors.textSecondary} />}
            title="No items yet"
            description="Create a plan inside one of your tracks and add habits or tasks to see them here."
            action={{ label: 'Go to tracks', onPress: () => router.push('/(app)/(tabs)/tracks') }}
          />
        ) : (
          <View style={{ gap: spacing[5] }}>
            {totalOpen === 0 ? (
              <Card style={{ borderColor: colors.success }}>
                <Text variant="caption" style={{ color: colors.success }}>
                  {groups.completedToday.length > 0
                    ? 'All caught up for today. Completed items are below if you need to undo one.'
                    : 'Nothing is due today.'}
                </Text>
              </Card>
            ) : null}
            {section('Overdue', groups.overdue, 'danger')}
            {section('Due today', groups.dueToday)}
            {section('Anytime', groups.anytime)}
            {section('Upcoming', groups.upcoming)}
            {section('Completed today', groups.completedToday, 'muted')}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

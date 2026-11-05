import { Feather } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getExecutionItem, listCompletionsForItems } from '@tracknow/core/services/executionService'
import { addDays, calcHabitStreak, generateHeatmapMatrix } from '@tracknow/core/domain/streaks'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { pluralize } from '@tracknow/core/utils/format'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import { AppBar } from '@/components/AppBar'
import { Badge, Card, EmptyState, LoadingState, Text } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

const WEEKS = 16

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={{ flex: 1, gap: 2, minWidth: 90 }}>
      <Text variant="meta" tone="tertiary">
        {label}
      </Text>
      <Text variant="display" style={{ fontSize: 24 }}>
        {value}
      </Text>
      {sub ? (
        <Text variant="meta" tone="tertiary">
          {sub}
        </Text>
      ) : null}
    </Card>
  )
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()

  const [item, setItem] = useState<ExecutionItem | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof id !== 'string') return
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const loaded = await getExecutionItem(id)
        if (!active) return
        setItem(loaded)
        if (loaded) {
          const byItem = await listCompletionsForItems([loaded.id], addDays(getTodayDateString(), -(WEEKS * 7 + 7)))
          if (active) setDates(byItem[loaded.id] ?? [])
        }
      } catch {
        if (active) setItem(null)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  const streak = useMemo(
    () => (item ? calcHabitStreak(item.id, item.schedule, dates) : null),
    [item, dates],
  )

  const matrix = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of dates) counts[d] = (counts[d] ?? 0) + 1
    return generateHeatmapMatrix(counts, new Date(), WEEKS, item?.schedule ?? null)
  }, [dates, item])

  const levelColor = (level: number): string =>
    level <= 0
      ? colors.surfaceMuted
      : level === 1
        ? colors.border
        : level === 2
          ? colors.accentSecondary
          : colors.accentPrimary

  const header = (title?: string, right?: React.ReactNode) => (
    <View style={{ paddingHorizontal: spacing[4] }}>
      <AppBar title={title} right={right} />
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header()}
        <LoadingState label="Loading history…" />
      </SafeAreaView>
    )
  }

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header()}
        <View style={{ padding: spacing[4] }}>
          <EmptyState
            icon={<Feather name="search" size={22} color={colors.textSecondary} />}
            title="Item not found"
            description="It may have been deleted, or it belongs to another account."
            action={{ label: 'Go back', onPress: () => router.back() }}
          />
        </View>
      </SafeAreaView>
    )
  }

  const isHabit = item.type === 'habit'
  const milestones = streak
    ? [
        { label: '7-day streak', earned: streak.longestStreak >= 7 },
        { label: '30-day streak', earned: streak.longestStreak >= 30 },
        { label: '50 completions', earned: streak.totalCompletions >= 50 },
        { label: '100 completions', earned: streak.totalCompletions >= 100 },
      ]
    : []

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {header(
        item.name,
        <Pressable
          onPress={() => router.push(`/item/${item.id}/edit`)}
          hitSlop={8}
          accessibilityLabel="Edit item"
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="edit-2" size={18} color={colors.textPrimary} />
        </Pressable>,
      )}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[7], gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
          <Text variant="h2" style={{ flexShrink: 1 }} numberOfLines={2}>
            {item.name}
          </Text>
          <Badge label={item.type} />
        </View>
        {item.description ? (
          <Text variant="caption" tone="secondary">
            {item.description}
          </Text>
        ) : null}

        {isHabit && streak ? (
          <>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              <Stat label="Current" value={`${streak.currentStreak}`} sub={streak.currentStreak === 1 ? 'day' : 'days'} />
              <Stat label="Longest" value={`${streak.longestStreak}`} sub="days" />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              <Stat label="Consistency" value={`${streak.consistencyRate}%`} sub={`last ${WEEKS} wks`} />
              <Stat label="Total" value={`${streak.totalCompletions}`} sub="completions" />
            </View>

            <Card style={{ gap: spacing[3] }}>
              <Text variant="h3">Completion calendar</Text>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {matrix.weeks.map((week) => (
                  <View key={week.weekIndex} style={{ gap: 3 }}>
                    {week.days.map((cell, di) => (
                      <View
                        key={cell?.date ?? `${week.weekIndex}-${di}`}
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: 2,
                          backgroundColor: !cell || cell.isFuture ? 'transparent' : levelColor(cell.level),
                          borderWidth: cell && !cell.isFuture && cell.isScheduled && cell.level === 0 ? 1 : 0,
                          borderColor: colors.borderStrong,
                        }}
                      />
                    ))}
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
                <Text variant="meta" tone="tertiary">
                  Less
                </Text>
                {[0, 1, 2, 4].map((l) => (
                  <View key={l} style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: levelColor(l) }} />
                ))}
                <Text variant="meta" tone="tertiary">
                  More
                </Text>
              </View>
            </Card>

            <View style={{ gap: spacing[2] }}>
              <Text variant="meta" tone="tertiary">
                Milestones
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                {milestones.map((m) => (
                  <View
                    key={m.label}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      borderRadius: radius.pill,
                      backgroundColor: m.earned ? colors.accentPrimary : colors.surfaceMuted,
                      opacity: m.earned ? 1 : 0.6,
                    }}
                  >
                    <Feather
                      name={m.earned ? 'award' : 'lock'}
                      size={13}
                      color={m.earned ? colors.accentPrimaryText : colors.textTertiary}
                    />
                    <Text
                      variant="meta"
                      weight="semibold"
                      style={{ color: m.earned ? colors.accentPrimaryText : colors.textTertiary }}
                    >
                      {m.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          <Card style={{ gap: spacing[2] }}>
            <Text variant="h3">Details</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" tone="secondary">
                Status
              </Text>
              <Text variant="caption" weight="medium" style={{ textTransform: 'capitalize' }}>
                {item.status}
              </Text>
            </View>
            {item.due_date ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" tone="secondary">
                  Due
                </Text>
                <Text variant="caption" weight="medium">
                  {item.due_date}
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" tone="secondary">
                Completions logged
              </Text>
              <Text variant="caption" weight="medium">
                {pluralize(dates.length, 'time')}
              </Text>
            </View>
            <Text variant="meta" tone="tertiary">
              Streak history and the completion calendar are available for habits.
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

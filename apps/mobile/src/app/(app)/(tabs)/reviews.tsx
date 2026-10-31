import { Feather } from '@expo/vector-icons'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listTracks } from '@tracknow/core/services/tracksService'
import { listPlans } from '@tracknow/core/services/plansService'
import { listExecutionItems } from '@tracknow/core/services/executionService'
import { listCompletionHistory } from '@tracknow/core/services/historyService'
import { loadReviewNote, saveReviewNote } from '@tracknow/core/services/reviewNotesStorage'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { addDays } from '@tracknow/core/domain/streaks'
import {
  buildReviewSummary,
  getMonthRange,
  getWeekRange,
  makePeriodKey,
  type ReviewKind,
} from '@tracknow/core/domain/reviews'
import { formatDateRangeLabel } from '@tracknow/core/domain/analytics'
import { pluralize } from '@tracknow/core/utils/format'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, LoadingState, ProgressBar, Segmented, Text, TextField } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAsync } from '@/hooks/useAsync'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

const PROMPTS: Record<ReviewKind, { id: string; label: string }[]> = {
  weekly: [
    { id: 'moved_forward', label: 'What moved forward this week?' },
    { id: 'friction', label: 'Where did friction show up?' },
    { id: 'differently', label: 'What will you do differently next week?' },
  ],
  monthly: [
    { id: 'progress', label: 'Which tracks made real progress this month?' },
    { id: 'stalled', label: 'What stalled, and why?' },
    { id: 'next_month', label: 'What deserves your focus next month?' },
  ],
}

export default function ReviewsScreen() {
  const { user } = useAuth()
  const { colors } = useTheme()
  const [tab, setTab] = useState<ReviewKind>('weekly')
  const [offset, setOffset] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const now = useMemo(() => new Date(), [])
  const range = useMemo(
    () => (tab === 'weekly' ? getWeekRange(now, offset) : getMonthRange(now, offset)),
    [tab, offset, now],
  )
  const periodKey = makePeriodKey(tab, range)

  const { data, loading, error, reload, refreshing } = useAsync(async () => {
    if (!user) return null
    const today = getTodayDateString()
    const [tracks, plans, items, completions] = await Promise.all([
      listTracks(),
      listPlans(),
      listExecutionItems(),
      listCompletionHistory(user.id, addDays(today, -400), today),
    ])
    return { tracks, plans, items, completions }
  }, [user?.id])

  const summary = useMemo(
    () =>
      data
        ? buildReviewSummary({
            tracks: data.tracks,
            plans: data.plans,
            items: data.items,
            completions: data.completions,
            range,
            now,
          })
        : null,
    [data, range, now],
  )

  // Load the saved note whenever the period changes.
  useEffect(() => {
    if (!user) return
    const note = loadReviewNote(user.id, periodKey)
    setAnswers(note?.answers ?? {})
    setSavedAt(note?.updatedAt ?? null)
  }, [user?.id, periodKey])

  const save = () => {
    if (!user) return
    const ok = saveReviewNote(user.id, { periodKey, kind: tab, answers, priorities: [] })
    if (ok) setSavedAt(new Date().toISOString())
  }

  const prompts = PROMPTS[tab]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[7] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Reviews" subtitle="Reflect on what you shipped." />

        <View style={{ gap: spacing[4] }}>
          <Segmented
            value={tab}
            onChange={(t) => {
              setTab(t)
              setOffset(0)
            }}
            options={[
              { key: 'weekly', label: 'Weekly review' },
              { key: 'monthly', label: 'Monthly reflection' },
            ]}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={8} style={{ padding: spacing[2] }}>
              <Feather name="chevron-left" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text variant="caption" weight="semibold">
              {formatDateRangeLabel(range)}
            </Text>
            <Pressable
              onPress={() => setOffset((o) => Math.min(0, o + 1))}
              hitSlop={8}
              disabled={offset >= 0}
              style={{ padding: spacing[2], opacity: offset >= 0 ? 0.3 : 1 }}
            >
              <Feather name="chevron-right" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          {loading ? (
            <LoadingState label="Building your review…" />
          ) : error ? (
            <Card style={{ borderColor: colors.danger }}>
              <Text variant="caption" tone="danger">
                {error}
              </Text>
            </Card>
          ) : summary ? (
            <>
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <Card style={{ flex: 1, gap: 2 }}>
                  <Text variant="meta" tone="tertiary">
                    Completions
                  </Text>
                  <Text variant="display" style={{ fontSize: 28 }}>
                    {summary.totalCompletions}
                  </Text>
                </Card>
                <Card style={{ flex: 1, gap: 2 }}>
                  <Text variant="meta" tone="tertiary">
                    Wins
                  </Text>
                  <Text variant="display" style={{ fontSize: 28 }}>
                    {summary.wins.length}
                  </Text>
                </Card>
              </View>

              {summary.habits.rate !== null ? (
                <Card style={{ gap: spacing[2] }}>
                  <Text variant="h3">Habit consistency</Text>
                  <ProgressBar value={summary.habits.rate} />
                  <Text variant="meta" tone="secondary">
                    {summary.habits.completed}/{summary.habits.expected} scheduled habit days
                  </Text>
                </Card>
              ) : null}

              {summary.wins.length > 0 ? (
                <Card style={{ gap: spacing[2] }}>
                  <Text variant="h3">Wins</Text>
                  {summary.wins.slice(0, 8).map((w) => (
                    <View key={w.item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] }}>
                      <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                        {w.item.name}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {w.completedDate.slice(5)}
                      </Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              {summary.planArchiveCandidates.length > 0 ? (
                <Card style={{ gap: spacing[2] }}>
                  <Text variant="h3">Ready to archive</Text>
                  {summary.planArchiveCandidates.map((c) => (
                    <View key={c.plan.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] }}>
                      <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                        {c.plan.name}
                      </Text>
                      <Text variant="meta" tone="secondary">
                        {c.reason === 'ended' ? 'Ended' : 'Complete'}
                      </Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              <Card style={{ gap: spacing[4] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="h3">Notes</Text>
                  {savedAt ? (
                    <Text variant="meta" tone="tertiary">
                      Saved
                    </Text>
                  ) : null}
                </View>
                {prompts.map((prompt) => (
                  <TextField
                    key={prompt.id}
                    label={prompt.label}
                    value={answers[prompt.id] ?? ''}
                    onChangeText={(v) => setAnswers((prev) => ({ ...prev, [prompt.id]: v }))}
                    placeholder="Your reflection…"
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 72, textAlignVertical: 'top' }}
                  />
                ))}
                <Button title="Save notes" block onPress={save} />
                <Text variant="meta" tone="tertiary">
                  Notes are stored on this device only.
                </Text>
              </Card>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

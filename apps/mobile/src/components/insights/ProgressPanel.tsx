import { Feather } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import type { ExecutionItem, Plan } from '@tracknow/core/types/domain'
import type { CompletionRecord } from '@tracknow/core/services/historyService'
import {
  DAILY_ONE_OFF_CAP,
  PLAN_COMPLETION_XP,
  XP_PER_TYPE,
  calcAchievements,
  calcMomentum,
  computeXp,
  levelFor,
} from '@tracknow/core/domain/momentum'
import { calcHabitStreak } from '@tracknow/core/domain/streaks'
import { habitTrackedSince } from '@tracknow/core/domain/schedule'
import { calcQuests, questXp } from '@tracknow/core/domain/quests'
import { onboardingState } from '@tracknow/core/services/onboardingState'
import { Card, ProgressBar, Text } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

/**
 * Level, XP, Momentum and achievements — all derived from the user's real completion records
 * (the lifetime ledger: item id + date only) plus the getting-started quests' one-time bonus.
 */
export function ProgressPanel({ userId, items, plans, tracks, ledger }: { userId: string; items: ExecutionItem[]; plans: Plan[]; tracks: number; ledger: CompletionRecord[] }) {
  const { colors } = useTheme()
  const [rulesOpen, setRulesOpen] = useState(false)

  const derived = useMemo(() => {
    const planOf = new Map(items.map((i) => [i.id, i.plan_id]))
    const perPlan: Record<string, number> = {}
    ledger.forEach((c) => {
      const p = planOf.get(c.item_id)
      if (p) perPlan[p] = (perPlan[p] ?? 0) + 1
    })
    const completedPlans = plans.filter((p) => p.status === 'completed')
    const xp = computeXp(ledger, items, completedPlans, perPlan)
    const tourDone = onboardingState.tourDone(userId)
    const quests = calcQuests({
      tracks,
      plans: plans.length,
      items: items.filter((i) => i.status !== 'archived').length,
      arcPlans: plans.filter((p) => p.arc_name?.trim()).length,
      completions: ledger,
      tourDone,
      focusUsed: onboardingState.focusUsed(userId),
    })
    const bonus = questXp(quests)
    const level = levelFor(xp.total + bonus)
    const momentum = calcMomentum(items, ledger)
    const datesByItem = new Map<string, string[]>()
    ledger.forEach((c) => datesByItem.set(c.item_id, [...(datesByItem.get(c.item_id) ?? []), c.completed_date]))
    const longestDailyStreak = items
      .filter((i) => i.type === 'habit' && !i.schedule?.times_per_week)
      .reduce((best, h) => Math.max(best, calcHabitStreak(h.id, h.schedule, datesByItem.get(h.id) ?? [], undefined, 365, habitTrackedSince(h)).longestStreak), 0)
    const achievements = calcAchievements({
      completions: ledger,
      items,
      plans,
      longestDailyStreak,
      extras: { tourCompleted: tourDone },
      habits: items.filter((i) => i.type === 'habit'),
    })
    return { xp, level, momentum, achievements, bonus }
  }, [ledger, items, plans, tracks, userId])

  const earned = derived.achievements.filter((a) => a.earned).length

  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="h2">Your progress</Text>
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <Card style={{ flex: 1, gap: 4 }}>
          <Text variant="meta" tone="tertiary">
            Level {derived.level.level}
          </Text>
          <Text variant="h3" numberOfLines={2}>
            {derived.level.name}
          </Text>
          <ProgressBar value={derived.level.progress} showValue={false} />
          <Text variant="meta" tone="secondary" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {derived.level.xp} XP · {derived.level.nextLevelXp - derived.level.xp} to Lv {derived.level.level + 1}
          </Text>
        </Card>
        <Card style={{ flex: 1, gap: 4 }}>
          <Text variant="meta" tone="tertiary">
            Momentum (14d)
          </Text>
          <Text variant="h3">
            {derived.momentum.score} <Text variant="caption" tone="secondary">{derived.momentum.label}</Text>
          </Text>
          <ProgressBar value={derived.momentum.score} showValue={false} />
          <Text variant="meta" tone="secondary" style={{ textTransform: 'none', letterSpacing: 0 }} numberOfLines={3}>
            {derived.momentum.explanation}
          </Text>
        </Card>
      </View>

      <Card style={{ gap: spacing[2] }}>
        <Text variant="h3">
          Achievements ({earned}/{derived.achievements.length})
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
          {derived.achievements.map((a) => (
            <View
              key={a.id}
              style={{
                width: '48%',
                flexDirection: 'row',
                gap: spacing[2],
                padding: spacing[2],
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                opacity: a.earned ? 1 : 0.55,
              }}
              accessibilityLabel={`${a.title}${a.earned ? ' (earned)' : ' (not yet earned)'}`}
            >
              <Feather name={a.earned ? 'award' : 'lock'} size={16} color={a.earned ? colors.accentPrimary : colors.textTertiary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" weight="semibold">
                  {a.title}
                </Text>
                <Text variant="meta" tone="secondary" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  {a.description}
                  {a.earnedOn ? ` · ${new Date(`${a.earnedOn}T00:00:00`).toLocaleDateString()}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Pressable onPress={() => setRulesOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: rulesOpen }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name={rulesOpen ? 'chevron-down' : 'chevron-right'} size={14} color={colors.textSecondary} />
          <Text variant="caption" tone="secondary">
            How points work
          </Text>
        </View>
      </Pressable>
      {rulesOpen ? (
        <Card tone="muted" style={{ gap: 4 }}>
          {[
            `Habit session ${XP_PER_TYPE.habit} XP · task or checklist ${XP_PER_TYPE.task} XP · project ${XP_PER_TYPE.project} XP · milestone ${XP_PER_TYPE.milestone} XP · completed Plan ${PLAN_COMPLETION_XP} XP.`,
            'Points come only from completions. Un-completing something removes its points.',
            `At most ${DAILY_ONE_OFF_CAP} tasks a day earn points, and weekly-target habits earn up to their target, so splitting work into tiny pieces earns nothing extra.`,
            'Creating, editing or opening things never earns points. Missing a day never takes points away.',
            ...(derived.bonus > 0 ? [`${derived.bonus} XP is a one-time starter bonus from the getting-started quests.`] : []),
            ...(derived.xp.capped > 0 ? [`${derived.xp.capped} completions were above a cap and earned no points.`] : []),
          ].map((line) => (
            <Text key={line} variant="caption" tone="secondary">
              • {line}
            </Text>
          ))}
        </Card>
      ) : null}
    </View>
  )
}

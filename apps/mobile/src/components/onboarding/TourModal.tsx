import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import { QUEST_XP } from '@tracknow/core/domain/quests'
import { Button, Text } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

type Icon = React.ComponentProps<typeof Feather>['name']

const STEPS: { icon: Icon; title: string; body: string }[] = [
  {
    icon: 'layers',
    title: 'One place for your whole life',
    body: 'Tracks are the areas you care about: Health, Work, Money, Home… Each Track holds Plans; each Plan holds the habits, tasks, checklists and milestones you actually do.',
  },
  {
    icon: 'target',
    title: 'Arcs: 30, 60 or 90 days with a purpose',
    body: 'A Plan with an end date is an Arc. Give Arcs from different Tracks the same name — “Winter Arc 2026” — and they show up together with Day X of N, progress and retention.',
  },
  {
    icon: 'check-circle',
    title: 'Today is home',
    body: 'Everything due across all Tracks lands on Today. Star up to three items as your Focus. Habits on their days, “3× a week” habits whenever, and nothing before its start date.',
  },
  {
    icon: 'award',
    title: 'Points come only from doing',
    body: 'Completing a habit earns 10 XP, a task 15, a milestone 50. Un-complete it and the points vanish. Creating or editing earns nothing, and a missed day never costs you anything.',
  },
  {
    icon: 'bar-chart-2',
    title: 'Momentum, streaks and retention',
    body: 'Momentum is your last 14 days of habit adherence and active days. Insights shows whether you are keeping, slipping on or dropping each habit, week by week. Honest numbers, no shame.',
  },
  {
    icon: 'book-open',
    title: 'Review, then start the next Arc',
    body: 'When an Arc reaches its end date it is flagged for review, never closed for you. Write what happened, what you learned, what you decide next, and start the next Arc from there.',
  },
]

/** A short, gamified tour: six screens, a progress trail, Skip always available. */
export function TourModal({ visible, onClose, onFinish }: { visible: boolean; onClose: () => void; onFinish: () => void }) {
  const { colors } = useTheme()
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (visible) setStep(0)
  }, [visible])
  const last = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: spacing[4] }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 440,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing[5],
            gap: spacing[4],
          }}
        >
          <View
            style={{
              height: 120,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[2],
            }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentPrimary, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name={current.icon} size={26} color={colors.accentPrimaryText} />
            </View>
            <Text variant="meta" tone="tertiary">
              Step {step + 1} of {STEPS.length}
            </Text>
          </View>
          <View style={{ gap: spacing[2] }}>
            <Text variant="h2">{current.title}</Text>
            <Text variant="caption" tone="secondary" style={{ lineHeight: 20 }}>
              {current.body}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <View
                key={s.title}
                style={{
                  width: i === step ? 10 : 8,
                  height: i === step ? 10 : 8,
                  borderRadius: 5,
                  backgroundColor: i === step ? colors.controlBg : i < step ? colors.textSecondary : colors.borderStrong,
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], flexWrap: 'wrap' }}>
            <Button title="Skip" variant="ghost" size="sm" onPress={onClose} />
            {step > 0 ? <Button title="Back" variant="secondary" size="sm" onPress={() => setStep((s) => s - 1)} /> : null}
            <Button
              title={last ? `Finish · +${QUEST_XP} XP` : 'Next'}
              size="sm"
              icon={last ? <Feather name="star" size={14} color={colors.controlText} /> : undefined}
              onPress={() => (last ? onFinish() : setStep((s) => s + 1))}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

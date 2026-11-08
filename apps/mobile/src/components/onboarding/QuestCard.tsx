import { Feather } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import type { Quest } from '@tracknow/core/domain/quests'
import { questXp } from '@tracknow/core/domain/quests'
import { Button, Card, ProgressBar, Text } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { radius, spacing } from '@/theme/tokens'

/**
 * Getting-started quests. Every quest is checked against real records, so it ticks itself
 * off; nothing here is a reminder you have to clear.
 */
export function QuestCard({ quests, onQuest, onDismiss }: { quests: Quest[]; onQuest: (q: Quest) => void; onDismiss: () => void }) {
  const { colors } = useTheme()
  const done = quests.filter((q) => q.done).length
  const all = done === quests.length
  const earned = questXp(quests)
  const total = quests.reduce((s, q) => s + q.xp, 0)
  return (
    <Card style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexShrink: 1 }}>
          <Feather name="compass" size={16} color={colors.textPrimary} />
          <Text variant="h3">{all ? 'All quests complete' : 'Getting started'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <Text variant="caption" tone="secondary">
            {done}/{quests.length} · {earned}/{total} XP
          </Text>
          <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Hide the quests (Settings brings them back)">
            <Feather name="x" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      <ProgressBar value={(done / quests.length) * 100} showValue={false} />
      {all ? (
        <Text variant="caption" tone="secondary">
          You know your way around. From here, every point comes from real work.
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          {quests.map((q) => (
            <Pressable
              key={q.id}
              onPress={() => (q.done ? undefined : onQuest(q))}
              disabled={q.done}
              accessibilityRole="button"
              accessibilityState={{ checked: q.done }}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: spacing[2],
                padding: spacing[2],
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                opacity: q.done ? 0.6 : 1,
              }}
            >
              <Feather name={q.done ? 'check-circle' : 'circle'} size={16} color={q.done ? colors.success : colors.textSecondary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" weight="semibold" style={{ textDecorationLine: q.done ? 'line-through' : 'none' }}>
                  {q.title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {q.description}
                </Text>
              </View>
              <Text variant="caption" tone="secondary">
                {q.done ? `+${q.xp}` : `${q.xp} XP`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {all ? <Button title="Hide" variant="ghost" size="sm" onPress={onDismiss} /> : null}
    </Card>
  )
}

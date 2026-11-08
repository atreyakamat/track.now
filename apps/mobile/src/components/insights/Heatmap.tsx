import { View } from 'react-native'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { addDays } from '@tracknow/core/domain/streaks'
import { Card, Text } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

const HEATMAP_WEEKS = 12

/** A compact GitHub-style completion heatmap for the last ~12 weeks (counts per local day). */
export function Heatmap({ counts }: { counts: Record<string, number> }) {
  const { colors } = useTheme()
  const today = getTodayDateString()
  const start = addDays(today, -(HEATMAP_WEEKS * 7 - 1))
  const startDow = new Date(`${start}T00:00:00`).getDay()
  const gridStart = addDays(start, -startDow)
  const max = Math.max(1, ...Object.values(counts))

  const weeks: string[][] = []
  for (let w = 0; w < HEATMAP_WEEKS + 1; w++) {
    const col: string[] = []
    for (let d = 0; d < 7; d++) col.push(addDays(gridStart, w * 7 + d))
    weeks.push(col)
  }

  const shade = (date: string): string => {
    if (date > today) return 'transparent'
    const n = counts[date] ?? 0
    if (n === 0) return colors.surfaceMuted
    const t = Math.min(1, n / max)
    return t < 0.34 ? colors.border : t < 0.67 ? colors.accentSecondary : colors.accentPrimary
  }

  return (
    <Card style={{ gap: spacing[2] }}>
      <Text variant="h3">Consistency</Text>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {weeks.map((col, wi) => (
          <View key={wi} style={{ gap: 3 }}>
            {col.map((date) => (
              <View key={date} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: shade(date) }} />
            ))}
          </View>
        ))}
      </View>
      <Text variant="meta" tone="tertiary">
        Last {HEATMAP_WEEKS} weeks of completions
      </Text>
    </Card>
  )
}

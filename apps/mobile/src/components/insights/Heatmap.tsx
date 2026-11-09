import { Feather } from '@expo/vector-icons'
import { useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import { HEATMAP_RANGES, buildActivityHeatmap, countByDate } from '@tracknow/core/domain/heatmap'
import { pluralize } from '@tracknow/core/utils/format'
import { Badge, Card, Segmented, Text } from '@/components/ui'
import { FadeIn } from '@/components/ui/Motion'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

const GAP = 3
const DAY_LABELS = ['M', '', 'W', '', 'F', '', 'S']
const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const longDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * The activity heatmap: one square per day, deeper green for more done. Tap a day to see what
 * was completed. Scrolls sideways for longer spans and opens on the most recent weeks.
 */
export function Heatmap({
  completions,
  items,
  highlight,
  now,
  onOpenPlan,
}: {
  completions: { item_id: string; completed_date: string }[]
  items: ExecutionItem[]
  highlight?: { start: string; end: string } | null
  now?: Date
  onOpenPlan?: (planId: string) => void
}) {
  const { colors, scheme } = useTheme()
  const [weeks, setWeeks] = useState<number>(13)
  const [selected, setSelected] = useState<string | null>(null)
  const [width, setWidth] = useState(0)
  // Squares grow to fill the card (11–22); longer spans scroll sideways from the newest week.
  const CELL = width ? Math.max(11, Math.min(22, Math.floor((width - 16) / weeks) - GAP)) : 13
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const anchor = useMemo(() => now ?? new Date(), [now])
  const map = useMemo(() => buildActivityHeatmap({ counts: countByDate(completions), now: anchor, weeks, highlight }), [completions, anchor, weeks, highlight])
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  // Light theme: deepening greens on cream. Dark theme: the lime accent at rising strength.
  const scale = scheme === 'dark' ? [colors.surfaceMuted, 'rgba(200,241,105,0.28)', 'rgba(200,241,105,0.5)', 'rgba(200,241,105,0.75)', '#c8f169'] : [colors.surfaceMuted, '#d6ebb0', '#b3da68', '#84bd2a', '#4d8a12']

  const dayRows = selected ? completions.filter((c) => c.completed_date === selected) : []
  const dayItems = dayRows.map((c) => itemById.get(c.item_id)).filter((i): i is ExecutionItem => Boolean(i))

  const stat = (label: string, value: string, icon?: boolean) => (
    <View style={{ flex: 1, minWidth: 92 }}>
      <Text variant="meta" tone="tertiary">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon ? <Feather name="zap" size={14} color={colors.warning} /> : null}
        <Text variant="h3">{value}</Text>
      </View>
    </View>
  )

  return (
    <Card style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] }}>
        <Text variant="h3">Activity</Text>
        <Text variant="meta" tone="tertiary">
          {shortDate(map.start)} – today
        </Text>
      </View>
      <Segmented value={String(weeks)} onChange={(v) => setWeeks(Number(v))} options={HEATMAP_RANGES.map((r) => ({ key: String(r.weeks), label: r.label }))} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
        {stat('Completions', String(map.total))}
        {stat('Active days', String(map.activeDays))}
        {stat('Current run', pluralize(map.currentStreak, 'day'), map.currentStreak > 0)}
        {stat('Longest run', pluralize(map.longestStreak, 'day'))}
      </View>

      <View style={{ flexDirection: 'row', gap: GAP }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={{ gap: GAP, paddingTop: 16 }}>
          {DAY_LABELS.map((l, i) => (
            <Text key={i} variant="meta" tone="tertiary" style={{ height: CELL, lineHeight: CELL, fontSize: 9, width: 12 }}>
              {l}
            </Text>
          ))}
        </View>
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
          <View style={{ flexDirection: 'row', gap: GAP }}>
            {map.weeks.map((week, wi) => (
              <View key={week.start} style={{ gap: GAP }}>
                <Text variant="meta" tone="tertiary" style={{ height: 13, fontSize: 9, width: CELL, overflow: 'visible' }} numberOfLines={1}>
                  {map.months.find((m) => m.weekIndex === wi)?.label ?? ''}
                </Text>
                {week.days.map((cell) =>
                  cell.isFuture ? (
                    <View key={cell.date} style={{ width: CELL, height: CELL }} />
                  ) : (
                    <Pressable
                      key={cell.date}
                      onPress={() => setSelected(selected === cell.date ? null : cell.date)}
                      hitSlop={2}
                      accessibilityRole="button"
                      accessibilityLabel={`${longDate(cell.date)}: ${cell.count === 0 ? 'nothing completed' : pluralize(cell.count, 'completion')}`}
                      accessibilityState={{ selected: selected === cell.date }}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 3,
                        backgroundColor: scale[cell.level],
                        borderWidth: selected === cell.date || cell.isToday ? 1.5 : cell.inRange ? 1 : 0,
                        borderColor: selected === cell.date ? colors.textPrimary : cell.isToday ? colors.textPrimary : colors.borderStrong,
                      }}
                    />
                  ),
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
          {map.bestDay ? `Best day: ${map.bestDay.count} on ${shortDate(map.bestDay.date)}` : 'Tap a day to see what you did'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
            Less
          </Text>
          {scale.map((c, i) => (
            <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
          ))}
          <Text variant="meta" tone="tertiary" style={{ textTransform: 'none', letterSpacing: 0 }}>
            More
          </Text>
        </View>
      </View>

      {selected ? (
        <FadeIn key={selected}>
          <View style={{ gap: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing[2] }}>
              <Text variant="caption" weight="semibold" style={{ flexShrink: 1 }}>
                {longDate(selected)}
              </Text>
              <Text variant="meta" tone="tertiary">
                {dayRows.length === 0 ? 'Nothing completed' : pluralize(dayRows.length, 'completion')}
              </Text>
            </View>
            {dayItems.map((i, n) => (
              <Pressable key={`${i.id}-${n}`} onPress={() => onOpenPlan?.(i.plan_id)} disabled={!onOpenPlan} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 32 }}>
                <Badge label={i.type} />
                <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                  {i.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </FadeIn>
      ) : null}
    </Card>
  )
}

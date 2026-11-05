import { FlexWidget, TextWidget } from 'react-native-android-widget'
import type { WidgetSnapshot } from './snapshot'

/** Track.now colors (the widget renders outside the app, so tokens are inlined). */
const BG = '#171714'
const SURFACE = '#22221e'
const TEXT = '#f4efe6'
const MUTED = '#a8a396'
const ACCENT = '#c8f169'

export function TodayWidget({ snapshot }: { snapshot: WidgetSnapshot | null }) {
  const done = snapshot?.doneToday ?? 0
  const total = snapshot?.totalToday ?? 0
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const next = snapshot?.nextItemName ?? null

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: BG,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <TextWidget text="TRACK.NOW · TODAY" style={{ fontSize: 10, color: MUTED, fontWeight: '600', letterSpacing: 1 }} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <TextWidget text={`${done}/${total}`} style={{ fontSize: 28, color: TEXT, fontWeight: 'bold' }} />
        <TextWidget text={`  ${percent}%`} style={{ fontSize: 16, color: ACCENT, fontWeight: '600' }} />
      </FlexWidget>
      <FlexWidget
        style={{
          height: 6,
          width: 'match_parent',
          backgroundColor: SURFACE,
          borderRadius: 999,
          marginTop: 8,
          flexDirection: 'row',
        }}
      >
        <FlexWidget style={{ height: 6, flex: Math.max(1, percent), backgroundColor: ACCENT, borderRadius: 999 }} />
        <FlexWidget style={{ height: 6, flex: Math.max(0, 100 - percent) }} />
      </FlexWidget>
      <TextWidget
        text={next ? `Next: ${next}` : done > 0 && done >= total ? 'All done for today 🎉' : 'Tap to plan your day'}
        style={{ fontSize: 12, color: MUTED, marginTop: 10 }}
        maxLines={1}
      />
    </FlexWidget>
  )
}

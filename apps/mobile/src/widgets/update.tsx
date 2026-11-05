import { Platform } from 'react-native'
import type { ExecutionItem } from '@tracknow/core/types/domain'
import { groupTodayItems } from '@tracknow/core/domain/today'
import { getTodayDateString } from '@tracknow/core/domain/dates'
import { saveWidgetSnapshot, type WidgetSnapshot } from './snapshot'

/**
 * Derives the widget snapshot from the current Today items and completions, saves it, and
 * asks the OS to re-render any placed widgets. Safe to call on any platform (no-op render
 * off Android). Keep this the single place the widget data is produced.
 */
export function updateTodayWidget(items: ExecutionItem[], completedTodayIds: ReadonlySet<string>): void {
  const groups = groupTodayItems(items, completedTodayIds)
  const open = [...groups.overdue, ...groups.dueToday, ...groups.anytime]
  const totalToday = open.length + groups.completedToday.length
  const snapshot: WidgetSnapshot = {
    date: getTodayDateString(),
    doneToday: groups.completedToday.length,
    totalToday,
    nextItemName: open[0]?.name ?? null,
    updatedAt: new Date().toISOString(),
  }
  saveWidgetSnapshot(snapshot)

  if (Platform.OS !== 'android') return
  try {
    const { requestWidgetUpdate } = require('react-native-android-widget')
    const { TodayWidget } = require('./TodayWidget')
    requestWidgetUpdate({
      widgetName: 'TodayWidget',
      renderWidget: () => <TodayWidget snapshot={snapshot} />,
      widgetNotFound: () => undefined,
    })
  } catch {
    /* native module unavailable (e.g. Expo Go) */
  }
}

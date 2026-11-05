import { getStorage } from '@tracknow/core/platform/storage'

/**
 * A tiny, self-contained snapshot the home-screen widget renders from device storage.
 * The widget runs headless (no network, no auth), so the app writes this whenever the
 * Today screen loads and the widget just reads the latest value.
 */
export interface WidgetSnapshot {
  date: string
  doneToday: number
  totalToday: number
  nextItemName: string | null
  updatedAt: string
}

const KEY = 'tracknow_widget_current'

export function saveWidgetSnapshot(snapshot: WidgetSnapshot): void {
  try {
    getStorage()?.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    /* storage unavailable */
  }
}

export function loadWidgetSnapshot(): WidgetSnapshot | null {
  try {
    const raw = getStorage()?.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WidgetSnapshot
    return typeof parsed?.date === 'string' ? parsed : null
  } catch {
    return null
  }
}

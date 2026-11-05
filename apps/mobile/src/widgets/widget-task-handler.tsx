import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { TodayWidget } from './TodayWidget'
import { loadWidgetSnapshot } from './snapshot'

const nameToWidget = {
  TodayWidget,
}

/**
 * Headless handler the OS calls for every widget lifecycle event (added, periodic update,
 * resized, tapped). It reads the latest snapshot from device storage and renders — no
 * network or auth, so it works whether or not the app is running.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const widgetName = props.widgetInfo.widgetName as keyof typeof nameToWidget
  const Widget = nameToWidget[widgetName]
  if (!Widget) return

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK':
      props.renderWidget(<Widget snapshot={loadWidgetSnapshot()} />)
      break
    case 'WIDGET_DELETED':
    default:
      break
  }
}

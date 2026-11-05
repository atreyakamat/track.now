import { Platform } from 'react-native'

/**
 * Registers the Android home-screen widget task handler. Imported for its side effect at
 * app startup (and thus when the OS spins up the headless widget task). Android-only.
 */
if (Platform.OS === 'android') {
  // Required lazily so iOS never loads the Android-only native module.
  const { registerWidgetTaskHandler } = require('react-native-android-widget')
  const { widgetTaskHandler } = require('./widget-task-handler')
  registerWidgetTaskHandler(widgetTaskHandler)
}

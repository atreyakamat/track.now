import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import { AppState } from 'react-native'
import { captureError, configureTelemetry, flushTelemetry } from '@tracknow/core/services/telemetry'

/** The store version plus the over-the-air update running on top of it, e.g. `1.0.0+3f9c2a1b`. */
function appVersion(): string | undefined {
  const version = Constants.expoConfig?.version
  const update = Updates.updateId?.slice(0, 8)
  return version && update ? `${version}+${update}` : version
}

/**
 * Usage events and error reports (first-party, opt-out in Settings). Registers the app with
 * @tracknow/core, reports uncaught JS errors, and sends what is queued when the app leaves
 * the foreground. Call once at startup. Nothing is sent until a user is signed in.
 */
export function installTelemetry(): void {
  configureTelemetry({ app: 'mobile', appVersion: appVersion() })

  // Not defined when the app runs in a browser (react-native-web).
  if (typeof ErrorUtils !== 'undefined') {
    const previous = ErrorUtils.getGlobalHandler()
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      captureError(error, { where: isFatal ? 'global (fatal)' : 'global' })
      if (isFatal) void flushTelemetry()
      previous(error, isFatal)
    })
  }

  AppState.addEventListener('change', (state) => {
    if (state !== 'active') void flushTelemetry()
  })
}

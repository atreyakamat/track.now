import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import '@/styles/tokens.css'
import '@/styles/global.css'
import '@/styles/ui.css'
import '@/styles/layout.css'
import '@/styles/workspace.css'
import { captureError, configureTelemetry, flushTelemetry } from '@tracknow/core/services/telemetry'
import { App } from './App'

// Usage events and error reports (first-party, opt-out in Settings). Nothing is sent until a
// user is signed in; the auth provider tells telemetry who that is.
configureTelemetry({ app: 'web', appVersion: __APP_VERSION__ })
window.addEventListener('error', (e) => captureError(e.error ?? e.message, { where: 'window.error' }))
window.addEventListener('unhandledrejection', (e) => captureError(e.reason, { where: 'unhandledrejection' }))
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushTelemetry()
})

const root = document.getElementById('root')

if (!root) {
  throw new Error('Failed to find root element.')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

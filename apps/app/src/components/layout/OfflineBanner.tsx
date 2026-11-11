import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * A slim bar shown only while the browser reports no connection. It reassures rather than alarms:
 * ticks and edits are kept on the device and saved when the connection returns.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <WifiOff size={15} aria-hidden="true" />
      <span>You’re offline. Your changes are kept on this device and sync when you’re back.</span>
    </div>
  )
}

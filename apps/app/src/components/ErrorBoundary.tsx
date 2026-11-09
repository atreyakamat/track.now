import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { captureError } from '@tracknow/core/services/telemetry'
import { Button } from '@/components/ui'

/**
 * Catches render errors anywhere in the routes, reports them, and shows a way out instead
 * of a blank page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error): void {
    captureError(error, { where: 'react' })
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div className="auth">
        <div className="state state--error" role="alert">
          <div className="state__icon" aria-hidden="true">
            <AlertTriangle size={20} />
          </div>
          <h1 className="t-h3">Something went wrong</h1>
          <p className="state__desc">This page hit an unexpected error. Reloading usually fixes it.</p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    )
  }
}

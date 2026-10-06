import { AlertTriangle, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

export function EmptyState({
  title, description, action, icon,
}: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="state">
      <div className="state__icon" aria-hidden="true">{icon ?? <Inbox size={20} />}</div>
      <h3 className="t-h3">{title}</h3>
      <p className="state__desc">{description}</p>
      {action}
    </div>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state state--plain" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span className="t-caption">{label}</span>
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong', message, onRetry,
}: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <div className="state__icon" aria-hidden="true"><AlertTriangle size={20} /></div>
      <h3 className="t-h3">{title}</h3>
      <p className="state__desc">{message}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  )
}

/** Placeholder for modules that are intentionally not built yet. */
export function ComingSoon({
  title, description, todo, icon,
}: { title: string; description: string; todo: string; icon?: ReactNode }) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={<span className="todo-note">TODO · {todo}</span>}
    />
  )
}

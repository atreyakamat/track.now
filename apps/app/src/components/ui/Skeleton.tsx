/**
 * Loading placeholders that mimic the shape of what is coming, so the first paint does not jump.
 * The shimmer is pure CSS (`.skeleton` in ui.css) and is disabled under "reduce motion".
 * Decorative, so hidden from assistive tech — the page announces its own loading state.
 */
export function Skeleton({ width, height = 14, radius, style }: { width?: string | number; height?: number; radius?: number; style?: React.CSSProperties }) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{ display: 'block', width: width ?? '100%', height, borderRadius: radius ?? 6, ...style }}
    />
  )
}

function CardSkeleton() {
  return (
    <div className="card" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', padding: 'var(--space-3) var(--space-4)' }}>
      <Skeleton width={36} height={36} radius={999} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="60%" height={15} />
        <Skeleton width="35%" height={11} />
      </div>
    </div>
  )
}

/** A few card placeholders while a list loads for the first time. */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="stack" style={{ gap: 'var(--space-3)' }}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

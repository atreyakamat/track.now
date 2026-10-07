interface ProgressCircleProps {
  percent: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  label?: string
  showValue?: boolean
}

export function ProgressCircle({
  percent,
  size = 48,
  strokeWidth = 4,
  color = 'var(--accent-primary)',
  trackColor = 'var(--border)',
  label,
  showValue = false,
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `Progress: ${clamped}%`}
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      {showValue && (
        <span
          style={{
            position: 'absolute',
            fontSize: `${Math.round(size * 0.26)}px`,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {clamped}%
        </span>
      )}
    </div>
  )
}

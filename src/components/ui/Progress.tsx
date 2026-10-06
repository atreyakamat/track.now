import type { CSSProperties, ReactNode } from 'react'

export function Badge({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return <span className={`badge${accent ? ' badge--accent' : ''}`}>{children}</span>
}

export function ProgressBar({
  percent, color, label,
}: { percent: number; color?: string; label: string }) {
  const value = Math.max(0, Math.min(100, percent))
  const style = color ? ({ '--progress-color': color } as CSSProperties) : undefined
  return (
    <div className="progress" style={style}>
      <div
        className="progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div className="progress__fill" style={{ width: `${value}%` }} />
      </div>
      <span className="progress__value" aria-hidden="true">{value}%</span>
    </div>
  )
}

export function ProgressCircle({
  percent, color, size = 96, label,
}: { percent: number; color?: string; size?: number; label: string }) {
  const value = Math.max(0, Math.min(100, percent))
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const style = color ? ({ '--progress-color': color } as CSSProperties) : undefined
  return (
    <div
      className="progress-circle"
      style={style}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="progress-circle__bg" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="progress-circle__fg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="progress-circle__label" style={{ fontSize: size * 0.24 }}>{value}%</span>
    </div>
  )
}

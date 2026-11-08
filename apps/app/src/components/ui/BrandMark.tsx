import { useId } from 'react'

/** The Track.now mark (same artwork as brand/tracknow-mark.svg), inline so it needs no request. */
export function BrandMark({ size = 26, className }: { size?: number; className?: string }) {
  // Gradient ids must be unique per instance: a hidden copy (e.g. the drawer) with the same id
  // would otherwise win the reference and the visible mark would render empty.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const bg = `tn-bg-${uid}`
  const lime = `tn-lime-${uid}`
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, borderRadius: Math.round(size * 0.23) }}
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#232220" />
          <stop offset="1" stopColor="#0c0c0b" />
        </linearGradient>
        <linearGradient id={lime} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#a4dc3c" />
          <stop offset="1" stopColor="#e2ff7e" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${bg})`} />
      <circle cx="256" cy="256" r="150" fill="none" stroke="#3a3936" strokeWidth="30" />
      <path d="M256 106 A150 150 0 1 1 126.1 181" fill="none" stroke={`url(#${lime})`} strokeWidth="30" strokeLinecap="round" />
      <circle cx="126.1" cy="181" r="27" fill="#e2ff7e" />
      <path d="M198 208h116M256 208v126" fill="none" stroke="#f4efe6" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

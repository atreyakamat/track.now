import {
  Activity,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Compass,
  Cpu,
  Dumbbell,
  Flame,
  Target,
  TrendingUp,
  Wallet,
  Zap,
  type LucideProps,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Activity,
  Wallet,
  Briefcase,
  BookOpen,
  TrendingUp,
  Target,
  Zap,
  Flame,
  Compass,
  Award,
  Cpu,
  Dumbbell,
  Building2,
}

/** Database-seeded templates use kebab-case Lucide names (e.g. "book-open", "building-2"). */
const normalize = (name: string) => name.replace(/[-_\s]+/g, '').toLowerCase()
const NORMALIZED_MAP: Record<string, React.ComponentType<LucideProps>> = Object.fromEntries(
  Object.entries(ICON_MAP).map(([key, Icon]) => [normalize(key), Icon]),
)

export function resolveTrackIcon(name: string): React.ComponentType<LucideProps> {
  return ICON_MAP[name] || NORMALIZED_MAP[normalize(name || '')] || Target
}

interface TrackIconProps extends LucideProps {
  name: string
}

export function TrackIcon({ name, ...props }: TrackIconProps) {
  const Component = resolveTrackIcon(name)
  return <Component {...props} />
}

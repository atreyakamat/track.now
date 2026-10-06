import {
  Activity,
  Award,
  BookOpen,
  Briefcase,
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
}

interface TrackIconProps extends LucideProps {
  name: string
}

export function TrackIcon({ name, ...props }: TrackIconProps) {
  const Component = ICON_MAP[name] || Target
  return <Component {...props} />
}

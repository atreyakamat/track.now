import { Feather } from '@expo/vector-icons'
import { View } from 'react-native'
import { radius } from '@/theme/tokens'
import { resolveTrackColor } from '@/theme/tokens'

type FeatherName = React.ComponentProps<typeof Feather>['name']

/** Track icons are stored by lucide name on the web; map them to the closest Feather icon. */
const ICON_MAP: Record<string, FeatherName> = {
  Activity: 'activity',
  Wallet: 'credit-card',
  Briefcase: 'briefcase',
  BookOpen: 'book-open',
  TrendingUp: 'trending-up',
  Target: 'target',
  Zap: 'zap',
  Flame: 'zap',
  Compass: 'compass',
  Award: 'award',
  Cpu: 'cpu',
  Dumbbell: 'activity',
}

interface TrackIconProps {
  icon: string
  color: string
  size?: number
}

export function TrackIcon({ icon, color, size = 44 }: TrackIconProps) {
  const name = ICON_MAP[icon] ?? 'target'
  const tint = resolveTrackColor(color)
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: tint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name={name} size={size * 0.5} color="#141414" />
    </View>
  )
}

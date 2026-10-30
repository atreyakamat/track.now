import { Feather } from '@expo/vector-icons'
import { EmptyState, Screen } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/theme/ThemeProvider'

export default function TodayScreen() {
  const { displayName } = useAuth()
  const { colors } = useTheme()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <Screen>
      <PageHeader title="Today" subtitle={`${greeting}, ${displayName}.`} />
      <EmptyState
        icon={<Feather name="check-circle" size={22} color={colors.textSecondary} />}
        title="Your day, coming up"
        description="Today's tasks, habits and reminders will appear here as we build out the screens."
      />
    </Screen>
  )
}

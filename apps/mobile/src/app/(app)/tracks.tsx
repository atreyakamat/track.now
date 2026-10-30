import { Feather } from '@expo/vector-icons'
import { EmptyState, Screen } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { useTheme } from '@/theme/ThemeProvider'

export default function TracksScreen() {
  const { colors } = useTheme()
  return (
    <Screen>
      <PageHeader title="Tracks" />
      <EmptyState
        icon={<Feather name="layers" size={22} color={colors.textSecondary} />}
        title="Coming together"
        description="Your tracks will appear here."
      />
    </Screen>
  )
}

import { Feather } from '@expo/vector-icons'
import { EmptyState, Screen } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { useTheme } from '@/theme/ThemeProvider'

export default function InsightsScreen() {
  const { colors } = useTheme()
  return (
    <Screen>
      <PageHeader title="Insights" />
      <EmptyState
        icon={<Feather name="bar-chart-2" size={22} color={colors.textSecondary} />}
        title="Coming together"
        description="Your analytics will appear here."
      />
    </Screen>
  )
}

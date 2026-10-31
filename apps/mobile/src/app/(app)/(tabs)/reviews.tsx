import { Feather } from '@expo/vector-icons'
import { EmptyState, Screen } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { useTheme } from '@/theme/ThemeProvider'

export default function ReviewsScreen() {
  const { colors } = useTheme()
  return (
    <Screen>
      <PageHeader title="Reviews" />
      <EmptyState
        icon={<Feather name="book-open" size={22} color={colors.textSecondary} />}
        title="Coming together"
        description="Your weekly and monthly reviews will appear here."
      />
    </Screen>
  )
}

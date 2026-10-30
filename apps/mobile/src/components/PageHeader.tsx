import { View } from 'react-native'
import { Text } from '@/components/ui'
import { spacing } from '@/theme/tokens'

interface PageHeaderProps {
  title: string
  subtitle?: string
  right?: React.ReactNode
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing[3],
        marginBottom: spacing[5],
      }}
    >
      <View style={{ flex: 1, gap: spacing.half + 2 }}>
        <Text variant="h1">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  )
}

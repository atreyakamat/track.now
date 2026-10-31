import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

interface AppBarProps {
  title?: string
  /** Rendered on the right (e.g. an action button or menu). */
  right?: React.ReactNode
  onBack?: () => void
}

/** Top bar for pushed (non-tab) screens, with a back control. */
export function AppBar({ title, right, onBack }: AppBarProps) {
  const router = useRouter()
  const { colors } = useTheme()
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)')))

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        paddingVertical: spacing[2],
        minHeight: 48,
      }}
    >
      <Pressable
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing[2] }}
      >
        <Feather name="chevron-left" size={24} color={colors.textPrimary} />
      </Pressable>
      <View style={{ flex: 1 }}>
        {title ? (
          <Text variant="h3" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  )
}

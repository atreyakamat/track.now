import { ScrollView, View, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

interface ScreenProps {
  children: React.ReactNode
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean
  /** Horizontal padding applied to content (default true). */
  padded?: boolean
  contentStyle?: ViewStyle
  edges?: readonly Edge[]
}

/** Full-height themed background with safe-area insets, used by every screen. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  contentStyle,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  const { colors } = useTheme()
  const padding: ViewStyle = padded
    ? { paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[7] }
    : {}

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  )
}

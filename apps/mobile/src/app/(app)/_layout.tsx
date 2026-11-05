import { Stack } from 'expo-router'
import { NotificationsBridge } from '@/features/notifications/NotificationsBridge'
import { useTheme } from '@/theme/ThemeProvider'

/** Stack over the tab navigator: detail/editor screens push on top of the tabs. */
export default function AppStackLayout() {
  const { colors } = useTheme()
  return (
    <>
      <NotificationsBridge />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  )
}

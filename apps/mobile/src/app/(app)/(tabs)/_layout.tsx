import { Feather } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import type { ColorValue } from 'react-native'
import { useTheme } from '@/theme/ThemeProvider'

type FeatherName = React.ComponentProps<typeof Feather>['name']

function tabIcon(name: FeatherName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Feather name={name} color={color as string} size={size} />
  )
}

export default function AppLayout() {
  const { colors } = useTheme()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 10 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: tabIcon('check-circle') }} />
      <Tabs.Screen name="tracks" options={{ title: 'Tracks', tabBarIcon: tabIcon('layers') }} />
      <Tabs.Screen name="analytics" options={{ title: 'Insights', tabBarIcon: tabIcon('bar-chart-2') }} />
      <Tabs.Screen name="reviews" options={{ title: 'Reviews', tabBarIcon: tabIcon('book-open') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings') }} />
    </Tabs>
  )
}

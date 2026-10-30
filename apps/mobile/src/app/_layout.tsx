import { installSupabase } from '@/lib/supabase'

// Register the Supabase client, device storage and auth redirect with @tracknow/core
// before anything renders or any core service runs.
installSupabase()

import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Button, LoadingState, Text } from '@/components/ui'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider'
import { spacing } from '@/theme/tokens'

function FullScreen({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme()
  return (
    <View
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[5],
        gap: spacing[4],
      }}
    >
      {children}
    </View>
  )
}

/** Redirects between the auth stack and the app depending on session state. */
function AuthGate() {
  const { status, retrySession } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading' || status === 'offline') return
    const inAuthGroup = segments[0] === '(auth)'
    if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(app)')
    } else if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/login')
    }
  }, [status, segments, router])

  if (status === 'loading') {
    return (
      <FullScreen>
        <LoadingState label="Starting Track.now…" />
      </FullScreen>
    )
  }

  if (status === 'offline') {
    return (
      <FullScreen>
        <Text variant="h2" center>
          You&apos;re offline
        </Text>
        <Text variant="caption" tone="secondary" center>
          We couldn&apos;t reach the server to verify your session. Check your connection and try again.
        </Text>
        <Button title="Retry" onPress={retrySession} />
      </FullScreen>
    )
  }

  return null
}

function RootNavigator() {
  const { scheme, colors } = useTheme()
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <AuthGate />
    </>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

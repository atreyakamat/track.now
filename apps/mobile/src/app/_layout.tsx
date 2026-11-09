import { installSupabase } from '@/lib/supabase'
import { installTelemetry } from '@/lib/telemetry'
// Side effect: registers the Android home-screen widget task handler at startup.
import '@/widgets/register'

// Register the Supabase client, device storage and auth redirect with @tracknow/core
// before anything renders or any core service runs.
installSupabase()
// Usage events and error reports: needs the client and storage registered above.
installTelemetry()

import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { captureError } from '@tracknow/core/services/telemetry'
import { Button, LoadingState, Text } from '@/components/ui'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/features/notifications/ToastContext'
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
      router.replace('/(app)/(tabs)')
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

/**
 * Shown by expo-router instead of the whole app when a screen throws while rendering.
 * It replaces the root layout, so it brings its own theme. Reports the error once.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureError(error, { where: 'route' })
  }, [error])

  return (
    <ThemeProvider>
      <FullScreen>
        <Text variant="h2" center>
          Something went wrong
        </Text>
        <Text variant="caption" tone="secondary" center>
          Track.now hit an unexpected error. Trying again usually fixes it.
        </Text>
        <Button title="Retry" onPress={() => void retry()} />
      </FullScreen>
    </ThemeProvider>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <RootNavigator />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

/**
 * Web variant of the device storage module (Metro resolves this instead of `storage.ts`
 * when bundling for the `web` platform). The app ships natively on iOS/Android, but the
 * Expo Router web target must still bundle — and `expo-sqlite`'s web build pulls in a
 * WASM worker that needs cross-origin isolation to run. We don't need it: @tracknow/core
 * falls back to the browser's `localStorage` when no storage is configured, so on web we
 * deliberately register nothing and let that fallback take over.
 */
export function installStorage(): void {
  // No-op on web; core uses its built-in localStorage fallback.
}

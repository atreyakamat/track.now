/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Public app origin used in emailed links (e.g. https://trackapp.atreyakamat.dev). */
  readonly VITE_APP_URL?: string
  /** Store page of the Android app. When set, Settings points web users to it for closed-app reminders. */
  readonly VITE_ANDROID_APP_URL?: string
}

/** package.json version plus the deployed commit when the host provides one (see vite.config.ts). */
declare const __APP_VERSION__: string

interface ImportMeta {
  readonly env: ImportMetaEnv
}

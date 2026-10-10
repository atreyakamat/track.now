import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'dev.atreyakamat.tracknow',
  appName: 'Track.now',
  webDir: 'apps/app/dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'tracknow',
  },
}

export default config

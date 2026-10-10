import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'dev.atreyakamat.tracknow',
  appName: 'Track.now',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'tracknow',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#C8F169',
      sound: 'beep.wav',
    },
  },
}

export default config

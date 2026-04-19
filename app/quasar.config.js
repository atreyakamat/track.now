const { configure } = require('quasar/wrappers')

module.exports = configure(function (ctx) {
  return {
    boot: ['firebase', 'auth'],
    css: ['app.scss'],
    extras: ['mdi-v7', 'roboto-font', 'material-icons'],
    build: {
      target: { browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1'] },
      vueRouterMode: 'hash'
    },
    devServer: { open: true },
    framework: {
      config: { notify: {} },
      iconSet: 'material-icons',
      plugins: ['Notify', 'Loading', 'LocalStorage', 'Dark']
    },
    animations: 'all',
    ssr: { pwa: false, prodPort: 3000, middlewares: ['render'] },
    pwa: {
<<<<<<< HEAD
      workboxMode: 'generateSW',
      injectPwaMetaTags: true,
      swFilename: 'sw.js',
      manifestFilename: 'manifest.json',
      workboxOptions: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true
      },
      manifest: {
        name: 'Track.now',
        short_name: 'Track.now',
        description: 'Mission-based habit and task tracking with reminders, planning, and analytics.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8fafc',
        theme_color: '#245c68',
        start_url: './#/today',
=======
      workboxMode: 'generateSW', // or 'injectManifest'
      injectPwaMetaTags: true,
      swFilename: 'sw.js',
      manifest: {
        name: 'Track.now',
        short_name: 'Track.now',
        description: 'Premium Habit Tracking',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1976d2',
>>>>>>> a019a5362bacb14dd7013981da66fa5d112d04b7
        icons: [
          {
            src: 'icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png'
          },
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-256x256.png',
            sizes: '256x256',
            type: 'image/png'
          },
          {
            src: 'icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }
  }
})

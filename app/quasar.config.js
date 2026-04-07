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
    pwa: { workboxMode: 'generateSW', injectPwaMetaTags: true, swFilename: 'sw.js' }
  }
})

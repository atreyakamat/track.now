// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')
const coreRoot = path.resolve(monorepoRoot, 'packages/core')
const coreSrc = path.resolve(coreRoot, 'src')

const config = getDefaultConfig(projectRoot)

// Watch the shared core package so edits to it hot-reload in the app.
config.watchFolders = [coreRoot]

// Resolve `@tracknow/core/<subpath>` straight to its TypeScript source. No build step and
// no symlink, so Windows symlink permissions never come into play and there is one source
// of truth. Metro transforms the file because coreRoot is in watchFolders above.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@tracknow/core' || moduleName.startsWith('@tracknow/core/')) {
    const sub = moduleName.slice('@tracknow/core'.length).replace(/^\//, '') || 'index'
    return { type: 'sourceFile', filePath: path.join(coreSrc, `${sub}.ts`) }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config

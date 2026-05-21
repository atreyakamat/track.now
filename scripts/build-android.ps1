Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot '..')
$appDir = Join-Path $repoRoot 'app'

Write-Host 'Building Track.now for Android (Capacitor)...'

Push-Location $appDir
try {
  Write-Host '[1/2] Building Quasar Capacitor bundle'
  npx quasar build -m capacitor -T android

  Write-Host '[2/2] Generating APK via Gradle'
  Push-Location (Join-Path $appDir 'src-capacitor\android')
  try {
    .\gradlew assembleRelease
  } finally {
    Pop-Location
  }

} finally {
  Pop-Location
}

Write-Host 'Android build completed successfully!'

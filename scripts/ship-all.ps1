Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot '..')
$appDir = Join-Path $repoRoot 'app'

Write-Host 'Running full ship pipeline...'

Push-Location $appDir
try {
  Write-Host ''
  Write-Host '[1/3] Lint'
  npm run lint | Out-Host

  Write-Host ''
  Write-Host '[2/3] Build'
  npm run build:pwa | Out-Host
} finally {
  Pop-Location
}

Write-Host ''
Write-Host '[3/3] Release packaging'
powershell -ExecutionPolicy Bypass -File (Join-Path $scriptRoot 'prepare-release.ps1') | Out-Host

Write-Host ''
Write-Host 'Ship pipeline completed.'
Write-Host "Release output: $(Join-Path $repoRoot 'release')"

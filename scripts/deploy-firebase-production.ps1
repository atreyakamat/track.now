param(
  [string]$ProjectId,
  [switch]$RulesOnly,
  [switch]$HostingOnly,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($RulesOnly -and $HostingOnly) {
  throw 'Use only one of -RulesOnly or -HostingOnly.'
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot '..')
$appDir = Join-Path $repoRoot 'app'

$firebaseCmd = Get-Command firebase -ErrorAction SilentlyContinue
$npxCmd = Get-Command npx -ErrorAction SilentlyContinue
if (-not $firebaseCmd -and -not $npxCmd) {
  throw 'Neither firebase nor npx is available in PATH. Install Node.js and npm first.'
}

$useNpx = -not [bool]$firebaseCmd

if (-not $ProjectId -and -not (Test-Path (Join-Path $repoRoot '.firebaserc'))) {
  throw 'Missing .firebaserc. Copy .firebaserc.example to .firebaserc or pass -ProjectId.'
}

$deployTarget = if ($RulesOnly) {
  'firestore:rules'
} elseif ($HostingOnly) {
  'hosting'
} else {
  'firestore:rules,hosting'
}

if (-not $SkipBuild -and -not $RulesOnly) {
  Write-Host 'Building installable PWA...'
  Push-Location $appDir
  try {
    npm run build:pwa | Out-Host
  } finally {
    Pop-Location
  }
}

$deployArgs = @('deploy', '--only', $deployTarget)
if ($ProjectId) {
  $deployArgs += @('--project', $ProjectId)
}

Write-Host "Deploying with target: $deployTarget"
if ($ProjectId) {
  Write-Host "Project: $ProjectId"
}

if ($useNpx) {
  Write-Host 'Firebase CLI not found globally; using npx firebase-tools.'
  & npx --yes firebase-tools @deployArgs
} else {
  & firebase @deployArgs
}

if ($LASTEXITCODE -ne 0) {
  throw 'Firebase deploy failed.'
}

Write-Host 'Firebase deploy completed successfully.'

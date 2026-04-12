Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot '..')
$appDir = Join-Path $repoRoot 'app'
$releaseDir = Join-Path $repoRoot 'release'

function Assert-WithinRoot {
  param(
    [string]$RootPath,
    [string]$TargetPath
  )

  $resolvedRoot = (Resolve-Path $RootPath).Path
  if (Test-Path $TargetPath) {
    $resolvedTarget = (Resolve-Path $TargetPath).Path
  } else {
    $parent = Split-Path -Parent $TargetPath
    if (-not (Test-Path $parent)) {
      New-Item -ItemType Directory -Path $parent | Out-Null
    }
    $resolvedTarget = (Resolve-Path $parent).Path + '\' + (Split-Path -Leaf $TargetPath)
  }

  if (-not $resolvedTarget.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to modify path outside repo root: $resolvedTarget"
  }
}

Write-Host 'Building Track.now app...'
Push-Location $appDir
try {
  npm run build | Out-Host
} finally {
  Pop-Location
}

if (Test-Path $releaseDir) {
  Assert-WithinRoot -RootPath $repoRoot -TargetPath $releaseDir
  Remove-Item -LiteralPath $releaseDir -Recurse -Force
}

New-Item -ItemType Directory -Path $releaseDir | Out-Null

$distDir = Join-Path $appDir 'dist\spa'
if (-not (Test-Path $distDir)) {
  throw "Build output not found: $distDir"
}

Write-Host 'Copying deployable assets...'
Copy-Item -LiteralPath $distDir -Destination (Join-Path $releaseDir 'app') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'landing') -Destination (Join-Path $releaseDir 'landing') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'extension') -Destination (Join-Path $releaseDir 'extension') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs') -Destination (Join-Path $releaseDir 'docs') -Recurse -Force

$rootDocs = @(
  'README.md',
  'PRD.md',
  'Product Spec.md',
  'Business.md',
  'DESIGN.md',
  'USER_WORKFLOWS.md',
  'LAUNCH_CHECKLIST.md'
)

$releaseRootDocs = Join-Path $releaseDir 'root-docs'
New-Item -ItemType Directory -Path $releaseRootDocs | Out-Null

foreach ($docName in $rootDocs) {
  $sourcePath = Join-Path $repoRoot $docName
  if (Test-Path $sourcePath) {
    Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $releaseRootDocs $docName) -Force
  }
}

Write-Host ''
Write-Host 'Release bundle created successfully:'
Write-Host "  $releaseDir"
Write-Host ''
Write-Host 'Contents:'
Get-ChildItem -LiteralPath $releaseDir | ForEach-Object {
  Write-Host "  - $($_.Name)"
}

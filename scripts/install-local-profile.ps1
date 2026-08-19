param(
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }),
  [string]$Profile = 'desktop'
)

# Installs Wuji as a selectable per-session preset. It never changes the
# agent-presets default and never adds wuji-host to the Desktop host profile.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$sourcePackage = Join-Path $repo 'packages\wuji-host'
$presetSource = Join-Path $repo 'preset'
$profileDir = Join-Path $DshHome "profiles\$Profile"
$presetTarget = Join-Path $DshHome '.agent-presets\wuji'
$packageTarget = Join-Path $presetTarget 'node_modules\@wuji\dsh-wuji-host'
$sourceZod = Join-Path $sourcePackage 'node_modules\zod'

if (-not (Test-Path (Join-Path $sourcePackage 'package.json'))) { throw "wuji-host package not found: $sourcePackage" }
if (-not (Test-Path (Join-Path $presetSource 'agent.cordis.yml'))) { throw "Wuji preset composition not found: $presetSource" }
if (-not (Test-Path $profileDir)) { throw "DSH profile not found: $profileDir" }
if (-not (Test-Path $sourceZod)) { throw "Wuji dependency zod is missing. Run 'npm install' in packages\wuji-host before installing." }

# The preset loader resolves modules from the preset's base URL. The Wuji host
# and its dependency must therefore live below .agent-presets/wuji/node_modules,
# not below profiles/node_modules.
$backupRoot = Join-Path $DshHome 'backups\wuji-mode'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupRoot $stamp
New-Item -ItemType Directory -Force -Path $backup | Out-Null
if (Test-Path $presetTarget) { Copy-Item $presetTarget (Join-Path $backup 'preset') -Recurse -Force }

$stage = Join-Path $DshHome ".tmp\wuji-mode-$stamp"
$stagePreset = Join-Path $stage 'preset'
$stagePackage = Join-Path $stagePreset 'node_modules\@wuji\dsh-wuji-host'
New-Item -ItemType Directory -Force -Path $stagePackage | Out-Null
Copy-Item (Join-Path $sourcePackage 'package.json') $stagePackage -Force
Copy-Item (Join-Path $sourcePackage 'lib') (Join-Path $stagePackage 'lib') -Recurse -Force
Copy-Item $sourceZod (Join-Path $stagePackage 'node_modules\zod') -Recurse -Force
Copy-Item (Join-Path $presetSource 'agent.cordis.yml') $stagePreset -Force
Copy-Item (Join-Path $presetSource 'preset.yml') $stagePreset -Force
Copy-Item (Join-Path $repo 'skills') (Join-Path $stagePreset 'skills') -Recurse -Force

# Commit only after every source copy succeeds; preserve an audit backup.
New-Item -ItemType Directory -Force -Path (Split-Path $presetTarget) | Out-Null
if (Test-Path $presetTarget) { Remove-Item $presetTarget -Recurse -Force }
Move-Item $stagePreset $presetTarget
Remove-Item $stage -Recurse -Force

Write-Host "Installed selectable Wuji preset to $presetTarget"
Write-Host 'Wuji dependencies are preset-local; no Desktop host row and no default preset were changed.'
Write-Host 'Restart DSH, create a new session, and select “无极军团”. Existing sessions retain their original preset.'

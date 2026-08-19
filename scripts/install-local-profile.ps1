param(
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }),
  [string]$Profile = 'desktop',
  [switch]$RemoveLegacyWujiPatch
)

# Installs Wuji as a selectable per-session preset. It never changes the
# agent-presets default and never adds wuji-host to the Desktop host profile.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$sourcePackage = Join-Path $repo 'packages\wuji-host'
$presetSource = Join-Path $repo 'preset'
$profileDir = Join-Path $DshHome "profiles\$Profile"
$packageTarget = Join-Path $DshHome 'profiles\node_modules\@wuji\dsh-wuji-host'
$presetTarget = Join-Path $DshHome '.agent-presets\wuji'
$patch = Join-Path $profileDir 'cordis.patch.yml'

if (-not (Test-Path (Join-Path $sourcePackage 'package.json'))) { throw "wuji-host package not found: $sourcePackage" }
if (-not (Test-Path (Join-Path $presetSource 'agent.cordis.yml'))) { throw "Wuji preset composition not found: $presetSource" }
if (-not (Test-Path $profileDir)) { throw "DSH profile not found: $profileDir" }

# Stage all writes first and preserve prior installations for rollback.
$backupRoot = Join-Path $DshHome 'backups\wuji-mode'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupRoot $stamp
New-Item -ItemType Directory -Force -Path $backup | Out-Null
if (Test-Path $packageTarget) { Copy-Item $packageTarget (Join-Path $backup 'wuji-host') -Recurse -Force }
if (Test-Path $presetTarget) { Copy-Item $presetTarget (Join-Path $backup 'preset') -Recurse -Force }
$stage = Join-Path $DshHome ".tmp\wuji-mode-$stamp"
$stagePackage = Join-Path $stage 'package'
$stagePreset = Join-Path $stage 'preset'
New-Item -ItemType Directory -Force -Path $stagePackage,$stagePreset | Out-Null
Copy-Item (Join-Path $sourcePackage 'package.json') $stagePackage -Force
Copy-Item (Join-Path $sourcePackage 'lib') (Join-Path $stagePackage 'lib') -Recurse -Force
Copy-Item (Join-Path $presetSource 'agent.cordis.yml') $stagePreset -Force
Copy-Item (Join-Path $presetSource 'preset.yml') $stagePreset -Force
Copy-Item (Join-Path $repo 'skills') (Join-Path $stagePreset 'skills') -Recurse -Force

# Commit staged directories only after every source copy succeeds.
New-Item -ItemType Directory -Force -Path (Split-Path $packageTarget) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $presetTarget) | Out-Null
if (Test-Path $packageTarget) { Remove-Item $packageTarget -Recurse -Force }
if (Test-Path $presetTarget) { Remove-Item $presetTarget -Recurse -Force }
Move-Item $stagePackage $packageTarget
Move-Item $stagePreset $presetTarget
Remove-Item $stage -Recurse -Force

if ($RemoveLegacyWujiPatch) {
  throw 'Automatic legacy patch surgery is intentionally unsupported: it can damage unrelated user rows. Remove the legacy agent-presets.default: wuji and wuji-host rows manually, or restore your profile patch backup, then rerun this installer.'
}

Write-Host "Installed selectable Wuji preset to $presetTarget"
Write-Host 'No Desktop host row and no default preset were changed.'
Write-Host 'Restart DSH, create a new session, and select “无极军团”. Existing sessions retain their original preset.'

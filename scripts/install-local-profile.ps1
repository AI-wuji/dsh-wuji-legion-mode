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

# Install the package for preset composition resolution only. It is deliberately
# absent from the Desktop patch, so other presets never receive wuji_* tools.
New-Item -ItemType Directory -Force -Path $packageTarget | Out-Null
Copy-Item (Join-Path $sourcePackage 'package.json') $packageTarget -Force
Copy-Item (Join-Path $sourcePackage 'lib') (Join-Path $packageTarget 'lib') -Recurse -Force
if (Test-Path (Join-Path $packageTarget 'test')) { Remove-Item -LiteralPath (Join-Path $packageTarget 'test') -Recurse -Force }

# DSH discovers user presets from $DSH_HOME/.agent-presets on every roster read.
New-Item -ItemType Directory -Force -Path $presetTarget | Out-Null
Copy-Item (Join-Path $presetSource 'agent.cordis.yml') $presetTarget -Force
Copy-Item (Join-Path $presetSource 'preset.yml') $presetTarget -Force
Copy-Item (Join-Path $repo 'skills') (Join-Path $presetTarget 'skills') -Recurse -Force

if ($RemoveLegacyWujiPatch) {
  throw 'Automatic legacy patch surgery is intentionally unsupported: it can damage unrelated user rows. Remove the legacy agent-presets.default: wuji and wuji-host rows manually, or restore your profile patch backup, then rerun this installer.'
}

Write-Host "Installed selectable Wuji preset to $presetTarget"
Write-Host 'No Desktop host row and no default preset were changed.'
Write-Host 'Restart DSH, create a new session, and select “无极军团”. Existing sessions retain their original preset.'

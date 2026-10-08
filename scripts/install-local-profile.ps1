# ============================================================================
# 无极军团 4.0 · 本地 preset 安装
#
# 4.0 改造后，本模式不再包含任何自研运行时（原 packages/wuji-host 的 20 个
# lib 模块已全部移除），能力全部由官方 @deepseek-ai/* 插件行承载。因此安装只
# 需要铺设两样东西：
#
#   1. preset/  → $DSH_HOME/.agent-presets/wuji/      （preset.yml + agent.cordis.yml）
#   2. skills/  → $DSH_HOME/.agent-presets/wuji/skills/（PonyTail + 4.0 入口技能）
#
# preset 里的 skill-filesystem 行用 `dirname(baseUrl)/../skills` 定位技能目录，
# 所以 skills 必须与 agent.cordis.yml 同级的**上一级**——即两者都要铺进
# .agent-presets/wuji/ 下面（preset 文件在 wuji/，skills 在 wuji/skills/）。
#
# 注意：DSH 桌面版当前从 bundle 机制读取 preset（见 docs/MODE-IMPLEMENTATION.md）。
# 本脚本铺设的是 preset 源文件与技能目录，供 loader 解析；bundle 注册仍需走
# plugin_manager / install_bundle。两条路径都保持 preset 级隔离：
# 不修改 Desktop 默认 preset，不把军团写入其他模式。
# ============================================================================

param(
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' })
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$presetSource = Join-Path $repo 'preset'
$skillsSource = Join-Path $repo 'skills'
$presetTarget = Join-Path $DshHome '.agent-presets\wuji'

if (-not (Test-Path (Join-Path $presetSource 'agent.cordis.yml'))) { throw "Wuji preset composition not found: $presetSource" }
if (-not (Test-Path (Join-Path $skillsSource 'ponytail'))) { throw "Wuji skills not found: $skillsSource" }
if (-not (Test-Path $DshHome)) { throw "DSH home not found: $DshHome" }

# 备份现有安装后再整体替换；失败时不留下半成品。
$backupRoot = Join-Path $DshHome 'backups\wuji-mode'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backupRoot $stamp
if (Test-Path $presetTarget) {
  New-Item -ItemType Directory -Force -Path $backup | Out-Null
  Copy-Item $presetTarget (Join-Path $backup 'preset') -Recurse -Force
}

$stage = Join-Path $DshHome ".tmp\wuji-mode-$stamp"
New-Item -ItemType Directory -Force -Path $stage | Out-Null
try {
  Copy-Item (Join-Path $presetSource 'agent.cordis.yml') $stage -Force
  Copy-Item (Join-Path $presetSource 'preset.yml') $stage -Force
  Copy-Item $skillsSource (Join-Path $stage 'skills') -Recurse -Force

  New-Item -ItemType Directory -Force -Path (Split-Path $presetTarget) | Out-Null
  if (Test-Path $presetTarget) { Remove-Item $presetTarget -Recurse -Force }
  Move-Item $stage $presetTarget
}
finally {
  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
}

Write-Host "Installed selectable Wuji 4.0 preset to $presetTarget"
Write-Host 'No self-built runtime is installed; all capabilities come from official @deepseek-ai/* plugins.'
Write-Host 'Restart DSH, create a new session, and select "无极军团". Existing sessions retain their original preset.'

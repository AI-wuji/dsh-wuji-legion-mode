<#
.SYNOPSIS
  把 DeepSeek Harness 恢复到出厂干净状态，为重新改造无极军团 DSH 模式形态作基线。

.DESCRIPTION
  本脚本删除 profile 与本地包镜像，不删除桌面应用本体。

  删除：
    ~/.dsh                        profile 本体（会话、凭据、preset、插件、profile 包链接）
    ~/DeepSeek-Harness            本地 @deepseek-ai 包镜像（277 个包的 junction 源）
    %LOCALAPPDATA%\@deepseek-aidsh-desktop-updater    桌面更新缓存
    %LOCALAPPDATA%\dsh-plugin-desktop-updater         插件更新缓存

  保留：
    %LOCALAPPDATA%\Programs\DeepSeek Harness          桌面应用本体（自带完整生产依赖树）
    ~/AppData/Local/... 其他                          卸载器永不触碰 ~/.dsh，故应用卸载亦不影响

  影响：会话历史、凭据、已配置 provider 全部丢失，下次启动需重新登录与配置。
        应用自带 app.asar/dsh 完整依赖树，重建 profile 不需要联网安装核心包。

.PARAMETER KeepProfile
  只清包镜像与更新缓存，保留 ~/.dsh（会话与凭据不丢）。

.PARAMETER IncludeCaches
  同时删除两个更新缓存（共约 750 MB，删后会重新下载）。

.EXAMPLE
  # 完全重置（退出 Desktop 后）
  pwsh -File scripts\reset-dsh-clean.ps1

.EXAMPLE
  # 保留会话与凭据，只清缓存
  pwsh -File scripts\reset-dsh-clean.ps1 -KeepProfile -IncludeCaches
#>
[CmdletBinding()]
param(
  [switch]$KeepProfile,
  [switch]$IncludeCaches
)

$ErrorActionPreference = 'Stop'

function Test-Target([string]$p) { return ($p -and (Test-Path -LiteralPath $p)) }

# ---------------------------------------------------------------- 进程守卫
$running = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
if ($running) {
  Write-Host ''
  Write-Host '!! DeepSeek Harness 正在运行（PID: ' (($running.Id) -join ', ') ')' -ForegroundColor Red
  Write-Host '   正在运行时删除 profile 会导致会话丢失、进程崩溃。' -ForegroundColor Red
  Write-Host '   请完全退出应用（含系统托盘右键 → Quit）后重试。' -ForegroundColor Red
  Write-Host ''
  exit 2
}

$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$local = $env:LOCALAPPDATA

$plan = @(
  @{ Path = Join-Path $env:USERPROFILE 'DeepSeek-Harness'; Desc = '本地 @deepseek-ai 包镜像（234 个 profile junction 的源）' }
)
if (-not $KeepProfile) {
  $plan += @{ Path = $dshHome; Desc = 'DSH profile（会话/凭据/preset/插件）' }
}
if ($IncludeCaches) {
  $plan += @{ Path = Join-Path $local '@deepseek-aidsh-desktop-updater'; Desc = '桌面更新缓存' }
  $plan += @{ Path = Join-Path $local 'dsh-plugin-desktop-updater'; Desc = '插件更新缓存' }
}

# ---------------------------------------------------------------- 确认
Write-Host ''
Write-Host '计划删除：' -ForegroundColor Cyan
foreach ($t in $plan) {
  $flag = if (Test-Target $t.Path) { '存在' } else { '不存在' }
  Write-Host ("  [{0}] {1}" -f $flag, $t.Path) -ForegroundColor Yellow
  Write-Host ("         {0}" -f $t.Desc) -ForegroundColor DarkGray
}
Write-Host ''
Write-Host '保留：'
Write-Host ("  [保留] {0}" -f (Join-Path $local 'Programs\DeepSeek Harness')) -ForegroundColor Green
Write-Host ''

if (-not $KeepProfile) {
  Write-Host '注意：这将永久删除所有会话历史与登录凭据。' -ForegroundColor Red
}
$ans = Read-Host '确认删除？输入 yes 继续'
if ($ans -ne 'yes') { Write-Host '已取消。' -ForegroundColor Yellow; exit 0 }

# ---------------------------------------------------------------- 执行
$freed = 0L; $ok = 0; $fail = 0
foreach ($t in $plan) {
  if (-not (Test-Target $t.Path)) { continue }
  $full = [System.IO.Path]::GetFullPath($t.Path)
  # 安全闸：只允许删除用户目录与 LOCALAPPDATA 下的目标
  if ($full -notlike "$env:USERPROFILE*" -and $full -notlike "$local*") {
    Write-Host ("  跳过(越界) {0}" -f $full) -ForegroundColor Red; $fail++; continue
  }
  $item = Get-Item -LiteralPath $full -Force
  $sz = if ($item.PSIsContainer) {
    (Get-ChildItem -LiteralPath $full -Recurse -Force -ErrorAction SilentlyContinue |
      Measure-Object -Property Length -Sum).Sum
  } else { $item.Length }

  # junction 不跟随删除目标内容，先解除链接
  Get-ChildItem -LiteralPath $full -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.LinkType -in @('Junction', 'SymbolicLink') } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }

  Remove-Item -LiteralPath $full -Recurse -Force -ErrorAction SilentlyContinue
  if (-not (Test-Path -LiteralPath $full)) {
    Write-Host ("  已删除 {0,8:N0} MB  {1}" -f ($sz / 1MB), $full) -ForegroundColor Green
    $freed += $sz; $ok++
  } else {
    Write-Host ("  删除失败 {0}" -f $full) -ForegroundColor Red; $fail++
  }
}

Write-Host ''
Write-Host ("完成：{0} 项删除，{1} 项失败，释放 {2:N0} MB" -f $ok, $fail, ($freed / 1MB)) -ForegroundColor Cyan
Write-Host ''
Write-Host '下一步：启动 DeepSeek Harness，它会重建全新 profile。' -ForegroundColor Cyan
Write-Host '首次启动需重新登录并配置 provider；' -ForegroundColor DarkGray
Write-Host '原 cordis.patch.yml 中的本地 provider 配置已备份到：' -ForegroundColor DarkGray
Write-Host '  docs\dsh-local-profile-backup\cordis.patch.yml' -ForegroundColor DarkGray

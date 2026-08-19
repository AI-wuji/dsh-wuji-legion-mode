param(
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }),
  [string]$Profile = 'desktop'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repo 'packages\wuji-host'
$target = Join-Path $DshHome "profiles\node_modules\@wuji\dsh-wuji-host"
if (-not (Test-Path (Join-Path $source 'package.json'))) { throw "wuji-host package not found: $source" }
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item (Join-Path $source 'package.json') $target -Force
if (-not (Test-Path (Join-Path $target 'lib'))) { New-Item -ItemType Directory -Force -Path (Join-Path $target 'lib') | Out-Null }
Copy-Item (Join-Path $source 'lib\*') (Join-Path $target 'lib') -Recurse -Force
# 若旧安装残留 test/，将其清掉（测试不回生产安装目录）
if (Test-Path (Join-Path $target 'test')) { Remove-Item -LiteralPath (Join-Path $target 'test') -Recurse -Force -ErrorAction SilentlyContinue }
$patch = Join-Path $DshHome "profiles\$Profile\cordis.patch.yml"
if (-not (Test-Path $patch)) { throw "profile patch not found: $patch" }
$text = Get-Content $patch -Raw -Encoding UTF8
# Desktop plugin installers can rewrite this patch. Restore the complete user-owned rows if any managed row disappeared.
if ($text -notmatch "@wuji/dsh-wuji-host" -or $text -notmatch "default:\s*wuji" -or $text -notmatch "@deepseek-ai/dsh-mcp-client") {
@"
# User-owned Desktop profile patch.
- id: agent-presets
  config:
    default: wuji
- insert:
    - id: wuji-host
      name: '@wuji/dsh-wuji-host'
    - id: playwright-browser
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        transport: stdio
        serverName: playwright
        command: npx
        args: ['-y', '@playwright/mcp@latest', '--browser', 'msedge']
        failOnStartupError: false
        reconnect:
          enabled: true
          maxAttempts: 3
"@ | Set-Content $patch -Encoding UTF8
}
Write-Host "Installed @wuji/dsh-wuji-host to $target"
Write-Host "Restart DSH to load the new host package."

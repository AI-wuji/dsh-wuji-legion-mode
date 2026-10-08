# READ-ONLY reconnaissance for the DeepSeek Harness Desktop window.
# Locates the window, brings it to front, saves a screenshot, and dumps the
# UI Automation control tree. Clicks nothing, types nothing.
#
# ASCII-only on purpose: this box runs Windows PowerShell 5.1, which decodes
# BOM-less UTF-8 scripts as ANSI/GBK and corrupts non-ASCII literals into
# unbalanced quotes. Keeping the source ASCII removes that failure class.

Add-Type -AssemblyName System.Windows.Forms, System.Drawing, UIAutomationClient, UIAutomationTypes

$ErrorActionPreference = 'Stop'
$outDir = 'E:\wuji-projects\dsh-wuji-legion-mode\.ui-shots'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static System.Collections.Generic.List<IntPtr> Handles = new System.Collections.Generic.List<IntPtr>();
  public static System.Collections.Generic.List<string> Titles = new System.Collections.Generic.List<string>();
  public static System.Collections.Generic.List<int> Pids = new System.Collections.Generic.List<int>();
  public static System.Collections.Generic.List<RECT> Rects = new System.Collections.Generic.List<RECT>();
  public static void Scan() {
    Handles.Clear(); Titles.Clear(); Pids.Clear(); Rects.Clear();
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h)) return true;
      int len = GetWindowTextLength(h);
      if (len == 0) return true;
      var sb = new StringBuilder(len + 2);
      GetWindowText(h, sb, sb.Capacity);
      uint pid; GetWindowThreadProcessId(h, out pid);
      RECT r; GetWindowRect(h, out r);
      Handles.Add(h); Titles.Add(sb.ToString()); Pids.Add((int)pid); Rects.Add(r);
      return true;
    }, IntPtr.Zero);
  }
}
'@

[W]::Scan()
Write-Host '=== visible windows ===' -ForegroundColor Cyan
for ($i = 0; $i -lt [W]::Titles.Count; $i++) {
  $r = [W]::Rects[$i]
  $w = $r.Right - $r.Left; $h = $r.Bottom - $r.Top
  if ($w -le 0 -or $h -le 0) { continue }
  $pname = '?'
  try { $pname = (Get-Process -Id ([W]::Pids[$i]) -ErrorAction Stop).ProcessName } catch { }
  $mark = ''
  if ($pname -eq 'DeepSeek Harness') { $mark = '   <<< TARGET' }
  Write-Host ('{0,-44} pid={1,-6} {2,5}x{3,-5} proc={4}{5}' -f [W]::Titles[$i], [W]::Pids[$i], $w, $h, $pname, $mark)
}

# Pick the DSH Desktop window by PROCESS NAME, not by title: a Chrome tab
# showing the DSH web app also has "DeepSeek Harness" in its title.
$target = $null
for ($i = 0; $i -lt [W]::Titles.Count; $i++) {
  $r = [W]::Rects[$i]
  if (($r.Right - $r.Left) -le 400) { continue }
  $pname = $null
  try { $pname = (Get-Process -Id ([W]::Pids[$i]) -ErrorAction Stop).ProcessName } catch { continue }
  if ($pname -ne 'DeepSeek Harness') { continue }
  $area = ($r.Right - $r.Left) * ($r.Bottom - $r.Top)
  if (-not $target -or $area -gt $target.Area) {
    $target = @{ H = [W]::Handles[$i]; R = $r; T = [W]::Titles[$i]; Area = $area }
  }
}
if (-not $target) { Write-Host 'DeepSeek Harness.exe window not found' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host ('=== target: ' + $target.T) -ForegroundColor Cyan
[W]::ShowWindow($target.H, 9) | Out-Null
[W]::SetForegroundWindow($target.H) | Out-Null
Start-Sleep -Milliseconds 1500

$r = $target.R
$bmp = New-Object System.Drawing.Bitmap ($r.Right - $r.Left), ($r.Bottom - $r.Top)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp.Size)
$shot = Join-Path $outDir 'window.png'
$bmp.Save($shot, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host ('screenshot: ' + $shot)

Write-Host ''
Write-Host '=== UI Automation tree (depth<=4) ===' -ForegroundColor Cyan
try {
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($target.H)
  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $count = 0
  function Walk($el, $depth, $max) {
    if ($depth -gt $max -or -not $el) { return }
    try {
      $n = $el.Current.Name
      $t = $el.Current.ControlType.ProgrammaticName -replace 'ControlType\.', ''
      $b = $el.Current.BoundingRectangle
      $nm = $n
      if (-not $nm) { $nm = '(no-name)' }
      $pad = '  ' * $depth
      Write-Host ($pad + $t + ' | ' + $nm + ' | (' + [int]$b.X + ',' + [int]$b.Y + ' ' + [int]$b.Width + 'x' + [int]$b.Height + ')')
      $script:count++
    } catch { return }
    $child = $walker.GetFirstChild($el)
    while ($child) { Walk $child ($depth + 1) $max; $child = $walker.GetNextSibling($child) }
  }
  Walk $root 0 4
  Write-Host ('total nodes: ' + $count)
} catch {
  Write-Host ('UIA unavailable: ' + $_.Exception.Message) -ForegroundColor Yellow
}

# Generates Study Live PNG icons from scratch via System.Drawing (creation only, no deletions).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$ws = 'C:\Users\1\OneDrive\Desktop\my own projects\study live'
$outDir = Join-Path $ws 'assets'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$cream = [System.Drawing.Color]::FromArgb(247, 242, 233)
$blue = [System.Drawing.Color]::FromArgb(51, 88, 158)
$red = [System.Drawing.Color]::FromArgb(196, 72, 63)

function New-RoundRectPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function New-Icon([int]$size, [string]$file, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $s = $size / 96.0

  # background
  $bgBrush = New-Object System.Drawing.SolidBrush($cream)
  if ($maskable) {
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)
  } else {
    $bgPath = New-RoundRectPath 0 0 ($size - 1) ($size - 1) (22 * $s)
    $g.FillPath($bgBrush, $bgPath)
    $bgPath.Dispose()
  }
  $bgBrush.Dispose()

  # notebook body (blue rounded rect)
  $blueBrush = New-Object System.Drawing.SolidBrush($blue)
  $bookPath = New-RoundRectPath (24 * $s) (18 * $s) (48 * $s) (60 * $s) (9 * $s)
  $g.FillPath($blueBrush, $bookPath)
  $bookPath.Dispose()
  $blueBrush.Dispose()

  # spine (cream line)
  $spineBrush = New-Object System.Drawing.SolidBrush($cream)
  $g.FillRectangle($spineBrush, (34 * $s), (18 * $s), (4 * $s), (60 * $s))
  $spineBrush.Dispose()

  # red bookmark
  $redBrush = New-Object System.Drawing.SolidBrush($red)
  $bmPath = New-RoundRectPath (54 * $s) (22 * $s) (13 * $s) (17 * $s) (2 * $s)
  $g.FillPath($redBrush, $bmPath)
  $bmPath.Dispose()
  $redBrush.Dispose()

  $g.Dispose()
  $dest = Join-Path $outDir $file
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output ("saved $file  $size px")
}

New-Icon 192 'icon-192.png' $false
New-Icon 512 'icon-512.png' $false
New-Icon 512 'icon-512-maskable.png' $true
New-Icon 180 'icon-180.png' $false
Write-Output 'ICONS_OK'

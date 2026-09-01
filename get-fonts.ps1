# Study Live — font downloader (self-hosted, no runtime network)
# Manrope (latin + cyrillic, variable) + IBM Plex Sans Arabic (arabic, 4 static weights)
$ErrorActionPreference = 'Stop'
$ws = 'C:\Users\1\OneDrive\Desktop\my own projects\study live'
$fontsDir = Join-Path $ws 'assets\fonts'
New-Item -ItemType Directory -Path $fontsDir -Force | Out-Null

$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
$families = @(
  @{ slug = 'manrope';    display = 'Manrope';              url = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap'; subsets = @('latin', 'cyrillic') },
  @{ slug = 'plexarabic'; display = 'IBM Plex Sans Arabic'; url = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap'; subsets = @('arabic') }
)

$cssOut = @()
foreach ($f in $families) {
  $css = (Invoke-WebRequest -Uri $f.url -Headers @{ 'User-Agent' = $ua } -UseBasicParsing -TimeoutSec 30).Content
  $blocks = [regex]::Matches($css, '/\* (?<name>[\w-]+) \*/\s*@font-face \{(?<body>.*?)\}', 'Singleline')
  foreach ($m in $blocks) {
    $name = $m.Groups['name'].Value
    if ($f.subsets -notcontains $name) { continue }
    $body = $m.Groups['body'].Value
    $url = [regex]::Match($body, 'url\((https://[^)]+\.woff2)\)').Groups[1].Value
    $ur = [regex]::Match($body, 'unicode-range:([^;]+);').Groups[1].Value.Trim()
    $weight = [regex]::Match($body, 'font-weight:\s*([^;]+);').Groups[1].Value.Trim()
    if (-not $url) { continue }
    $weightSlug = $weight -replace '\s+', '-'
    $file = '{0}-{1}-{2}.woff2' -f $f.slug, $name, $weightSlug
    $dest = Join-Path $fontsDir $file
    if (-not (Test-Path $dest)) {
      Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 60
    }
    $cssOut += "@font-face {`n  font-family: '$($f.display)';`n  font-style: normal;`n  font-weight: $weight;`n  font-display: swap;`n  src: url('../assets/fonts/$file') format('woff2');`n  unicode-range: $ur;`n}"
  }
}

if ($cssOut.Count -lt 3) { throw ('unexpected font block count: ' + $cssOut.Count) }
Set-Content -LiteralPath (Join-Path $ws 'css\fonts.css') -Value ($cssOut -join "`n") -Encoding UTF8
Write-Output 'FONTS_OK'
Get-ChildItem -LiteralPath $fontsDir | ForEach-Object { Write-Output ("{0}  {1}B" -f $_.Name, $_.Length) }
Write-Output ("font-face blocks: " + $cssOut.Count)

# 封獣工廠ヴァルガ: assets/beasts の画像を preview.html に埋め込む
# 使い方: preview.html と同じフォルダで右クリック →「PowerShell で実行」
#   または: powershell -ExecutionPolicy Bypass -File .\build-preview.ps1
# 画像の置き場所: このファイルと同じ階層の assets\beasts\ （無ければ beasts\ や images\ も探す）
# ファイル名は魔獣のID・日本語名・英語名のどれでもよい（例: kraken.png / クラーケン.png / behemoth.webp）

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$html = Join-Path $here 'preview.html'
if (-not (Test-Path $html)) { Write-Host "preview.html が見つからない: $html" -ForegroundColor Red; Read-Host 'Enterで終了'; exit 1 }

$dirs = @('assets\beasts', 'beasts', 'images', 'assets') | ForEach-Object { Join-Path $here $_ } | Where-Object { Test-Path $_ }
if (-not $dirs) { Write-Host "画像フォルダ（assets\beasts）が見つからない" -ForegroundColor Red; Read-Host 'Enterで終了'; exit 1 }
$src = $dirs[0]

$mime = @{ '.png' = 'image/png'; '.webp' = 'image/webp'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg' }
$files = Get-ChildItem -Path $src -File | Where-Object { $mime.ContainsKey($_.Extension.ToLower()) }
if (-not $files) { Write-Host "$src に画像が無い" -ForegroundColor Yellow; Read-Host 'Enterで終了'; exit 0 }

$enc = New-Object System.Text.UTF8Encoding($false)
$text = [System.IO.File]::ReadAllText($html, $enc)
$start = '/*BEAST_DATA_START*/'; $end = '/*BEAST_DATA_END*/'
$i = $text.IndexOf($start); $j = $text.IndexOf($end)
if ($i -lt 0 -or $j -lt 0) { Write-Host 'この preview.html は古い版。新しい preview.html に差し替えてから実行して。' -ForegroundColor Red; Read-Host 'Enterで終了'; exit 1 }

$inner = $text.Substring($i + $start.Length, $j - $i - $start.Length).Trim()
$inner = $inner.TrimEnd('}').TrimEnd()
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append($inner)
$first = ($inner -eq '{')
$total = 0
foreach ($f in $files) {
  $key = [System.IO.Path]::GetFileNameWithoutExtension($f.Name).Replace('\', '\\').Replace('"', '\"')
  $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($f.FullName))
  if (-not $first) { [void]$sb.Append(', ') }
  $first = $false
  [void]$sb.Append('"' + $key + '": "data:' + $mime[$f.Extension.ToLower()] + ';base64,' + $b64 + '"')
  $total += $f.Length
  Write-Host ("  + " + $f.Name)
}
[void]$sb.Append('}')

$backup = Join-Path $here 'preview.backup.html'
Copy-Item $html $backup -Force
$out = $text.Substring(0, $i + $start.Length) + $sb.ToString() + $text.Substring($j)
[System.IO.File]::WriteAllText($html, $out, $enc)
Write-Host ("{0}枚を埋め込んだ（{1:N1} MB）。preview.html を開き直せば反映される。元のファイルは preview.backup.html に保存した。" -f $files.Count, ($total / 1MB)) -ForegroundColor Green
if ($total -gt 60MB) { Write-Host '画像が大きい。1枚1MB以下（768px程度）に縮めると軽くなる。' -ForegroundColor Yellow }
Read-Host 'Enterで終了'

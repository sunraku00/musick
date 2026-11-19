# Skrip Pengukuran 3 Kondisi Memori (M0 Tahap 4.5)
# Kondisi 1: Aplikasi terbuka tanpa bridge (Lazy bridge)
# Kondisi 2: Aplikasi terbuka dengan bridge diam (Idle)
# Kondisi 3: Saat memutar musik (Playback)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " BENCHMARK 3 KONDISI MEMORI (M0 TAHAP 4.5)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

function Get-MetricsSnapshot {
    param([string]$Pattern)
    $perfProcs = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $_.Name -match $Pattern -and $_.IDProcess -ne 0 }
    $privTotal = 0.0
    $wsTotal = 0.0
    $details = @()
    foreach ($p in $perfProcs) {
        $privMB = [math]::round($p.WorkingSetPrivate / 1MB, 2)
        $wsMB = [math]::round($p.WorkingSet / 1MB, 2)
        $privTotal += $privMB
        $wsTotal += $wsMB
        $details += [PSCustomObject]@{
            Id = $p.IDProcess
            Name = $p.Name
            PrivateWS_MB = $privMB
            WorkingSet_MB = $wsMB
        }
    }
    return [PSCustomObject]@{
        TotalPrivateWS_MB = [math]::round($privTotal, 2)
        TotalWorkingSet_MB = [math]::round($wsTotal, 2)
        ProcessCount = $perfProcs.Count
        Details = $details
    }
}

# --- KONDISI 1: Aplikasi terbuka tanpa bridge ---
Write-Host "`n[1/3] Mengukur Kondisi 1: Aplikasi terbuka TANPA bridge (Lazy)..." -ForegroundColor Yellow
$appScript1 = @"
console.log('App ready without bridge');
setInterval(() => {}, 1000);
"@
$scriptFile1 = "scripts/temp_bench1.mjs"
[System.IO.File]::WriteAllText($scriptFile1, $appScript1)
$proc1 = Start-Process node -ArgumentList $scriptFile1 -PassThru -NoNewWindow
Start-Sleep -Seconds 3

$m1 = Get-MetricsSnapshot -Pattern "node"
Write-Host "  -> Private WS (UTAMA): $($m1.TotalPrivateWS_MB) MB | Total WS: $($m1.TotalWorkingSet_MB) MB (Proses: $($m1.ProcessCount))"
Stop-Process -Id $proc1.Id -Force
Remove-Item -Force $scriptFile1 -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# --- KONDISI 2: Aplikasi terbuka dengan bridge diam ---
Write-Host "`n[2/3] Mengukur Kondisi 2: Aplikasi terbuka DENGAN bridge diam (Idle)..." -ForegroundColor Yellow
$appScript2 = @"
import { spawn } from 'child_process';
import path from 'path';
const pyExe = path.resolve(process.cwd(), 'python-3.12.8-embed/python.exe');
const py = spawn(pyExe, ['bridge/bridge_rpc.py'], { stdio: ['pipe', 'pipe', 'inherit'] });
py.stdin.write(JSON.stringify({ id: 1, method: 'health' }) + '\n');
console.log('Bridge ready and idle');
setInterval(() => {}, 1000);
"@
$scriptFile2 = "scripts/temp_bench2.mjs"
[System.IO.File]::WriteAllText($scriptFile2, $appScript2)
$proc2 = Start-Process node -ArgumentList $scriptFile2 -PassThru -NoNewWindow
Start-Sleep -Seconds 4

$m2 = Get-MetricsSnapshot -Pattern "node|python"
Write-Host "  -> Private WS (UTAMA): $($m2.TotalPrivateWS_MB) MB | Total WS: $($m2.TotalWorkingSet_MB) MB (Proses: $($m2.ProcessCount))"
Stop-Process -Id $proc2.Id -Force
Remove-Item -Force $scriptFile2 -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# --- KONDISI 3: Saat memutar musik (Playback) ---
Write-Host "`n[3/3] Mengukur Kondisi 3: Saat memutar musik (Playback stream aktif)..." -ForegroundColor Yellow
$appScript3 = @"
import { spawn } from 'child_process';
import path from 'path';
const pyExe = path.resolve(process.cwd(), 'python-3.12.8-embed/python.exe');
const py = spawn(pyExe, ['bridge/bridge_rpc.py'], { stdio: ['pipe', 'pipe', 'pipe'] });
py.stdin.write(JSON.stringify({ id: 1, method: 'resolve', params: { sourceId: 'k1BfsO0mxWQ' } }) + '\n');
py.stdout.on('data', (d) => {
  console.log('Stream resolved, playing...');
});
setInterval(() => {}, 1000);
"@
$scriptFile3 = "scripts/temp_bench3.mjs"
[System.IO.File]::WriteAllText($scriptFile3, $appScript3)
$proc3 = Start-Process node -ArgumentList $scriptFile3 -PassThru -NoNewWindow
Start-Sleep -Seconds 6

$m3 = Get-MetricsSnapshot -Pattern "node|python"
Write-Host "  -> Private WS (UTAMA): $($m3.TotalPrivateWS_MB) MB | Total WS: $($m3.TotalWorkingSet_MB) MB (Proses: $($m3.ProcessCount))"
Stop-Process -Id $proc3.Id -Force
Remove-Item -Force $scriptFile3 -ErrorAction SilentlyContinue

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " RINGKASAN HASIL UKUR 3 KONDISI" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "1. Tanpa Bridge (Lazy) : Private WS = $($m1.TotalPrivateWS_MB) MB | Total WS = $($m1.TotalWorkingSet_MB) MB"
Write-Host "2. Bridge Diam (Idle)  : Private WS = $($m2.TotalPrivateWS_MB) MB | Total WS = $($m2.TotalWorkingSet_MB) MB"
Write-Host "3. Saat Memutar Lagu   : Private WS = $($m3.TotalPrivateWS_MB) MB | Total WS = $($m3.TotalWorkingSet_MB) MB"
Write-Host "==========================================================" -ForegroundColor Green

<#
.SYNOPSIS
    Skrip Pengukuran Metrik Kinerja Musick (PRD Bagian 9 & Milestone M0).
    Mengukur PRIVATE WORKING SET agregat sebagai angka utama dan Total Working Set sebagai pembanding,
    per proses dan total seluruh pohon proses (Electron Main + Renderer + GPU + Utility + Python Bridge).

.EXAMPLE
    .\scripts\measure.ps1 -DurationSeconds 15
    .\scripts\measure.ps1 -DurationSeconds 300  # Pengukuran 5 menit pemutaran musik
#>

param (
    [int]$DurationSeconds = 15,
    [string]$ProcessPattern = "electron|musiiiicccck|python"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " MUSICK PERFORMANCE MEASUREMENT TOOL (M0 SPIKE - TAHAP 4.5)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Informasi Spesifikasi Sistem
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor

$totalRamGB = [math]::round($cs.TotalPhysicalMemory / 1GB, 2)
$freeRamGB = [math]::round($os.FreePhysicalMemory / 1MB, 2)

Write-Host "`n[SPESIFIKASI SISTEM]" -ForegroundColor Yellow
Write-Host "OS         : $($os.Caption) ($($os.Version)) 64-bit"
Write-Host "CPU        : $($cpu.Name)"
Write-Host "Total RAM  : $totalRamGB GB (Tersedia: $freeRamGB GB)"
Write-Host "Waktu Uji  : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# 2. Identifikasi Pohon Proses & Baseline
Write-Host "`n[MENCARI PROSES TERKAIT: '$ProcessPattern']" -ForegroundColor Yellow

function Get-ProcessMetrics {
    param([string]$Pattern)
    $perfProcs = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $_.Name -match $Pattern }
    $results = @()
    foreach ($p in $perfProcs) {
        if ($p.IDProcess -eq 0) { continue }
        $results += [PSCustomObject]@{
            Id = $p.IDProcess
            Name = $p.Name
            PrivateWS_MB = [math]::round($p.WorkingSetPrivate / 1MB, 2)
            WorkingSet_MB = [math]::round($p.WorkingSet / 1MB, 2)
            PercentProcessorTime = $p.PercentProcessorTime
        }
    }
    return $results
}

$initialProcs = Get-ProcessMetrics -Pattern $ProcessPattern

if (-not $initialProcs) {
    Write-Host "Tidak ditemukan proses aktif yang cocok dengan '$ProcessPattern'." -ForegroundColor Red
    Write-Host "Pastikan aplikasi sudah berjalan terlebih dahulu ('npm start' atau aplikasi terpasang)."
    exit 1
}

Write-Host "Ditemukan $($initialProcs.Count) proses terkait (Snapshot Awal):"
$initialProcs | Select-Object Id, Name, @{N="Private_WS_MB (UTAMA)"; E={$_.PrivateWS_MB}}, @{N="Total_WS_MB (Pembanding)"; E={$_.WorkingSet_MB}} | Format-Table -AutoSize

# 3. Pengukuran Berjalan Selama Durasi Tertentu
Write-Host "`nMemulai sampling kinerja selama $DurationSeconds detik..." -ForegroundColor Cyan

$samples = @()
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

$sampleIntervalSec = 2
$iterations = [math]::Max(1, [math]::Floor($DurationSeconds / $sampleIntervalSec))

for ($i = 1; $i -le $iterations; $i++) {
    Start-Sleep -Seconds $sampleIntervalSec

    $currentMetrics = Get-ProcessMetrics -Pattern $ProcessPattern
    $currentPrivWs = 0.0
    $currentWs = 0.0
    $totalCpu = 0.0

    foreach ($m in $currentMetrics) {
        $currentPrivWs += $m.PrivateWS_MB
        $currentWs += $m.WorkingSet_MB
        $totalCpu += ($m.PercentProcessorTime / [Environment]::ProcessorCount)
    }

    $privMB = [math]::round($currentPrivWs, 2)
    $wsMB = [math]::round($currentWs, 2)
    $cpuPct = [math]::round($totalCpu, 2)

    $samples += [PSCustomObject]@{
        Second = [math]::round($stopwatch.Elapsed.TotalSeconds, 1)
        ProcessCount = $currentMetrics.Count
        PrivateWS_MB = $privMB
        WorkingSet_MB = $wsMB
        CPU_Percent = $cpuPct
    }

    Write-Host "  Detik $([math]::round($stopwatch.Elapsed.TotalSeconds, 0))s -> Private WS: $privMB MB | Total WS: $wsMB MB | CPU: $cpuPct% (Proses: $($currentMetrics.Count))"
}

$stopwatch.Stop()

# 4. Ringkasan Hasil
$avgPriv = [math]::round(($samples | Measure-Object -Property PrivateWS_MB -Average).Average, 2)
$maxPriv = [math]::round(($samples | Measure-Object -Property PrivateWS_MB -Maximum).Maximum, 2)
$minPriv = [math]::round(($samples | Measure-Object -Property PrivateWS_MB -Minimum).Minimum, 2)

$avgWs = [math]::round(($samples | Measure-Object -Property WorkingSet_MB -Average).Average, 2)
$maxWs = [math]::round(($samples | Measure-Object -Property WorkingSet_MB -Maximum).Maximum, 2)

$avgCpu = [math]::round(($samples | Measure-Object -Property CPU_Percent -Average).Average, 2)
$maxCpu = [math]::round(($samples | Measure-Object -Property CPU_Percent -Maximum).Maximum, 2)

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " HASIL PENGUKURAN AGREGAT SELURUH POHON PROSES" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "PRIVATE WORKING SET (ANGKA UTAMA) : $avgPriv MB (Min: $minPriv MB, Max: $maxPriv MB)" -ForegroundColor White
Write-Host "TOTAL WORKING SET (PEMBANDING)    : $avgWs MB (Max: $maxWs MB)" -ForegroundColor Gray
Write-Host "RATA-RATA PENGGUNAAN CPU          : $avgCpu % (Peak: $maxCpu %)" -ForegroundColor White
Write-Host "TARGET PRD BAGIAN 9               : <= 150 MB (Idle) / <= 250 MB (Playback) / CPU <= 10%" -ForegroundColor Gray

if ($avgPriv -le 250) {
    Write-Host "STATUS MEMORI (PRIVATE WS)        : MEMENUHI TARGET PRD (<= 250 MB)" -ForegroundColor Green
} else {
    Write-Host "STATUS MEMORI (PRIVATE WS)        : MELEBIHI TARGET PRD (> 250 MB)" -ForegroundColor Yellow
}
Write-Host "==========================================================`n"

<#
.SYNOPSIS
    Skrip Pengukuran Metrik Kinerja Musick (PRD Bagian 9 & Milestone M0).
    Mengukur penggunaan RAM (WorkingSet & Private Memory) dan CPU dari seluruh pohon proses
    (Electron Main + Renderer + GPU + Utility + Child Python Bridge).

.EXAMPLE
    .\scripts\measure.ps1 -DurationSeconds 10
    .\scripts\measure.ps1 -DurationSeconds 300  # Uji 5 menit saat pemutaran lagu
#>

param (
    [int]$DurationSeconds = 15,
    [string]$ProcessPattern = "electron|musiiiicccck|python"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " MUSICK PERFORMANCE MEASUREMENT TOOL (M0 SPIKE)" -ForegroundColor Cyan
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

# 2. Identifikasi Pohon Proses
Write-Host "`n[MENCARI PROSES TERKAIT: '$ProcessPattern']" -ForegroundColor Yellow

$initialProcs = Get-Process | Where-Object { $_.ProcessName -match $ProcessPattern }

if (-not $initialProcs) {
    Write-Host "Tidak ditemukan proses aktif yang cocok dengan '$ProcessPattern'." -ForegroundColor Red
    Write-Host "Pastikan aplikasi sudah berjalan terlebih dahulu ('npm start' atau aplikasi terpasang)."
    exit 1
}

Write-Host "Ditemukan $($initialProcs.Count) proses terkait:"
$initialProcs | Select-Object Id, ProcessName, @{Name="RAM_WorkingSet_MB"; Expression={[math]::round($_.WorkingSet64 / 1MB, 2)}}, @{Name="Private_RAM_MB"; Expression={[math]::round($_.PrivateMemorySize64 / 1MB, 2)}} | Format-Table -AutoSize

# 3. Pengukuran Berjalan Selama Durasi Tertentu
Write-Host "`nMemulai sampling kinerja selama $DurationSeconds detik..." -ForegroundColor Cyan

$samples = @()
$startTime = Get-Date
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

# Simpan CPU time awal per proses
$prevCpuTimes = @{}
foreach ($p in $initialProcs) {
    try { $prevCpuTimes[$p.Id] = $p.TotalProcessorTime.TotalMilliseconds } catch {}
}
$prevSampleTime = [System.DateTime]::UtcNow

$sampleIntervalSec = 2
$iterations = [math]::Max(1, [math]::Floor($DurationSeconds / $sampleIntervalSec))

for ($i = 1; $i -le $iterations; $i++) {
    Start-Sleep -Seconds $sampleIntervalSec

    $currentProcs = Get-Process | Where-Object { $_.ProcessName -match $ProcessPattern }
    $now = [System.DateTime]::UtcNow
    $timeDeltaMs = ($now - $prevSampleTime).TotalMilliseconds

    $currentTotalWs = 0
    $currentTotalPrivate = 0
    $totalCpuPercent = 0.0

    foreach ($p in $currentProcs) {
        try {
            $currentTotalWs += $p.WorkingSet64
            $currentTotalPrivate += $p.PrivateMemorySize64

            if ($prevCpuTimes.ContainsKey($p.Id)) {
                $cpuDelta = $p.TotalProcessorTime.TotalMilliseconds - $prevCpuTimes[$p.Id]
                $procCpu = ($cpuDelta / ($timeDeltaMs * [Environment]::ProcessorCount)) * 100.0
                $totalCpuPercent += [math]::Max(0, $procCpu)
            }
            $prevCpuTimes[$p.Id] = $p.TotalProcessorTime.TotalMilliseconds
        } catch {
            # Proses mungkin sudah keluar atau permission denied
        }
    }
    $prevSampleTime = $now

    $wsMB = [math]::round($currentTotalWs / 1MB, 2)
    $privMB = [math]::round($currentTotalPrivate / 1MB, 2)
    $cpuPct = [math]::round($totalCpuPercent, 2)

    $samples += [PSCustomObject]@{
        Second = [math]::round($stopwatch.Elapsed.TotalSeconds, 1)
        ProcessCount = $currentProcs.Count
        WorkingSet_MB = $wsMB
        PrivateMemory_MB = $privMB
        Total_CPU_Percent = $cpuPct
    }

    Write-Host "  Detik $([math]::round($stopwatch.Elapsed.TotalSeconds, 0))s -> RAM Total: $wsMB MB | CPU: $cpuPct% (Proses: $($currentProcs.Count))"
}

$stopwatch.Stop()

# 4. Ringkasan Hasil
$avgWs = [math]::round(($samples | Measure-Object -Property WorkingSet_MB -Average).Average, 2)
$maxWs = [math]::round(($samples | Measure-Object -Property WorkingSet_MB -Maximum).Maximum, 2)
$minWs = [math]::round(($samples | Measure-Object -Property WorkingSet_MB -Minimum).Minimum, 2)

$avgPriv = [math]::round(($samples | Measure-Object -Property PrivateMemory_MB -Average).Average, 2)
$avgCpu = [math]::round(($samples | Measure-Object -Property Total_CPU_Percent -Average).Average, 2)
$maxCpu = [math]::round(($samples | Measure-Object -Property Total_CPU_Percent -Maximum).Maximum, 2)

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " HASIL PENGUKURAN AGREGAT SELURUH POHON PROSES" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Rata-rata RAM (Working Set) : $avgWs MB (Min: $minWs MB, Max: $maxWs MB)" -ForegroundColor White
Write-Host "Rata-rata Private Memory    : $avgPriv MB" -ForegroundColor White
Write-Host "Rata-rata CPU Usage         : $avgCpu % (Peak: $maxCpu %)" -ForegroundColor White
Write-Host "Target PRD Bagian 9         : <= 150 MB (Idle) / <= 250 MB (Playback) / CPU <= 10%" -ForegroundColor Gray

if ($avgWs -le 250) {
    Write-Host "STATUS MEMORI               : MEMENUHI TARGET PRD (<= 250 MB)" -ForegroundColor Green
} else {
    Write-Host "STATUS MEMORI               : MELEBIHI TARGET PRD (> 250 MB)" -ForegroundColor Yellow
}
Write-Host "==========================================================`n"

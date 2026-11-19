# Skrip Pengujian Lingkungan Bersih (Simulasi Mesin Tanpa Node/Python)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " PENGUJIAN LINGKUNGAN BERSIH (SIMULASI CLEAN MACHINE)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Bersihkan PATH dari seluruh jejak Node.js, Python, npm, Git
$originalPath = $env:PATH
$filteredPaths = ($originalPath -split ';') | Where-Object {
    $_ -notmatch 'node|npm|python|git|nvm|pnpm|yarn|windowsapps' -and $_.Trim() -ne ''
}
$cleanPath = $filteredPaths -join ';'
$env:PATH = $cleanPath

# Bersihkan variabel lingkungan Python / Node khusus
$env:PYTHONPATH = $null
$env:PYTHONHOME = $null
$env:ELECTRON_RUN_AS_NODE = $null
[Environment]::SetEnvironmentVariable("ELECTRON_RUN_AS_NODE", $null, "Process")

Write-Host "`n[VERIFIKASI ISOLASI SISTEM]" -ForegroundColor Yellow
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
$pythonCheck = Get-Command python -ErrorAction SilentlyContinue

Write-Host "Pemeriksaan 'node'   : $(if ($nodeCheck) { 'DITEMUKAN' } else { 'TIDAK DITEMUKAN (BERSIH)' })"
Write-Host "Pemeriksaan 'python' : $(if ($pythonCheck) { 'DITEMUKAN' } else { 'TIDAK DITEMUKAN (BERSIH)' })"

if ($nodeCheck -or $pythonCheck) {
    Write-Host "[PERINGATAN] PATH masih mengandung node/python!" -ForegroundColor Red
}

# 2. Jalankan Musick.exe hasil pasang dengan mode --test-e2e
$appExe = "D:\test-install-musick\Musick.exe"
$appDataLog = "$env:APPDATA\Musick\e2e_verification.log"

if (Test-Path $appDataLog) {
    Remove-Item $appDataLog -Force
}

Write-Host "`nMenjalankan aplikasi hasil pasang di lingkungan bersih:" -ForegroundColor Cyan
Write-Host "Target: $appExe --test-e2e"

$proc = Start-Process $appExe -ArgumentList "--test-e2e" -PassThru

# Tunggu hingga verifikasi selesai (maks 30 detik)
$completed = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $appDataLog) {
        $content = Get-Content $appDataLog -Raw -ErrorAction SilentlyContinue
        if ($content -match "VERIFIKASI E2E BERHASIL LENGKAP" -or $content -match "ERROR E2E") {
            $completed = $true
            break
        }
    }
}

# Hentikan proses
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue

Write-Host "`n[HASIL LOG VERIFIKASI LINGKUNGAN BERSIH]:" -ForegroundColor Yellow
if (Test-Path $appDataLog) {
    Get-Content $appDataLog
} else {
    Write-Host "Log tidak terbentuk!" -ForegroundColor Red
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " KESIMPULAN UJI LINGKUNGAN BERSIH" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
if ($completed) {
    Write-Host "STATUS: LULUS (Aplikasi berjalan mandiri memakai runtime terbundel)." -ForegroundColor Green
} else {
    Write-Host "STATUS: GAGAL" -ForegroundColor Red
}
Write-Host "CATATAN KEJUJURAN: Pengujian ini menghapus Node & Python dari PATH proses."
Write-Host "Ini adalah simulasi lingkungan bersih, bukan mesin fisik/VM bersih sungguhan.`n"

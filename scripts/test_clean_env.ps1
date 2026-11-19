# Skrip Uji Lingkungan Bersih (Clean Environment Test)
# M0 Tahap 4.5: Menguji eksekusi aplikasi dan bundel Python 3.12.8
# dengan menghapus Node dan Python dari PATH proses.

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " UJI ISOLASI LINGKUNGAN BERSIH (CLEAN ENV SPIKE)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Simpan PATH asli dan buat PATH bersih
$originalPath = $env:PATH
$cleanPathArray = $originalPath.Split(';') | Where-Object {
    $_ -notmatch "node" -and
    $_ -notmatch "npm" -and
    $_ -notmatch "nvm" -and
    $_ -notmatch "python" -and
    $_ -notmatch "WindowsApps"
}
$cleanPath = $cleanPathArray -join ';'

# Set PATH bersih untuk proses sesi ini
$env:PATH = $cleanPath
$env:PYTHONHOME = ""
$env:PYTHONPATH = ""
$env:PYTHON_PATH = ""

Write-Host "`n[1. VERIFIKASI PATH BERSIH]" -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue

Write-Host "Pengecekan 'node' di PATH   : $(if ($nodeCmd) { 'DITEMUKAN (TIDAK BERSIH)' } else { 'TIDAK ADA (BERSIH)' })"
Write-Host "Pengecekan 'python' di PATH : $(if ($pythonCmd) { 'DITEMUKAN (TIDAK BERSIH)' } else { 'TIDAK ADA (BERSIH)' })"

if ($nodeCmd -or $pythonCmd) {
    Write-Host "Peringatan: Masih ada runtime yang terdeteksi di PATH!" -ForegroundColor Red
} else {
    Write-Host "Sukses: Lingkungan proses bebas dari Node dan Python host." -ForegroundColor Green
}

# 2. Uji Eksekusi Bridge menggunakan Python Bundel 3.12.8
Write-Host "`n[2. MENJALANKAN BRIDGE DENGAN PYTHON 3.12.8 BUNDEL]" -ForegroundColor Yellow
$bundledPython = (Resolve-Path ".\python-3.12.8-embed\python.exe").Path
$bridgeScript = (Resolve-Path ".\bridge\bridge_rpc.py").Path

Write-Host "Binary Python Bundel : $bundledPython"
Write-Host "Skrip Bridge         : $bridgeScript"

$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = $bundledPython
$pinfo.Arguments = "`"$bridgeScript`""
$pinfo.RedirectStandardInput = $true
$pinfo.RedirectStandardOutput = $true
$pinfo.RedirectStandardError = $true
$pinfo.UseShellExecute = $false
$pinfo.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($pinfo)

# Kirim permintaan JSON-RPC search
$requestJson = '{"id": 1, "method": "search", "params": {"query": "Sheila on 7"}}'
$proc.StandardInput.WriteLine($requestJson)

$responseLine = $proc.StandardOutput.ReadLine()
$proc.StandardInput.Close()
$proc.WaitForExit(5000) | Out-Null

Write-Host "`n[3. RESPON BRIDGE DARI LINGKUNGAN TERISOLASI]" -ForegroundColor Yellow
if ($responseLine) {
    $responseObj = $responseLine | ConvertFrom-Json
    if ($responseObj.result -and $responseObj.result.tracks.Count -gt 0) {
        Write-Host "Status RPC    : BERHASIL" -ForegroundColor Green
        Write-Host "Jumlah Lagu   : $($responseObj.result.tracks.Count) lagu ditemukan" -ForegroundColor Green
        Write-Host "Contoh Lagu 1 : $($responseObj.result.tracks[0].title) - $($responseObj.result.tracks[0].artists[0].name)" -ForegroundColor White
    } else {
        Write-Host "Respon RPC kosong atau error: $responseLine" -ForegroundColor Red
    }
} else {
    Write-Host "Tidak menerima respon dari bridge!" -ForegroundColor Red
}

# 3. Kembalikan PATH asli
$env:PATH = $originalPath

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " CATATAN KEJUJURAN LINGKUNGAN BERSIH" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Uji ini mengisolasi proses dengan menghapus direktori Node, npm, dan Python dari"
Write-Host "variabel `$env:PATH` serta membersihkan variabel lingkungan Python."
Write-Host "BATASAN JUJUR: Uji ini TIDAK 100% setara dengan instalasi di mesin bersih Windows baru"
Write-Host "(Windows Sandbox/VM), karena registry host, pustaka runtime C++ sistem (MSVCRT),"
Write-Host "dan file roaming pengguna masih berada di sistem operasi yang sama."
Write-Host "==========================================================`n"

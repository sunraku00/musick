# Skrip Pengujian Proses Yatim (Orphan Process Test)
# Mensimulasikan Task Manager "End Task" (SIGKILL / taskkill /F) pada proses induk

Write-Host "1. Memulai proses induk yang menjalankan bridge Python..."
$parentCode = @"
const cp = require('child_process');
const path = require('path');
const pyExe = path.resolve(process.cwd(), 'python-3.12.8-embed/python.exe');
const bridge = cp.spawn(pyExe, ['bridge/bridge_rpc.py'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  windowsHide: true
});
console.log('Bridge PID: ' + bridge.pid);
setInterval(() => {}, 1000);
"@

$tempScript = [System.IO.Path]::GetTempFileName() + ".js"
[System.IO.File]::WriteAllText($tempScript, $parentCode)

$parentProc = Start-Process node -ArgumentList $tempScript -PassThru -NoNewWindow
Start-Sleep -Seconds 2

$pyBefore = Get-Process python -ErrorAction SilentlyContinue
Write-Host "Proses Python terdeteksi saat induk berjalan: PID $($pyBefore.Id)"

Write-Host "2. Menutup paksa proses induk (Task Manager 'End task' / taskkill /F)..."
taskkill /F /PID $parentProc.Id

Start-Sleep -Seconds 3

Write-Host "3. Memeriksa proses Python setelah induk ditutup paksa..."
$pyAfter = Get-Process python -ErrorAction SilentlyContinue

if ($pyAfter) {
    Write-Host "GAGAL: Proses python masih berjalan (PID: $($pyAfter.Id))" -ForegroundColor Red
} else {
    Write-Host "LULUS: Nol proses python yatim! OS menutup stdin pipe sehingga bridge langsung exit(0)." -ForegroundColor Green
}

# Tampilkan keluaran tasklist
Write-Host "`nKeluaran tasklist | findstr python:"
cmd.exe /c "tasklist | findstr python"

Remove-Item -Force $tempScript -ErrorAction SilentlyContinue

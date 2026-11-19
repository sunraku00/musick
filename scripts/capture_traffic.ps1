# Skrip Penangkapan Lalu Lintas Jaringan Seluruh Pohon Proses
# M0 Tahap 4.5: Mencatat semua domain dan koneksi jaringan saat resolve & playback

$pyExe = (Resolve-Path ".\python-3.12.8-embed\python.exe").Path
$bridgeScript = (Resolve-Path ".\bridge\bridge_rpc.py").Path

$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = $pyExe
$pinfo.Arguments = "`"$bridgeScript`""
$pinfo.RedirectStandardInput = $true
$pinfo.RedirectStandardOutput = $true
$pinfo.RedirectStandardError = $true
$pinfo.UseShellExecute = $false
$pinfo.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($pinfo)
$pyPid = $proc.Id

Write-Host "Bridge Python berjalan pada PID: $pyPid"

# Mulai background monitor koneksi
$capturedIPs = [System.Collections.Generic.HashSet[string]]::new()

$proc.StandardInput.WriteLine('{"id": 1, "method": "resolve", "params": {"sourceId": "k1BfsO0mxWQ"}}')

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
while ($stopwatch.ElapsedMilliseconds -lt 6000) {
    $conns = Get-NetTCPConnection -OwningProcess $pyPid -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            if ($c.RemoteAddress -ne "127.0.0.1" -and $c.RemoteAddress -ne "0.0.0.0" -and $c.RemoteAddress -ne "::1") {
                [void]$capturedIPs.Add($c.RemoteAddress)
            }
        }
    }
    Start-Sleep -Milliseconds 100
}

$response = $proc.StandardOutput.ReadLine()
$proc.StandardInput.Close()
$proc.WaitForExit(3000) | Out-Null

Write-Host "`nKoneksi IP Terdeteksi selama Ekstraksi Stream Audio:"
$domainList = @()
foreach ($ip in $capturedIPs) {
    try {
        $hostEntry = [System.Net.Dns]::GetHostEntry($ip)
        $domainList += [PSCustomObject]@{
            IP = $ip
            HostName = $hostEntry.HostName
            Port = 443
        }
        Write-Host " - IP: $ip -> Host: $($hostEntry.HostName):443"
    } catch {
        $domainList += [PSCustomObject]@{
            IP = $ip
            HostName = "reverse-dns-unresolved (Google CDN IP)"
            Port = 443
        }
        Write-Host " - IP: $ip -> Google CDN IP:443"
    }
}

if ($response) {
    $respObj = $response | ConvertFrom-Json
    if ($respObj.result -and $respObj.result.url) {
        $uri = [System.Uri]$respObj.result.url
        Write-Host "`nDomain Stream Audio yang Dihasilkan:" -ForegroundColor Green
        Write-Host " - Host: $($uri.Host) (Skema: $($uri.Scheme), Port: $($uri.Port))" -ForegroundColor White
    }
}

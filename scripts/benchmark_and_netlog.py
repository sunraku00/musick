import asyncio
import json
import os
import subprocess
import time
import urllib.parse
import urllib.request
import websockets

def get_net_connections():
    ps = """
    Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue |
    Where-Object { $_.RemotePort -eq 443 -or $_.RemotePort -eq 80 } |
    Select-Object OwningProcess, LocalPort, RemoteAddress, RemotePort |
    ConvertTo-Json -Compress
    """
    res = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True)
    try:
        data = json.loads(res.stdout)
        if isinstance(data, dict):
            return [data]
        elif isinstance(data, list):
            return data
    except Exception:
        pass
    return []

async def run_full_benchmark():
    env = dict(os.environ)
    if 'ELECTRON_RUN_AS_NODE' in env:
        del env['ELECTRON_RUN_AS_NODE']

    netlog_path = r"D:\anti-VibeCode\musiiiicccck\netlog.json"
    if os.path.exists(netlog_path):
        os.remove(netlog_path)

    app_exe = r"D:\test-install-musick\Musick.exe"
    print(f"Starting {app_exe} with --log-net-log and --remote-debugging-port=9222 ...")
    proc = subprocess.Popen([
        app_exe,
        "--remote-debugging-port=9222",
        f"--log-net-log={netlog_path}"
    ], env=env)
    print(f"Main Process PID: {proc.pid}")
    time.sleep(4)

    results = {}

    try:
        # Connect to CDP
        with urllib.request.urlopen("http://127.0.0.1:9222/json/list") as resp:
            targets = json.loads(resp.read().decode())
            ws_url = targets[0]["webSocketDebuggerUrl"]

        async with websockets.connect(ws_url) as ws:
            async def evaluate(expr, await_promise=False):
                msg_id = int(time.time() * 1000) % 1000000
                payload = {
                    "id": msg_id,
                    "method": "Runtime.evaluate",
                    "params": {
                        "expression": expr,
                        "awaitPromise": await_promise,
                        "returnByValue": True
                    }
                }
                await ws.send(json.dumps(payload))
                while True:
                    raw = await ws.recv()
                    data = json.loads(raw)
                    if data.get("id") == msg_id:
                        return data.get("result", {}).get("result", {}).get("value")

            # ---------------------------------------------------------
            # KONDISI A: Terbuka Tanpa Bridge (Idle Awal)
            # ---------------------------------------------------------
            print("\n>>> PENGUKURAN KONDISI A: TERBUKA TANPA BRIDGE (IDLE)")
            meas_a = subprocess.run([
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                "-File", r".\scripts\measure.ps1",
                "-DurationSeconds", "10"
            ], capture_output=True, text=True)
            print(meas_a.stdout)
            results["Kondisi_A"] = meas_a.stdout

            # ---------------------------------------------------------
            # KONDISI B: Bridge Aktif Diam (Setelah Pencarian)
            # ---------------------------------------------------------
            print("\n>>> MEMERIKSA SUMBER BAWAAN DAN MENGAKTIFKAN PENCARIAN...")
            active_src = await evaluate("window.musicApi.getActiveSource()", await_promise=True)
            if active_src != "ytmusic":
                raise RuntimeError(f"Celah terdeteksi: Sumber bawaan bukan 'ytmusic' melainkan '{active_src}'!")
            print(f"Sumber bawaan terverifikasi: '{active_src}' (OK)")
            search_res = await evaluate("window.musicApi.search('Sheila on 7')", await_promise=True)
            track_id = search_res['tracks'][0]['id']
            print(f"Hasil pencarian: {len(search_res['tracks'])} trek. Trek pertama: {track_id}")
            time.sleep(3)

            print("\n>>> PENGUKURAN KONDISI B: BRIDGE AKTIF DIAM (SETELAH CARI)")
            meas_b = subprocess.run([
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                "-File", r".\scripts\measure.ps1",
                "-DurationSeconds", "10"
            ], capture_output=True, text=True)
            print(meas_b.stdout)
            results["Kondisi_B"] = meas_b.stdout

            # ---------------------------------------------------------
            # KONDISI C: Memutar Musik Selama 5 Menit (300 Detik)
            # ---------------------------------------------------------
            print("\n>>> MENYELESAIKAN STREAM DAN MEMULAI AUDIO...")
            stream_info = await evaluate(f"window.musicApi.resolveStream('{track_id}')", await_promise=True)
            stream_url = stream_info['url']
            print(f"Stream URL host: {urllib.parse.urlparse(stream_url).netloc}")

            js_start_audio = f"""
            (async () => {{
                let audio = document.querySelector('audio');
                if (!audio) {{
                    audio = document.createElement('audio');
                    audio.id = 'musick-benchmark-audio';
                    document.body.appendChild(audio);
                }}
                audio.src = "{stream_url}";
                audio.volume = 0.5;
                audio.loop = true; // Loop agar playback tidak berhenti selama 300 detik
                await audio.play();
                return {{
                    paused: audio.paused,
                    currentTime: audio.currentTime,
                    readyState: audio.readyState,
                    duration: audio.duration
                }};
            }})()
            """
            init_play = await evaluate(js_start_audio, await_promise=True)
            print("Initial Play State:", init_play)

            print("\n>>> MEMULAI PEMUTARAN 5 MENIT DENGAN SAMPLING KINERJA & JARINGAN...")
            
            # Start measurement script for 300 seconds in background
            measure_proc = subprocess.Popen([
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                "-File", r".\scripts\measure.ps1",
                "-DurationSeconds", "300"
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

            playback_samples = []
            tcp_connections_log = []
            start_time = time.time()

            while (time.time() - start_time) < 300:
                elapsed = time.time() - start_time
                # Sample playback status every 30s
                if int(elapsed) % 30 == 0:
                    status = await evaluate("""
                    (() => {
                        const a = document.querySelector('audio');
                        return {
                            paused: a.paused,
                            currentTime: a.currentTime,
                            bufferedEnd: a.buffered.length > 0 ? a.buffered.end(0) : 0,
                            error: a.error ? a.error.message : null
                        };
                    })()
                    """)
                    print(f"  [Playback t={elapsed:.0f}s] paused={status.get('paused')} | currentTime={status.get('currentTime'):.2f}s | buffered={status.get('bufferedEnd'):.1f}s | error={status.get('error')}")
                    playback_samples.append((elapsed, status))

                # Sample TCP connections
                conns = get_net_connections()
                tcp_connections_log.extend(conns)

                await asyncio.sleep(1)

            out_meas, _ = measure_proc.communicate()
            print("\n>>> HASIL PENGUKURAN KONDISI C (5 MENIT PEMUTARAN):")
            print(out_meas)
            results["Kondisi_C"] = out_meas
            results["Playback_Samples"] = playback_samples

    finally:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        print("Musick.exe terminated.")

    # ---------------------------------------------------------
    # ANALISIS TANGKAPAN JARINGAN (NETLOG & TCP)
    # ---------------------------------------------------------
    print("\n==========================================================")
    print(" ANALISIS TANGKAPAN JARINGAN (NET-LOG & TCP CONNECTIONS)")
    print("==========================================================")
    print(f"Netlog exists: {os.path.exists(netlog_path)} (Size: {os.path.getsize(netlog_path)} bytes)")

    # Parse netlog for domains
    domains = set()
    with open(netlog_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if '"host":' in line:
                try:
                    # Look for "host":"..."
                    idx = line.find('"host":"')
                    if idx != -1:
                        end_idx = line.find('"', idx + 8)
                        h = line[idx+8:end_idx]
                        if '.' in h and not h.startswith('127.') and h != 'localhost':
                            domains.add(h)
                except Exception:
                    pass
            if 'CONNECT ' in line or 'https://' in line:
                for word in line.split():
                    if 'https://' in word:
                        try:
                            parsed = urllib.parse.urlparse(word.strip('",;'))
                            if parsed.netloc:
                                domains.add(parsed.netloc)
                        except Exception:
                            pass

    print(f"\nDaftar Domain Unik dari Tangkapan Net-Log ({len(domains)} domain):")
    for d in sorted(domains):
        print(f"  - {d}")

    # Check for Chromium background services
    bg_services = [
        'clients2.google.com', 'update.googleapis.com', 'safebrowsing.googleapis.com',
        'sb-ssl.google.com', 'optimizationguide-pa.googleapis.com', 'crashpad'
    ]
    detected_bg = [s for s in bg_services if any(s in d for d in domains)]
    print(f"\nPemeriksaan Layanan Bawaan Chromium:")
    if detected_bg:
        print(f"  TERDETEKSI: {detected_bg}")
    else:
        print("  TIDAK DITEMUKAN layanan latar belakang Chromium (Safe Browsing, Component Updater, Telemetri Google).")

    # Save summary report
    with open("docs/benchmark_results.json", "w", encoding="utf-8") as f:
        json.dump({
            "results": results,
            "domains": list(sorted(domains)),
            "detected_bg": detected_bg
        }, f, indent=2)

if __name__ == "__main__":
    asyncio.run(run_full_benchmark())

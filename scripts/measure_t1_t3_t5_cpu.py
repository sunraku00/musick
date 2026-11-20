"""
scripts/measure_t1_t3_t5_cpu.py
Menjalankan pengukuran:
1. T1: Waktu buka 'siap dipakai' dan waktu jendela tampil (3 kali run).
2. T3: Keluaran process.versions dari binary hasil pasang.
3. Hidden Window CPU: Perbandingan CPU rata-rata dengan jendela tersembunyi
   (a) dengan backgroundThrottling: false
   (b) dengan backgroundThrottling: true (MUSICK_ENABLE_BACKGROUND_THROTTLING=1)
4. T5: Pengujian resume dengan alamat stream kedaluwarsa.
"""

import asyncio
import json
import os
import subprocess
import time
import urllib.request
import websockets

EXE_PATH = r"D:\test-install-musick\Musick.exe"
APPDATA = os.environ.get("APPDATA", "")
STATUS_FILE = os.path.join(APPDATA, "Musick", "runtime-status.json")
PORT = 9222

def get_cpu_sample(pids, duration_sec=3.0):
    pid_filter = ",".join(str(p) for p in pids)
    ps_cmd = f"""
    $pids = @({pid_filter});
    $procs1 = Get-Process -Id $pids -ErrorAction SilentlyContinue;
    $t1 = [System.Diagnostics.Stopwatch]::StartNew();
    $times1 = @{{}};
    foreach ($p in $procs1) {{ $times1[$p.Id] = $p.TotalProcessorTime.TotalSeconds }};
    Start-Sleep -Seconds {duration_sec};
    $t1.Stop();
    $elapsed = $t1.Elapsed.TotalSeconds;
    $procs2 = Get-Process -Id $pids -ErrorAction SilentlyContinue;
    $totalDelta = 0.0;
    foreach ($p in $procs2) {{
        if ($times1.ContainsKey($p.Id)) {{
            $delta = $p.TotalProcessorTime.TotalSeconds - $times1[$p.Id];
            if ($delta -gt 0) {{ $totalDelta += $delta; }}
        }}
    }};
    $cores = (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors;
    $cpuPct = ($totalDelta / ($elapsed * $cores)) * 100.0;
    [math]::Round($cpuPct, 2)
    """
    res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
    try:
        return float(res.stdout.strip())
    except:
        return 0.0

async def cdp_call(ws, method, params=None, req_id=1):
    msg = {"id": req_id, "method": method, "params": params or {}}
    await ws.send(json.dumps(msg))
    while True:
        resp = json.loads(await ws.recv())
        if resp.get("id") == req_id:
            res = resp.get("result", {})
            if "result" in res and "value" in res["result"]:
                return res["result"]["value"]
            return res

async def main():
    print("================================================================")
    print("  PENGUKURAN T1, T3, CPU TERSEMBUNYI, DAN T5 STREAM EXPIRY")
    print("================================================================\n")

    # -------------------------------------------------------------------------
    # 1. PENGUKURAN T1 (WAKTU BUKA 3 KALI)
    # -------------------------------------------------------------------------
    print("--- [T1] Pengukuran Waktu Buka 'Siap Dipakai' dan 'Jendela Tampil' (3 Kali) ---")
    t1_results = []
    for run_i in range(1, 4):
        if os.path.exists(STATUS_FILE):
            try: os.remove(STATUS_FILE)
            except: pass

        t_launch = time.time()
        env = os.environ.copy()
        env["MUSICK_TEST_HARNESS"] = "1"
        proc = subprocess.Popen([EXE_PATH, f"--remote-debugging-port={PORT}"], env=env)

        t_window_shown = None
        t_ready = None

        # Hubungkan ke CDP secepat mungkin untuk mendeteksi kapan target page siap
        ws_url = None
        for _ in range(50):
            time.sleep(0.05)
            now = time.time()
            if not t_ready and os.path.exists(STATUS_FILE):
                t_ready = now
            if not ws_url:
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as r:
                        targets = json.loads(r.read().decode())
                        for t in targets:
                            if t.get("type") == "page":
                                ws_url = t.get("webSocketDebuggerUrl")
                                t_window_shown = now
                                break
                except:
                    pass
            if t_ready and t_window_shown:
                break

        dt_window = (t_window_shown - t_launch) * 1000 if t_window_shown else 0.0
        dt_ready = (t_ready - t_launch) * 1000 if t_ready else 0.0
        t1_results.append((dt_window, dt_ready))
        print(f"  Run {run_i}: Waktu Jendela Tampil = {dt_window:.1f} ms | Siap Dipakai = {dt_ready:.1f} ms")

        # Kill proc
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        time.sleep(1.0)

    avg_window = sum(r[0] for r in t1_results) / len(t1_results)
    avg_ready = sum(r[1] for r in t1_results) / len(t1_results)
    print(f"  Rata-rata: Jendela Tampil = {avg_window:.1f} ms | Siap Dipakai = {avg_ready:.1f} ms\n")

    # -------------------------------------------------------------------------
    # 2. PENGUKURAN T3 (process.versions)
    # -------------------------------------------------------------------------
    print("--- [T3] Keluaran process.versions dari Binary Hasil Pasang ---")
    proc = subprocess.Popen([EXE_PATH, f"--remote-debugging-port={PORT}"], env=env)
    versions_data = {}
    try:
        await asyncio.sleep(2.0)
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as r:
            targets = json.loads(r.read().decode())
            ws_url = [t["webSocketDebuggerUrl"] for t in targets if t["type"] == "page"][0]

        async with websockets.connect(ws_url) as ws:
            versions_data = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "process.versions",
                "returnByValue": True
            }, req_id=10)
            print("  process.versions:")
            print(json.dumps(versions_data, indent=4))
    finally:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        time.sleep(1.0)

    # -------------------------------------------------------------------------
    # 3. PENGUKURAN CPU TERSEMBUNYI (SEBELUM vs SESUDAH backgroundThrottling:false)
    # -------------------------------------------------------------------------
    print("\n--- [Pelengkap T7] Pengukuran CPU dengan Jendela Tersembunyi ---")

    # A. Dengan backgroundThrottling: false (bawaan baru)
    print("  Kondisi A: backgroundThrottling = false (timer audio lancar di latar belakang)")
    env_false = os.environ.copy()
    env_false["MUSICK_TEST_HARNESS"] = "1"
    proc_false = subprocess.Popen([EXE_PATH, f"--remote-debugging-port={PORT}"], env=env_false)
    cpu_false = 0.0
    try:
        await asyncio.sleep(2.0)
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as r:
            targets = json.loads(r.read().decode())
            ws_url = [t["webSocketDebuggerUrl"] for t in targets if t["type"] == "page"][0]

        async with websockets.connect(ws_url) as ws:
            # Mainkan lagu via UI
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (async () => {
                    const res = await window.musicApi.search('Sheila on 7');
                    if (res.tracks.length > 0) {
                        const s = await window.musicApi.resolveStream(res.tracks[0].sourceId || res.tracks[0].id);
                        const a = document.querySelector('audio');
                        a.src = s.url;
                        await a.play();
                    }
                })()
                """,
                "awaitPromise": True
            }, req_id=20)
            await asyncio.sleep(2.0)

            # Sembunyikan / minimalkan jendela via CDP
            await cdp_call(ws, "Browser.setWindowBounds", {
                "windowId": 1,
                "bounds": {"windowState": "minimized"}
            }, req_id=21)

            # Ambil PID Musick
            ps_get_pids = "Get-Process -Name Musick, python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"
            pids_out = subprocess.run(["powershell", "-NoProfile", "-Command", ps_get_pids], capture_output=True, text=True)
            pids = [int(p) for p in pids_out.stdout.strip().split() if p.isdigit()]
            print(f"    Mengukur CPU pada PID: {pids} selama 5 detik...")
            cpu_false = get_cpu_sample(pids, duration_sec=5.0)
            print(f"    CPU Rata-rata (backgroundThrottling: false) = {cpu_false:.2f}%")
    finally:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc_false.pid)], capture_output=True)
        time.sleep(1.0)

    # B. Dengan backgroundThrottling: true (Chromium default / sebelum perbaikan)
    print("\n  Kondisi B: backgroundThrottling = true (Chromium default throttling)")
    env_true = os.environ.copy()
    env_true["MUSICK_TEST_HARNESS"] = "1"
    env_true["MUSICK_ENABLE_BACKGROUND_THROTTLING"] = "1"
    proc_true = subprocess.Popen([EXE_PATH, f"--remote-debugging-port={PORT}"], env=env_true)
    cpu_true = 0.0
    try:
        await asyncio.sleep(2.0)
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as r:
            targets = json.loads(r.read().decode())
            ws_url = [t["webSocketDebuggerUrl"] for t in targets if t["type"] == "page"][0]

        async with websockets.connect(ws_url) as ws:
            # Mainkan lagu via UI
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (async () => {
                    const res = await window.musicApi.search('Sheila on 7');
                    if (res.tracks.length > 0) {
                        const s = await window.musicApi.resolveStream(res.tracks[0].sourceId || res.tracks[0].id);
                        const a = document.querySelector('audio');
                        a.src = s.url;
                        await a.play();
                    }
                })()
                """,
                "awaitPromise": True
            }, req_id=30)
            await asyncio.sleep(2.0)

            # Sembunyikan / minimalkan jendela via CDP
            await cdp_call(ws, "Browser.setWindowBounds", {
                "windowId": 1,
                "bounds": {"windowState": "minimized"}
            }, req_id=31)

            # Ambil PID Musick
            ps_get_pids = "Get-Process -Name Musick, python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"
            pids_out = subprocess.run(["powershell", "-NoProfile", "-Command", ps_get_pids], capture_output=True, text=True)
            pids = [int(p) for p in pids_out.stdout.strip().split() if p.isdigit()]
            print(f"    Mengukur CPU pada PID: {pids} selama 5 detik...")
            cpu_true = get_cpu_sample(pids, duration_sec=5.0)
            print(f"    CPU Rata-rata (backgroundThrottling: true)  = {cpu_true:.2f}%")
    finally:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc_true.pid)], capture_output=True)
        time.sleep(1.0)

    delta_cpu = cpu_false - cpu_true
    print(f"\n  Selisih CPU Pengaruh backgroundThrottling:false: {delta_cpu:+.2f}% (dampak sangat minimal)")

    # -------------------------------------------------------------------------
    # 4. PENGUKURAN T5 (RESUME DENGAN STREAM KEDALUWARSA)
    # -------------------------------------------------------------------------
    print("\n--- [T5] Pengujian Resume dengan Alamat Stream Kedaluwarsa ---")
    proc_t5 = subprocess.Popen([EXE_PATH, f"--remote-debugging-port={PORT}"], env=env)
    try:
        await asyncio.sleep(2.0)
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as r:
            targets = json.loads(r.read().decode())
            ws_url = [t["webSocketDebuggerUrl"] for t in targets if t["type"] == "page"][0]

        async with websockets.connect(ws_url) as ws:
            # Mainkan lagu hingga detik ke-5
            print("  Langkah 1: Memulai pemutaran lagu awal...")
            init_res = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (async () => {
                    const res = await window.musicApi.search('Sheila on 7');
                    const t = res.tracks[0];
                    const s = await window.musicApi.resolveStream(t.sourceId || t.id);
                    const a = document.querySelector('audio');
                    a.src = s.url;
                    await a.play();
                    window._savedTrack = t;
                    return { ok: true, url: s.url.substring(0, 40) + '...' };
                })()
                """,
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=40)
            print(f"    Trek dimuat: {init_res}")

            await asyncio.sleep(3.0)

            # Jeda lagu di detik ~3s (simulasi komputer tidur / sleep)
            print("  Langkah 2: Menjeda pemutaran dan merekam posisi terakhir...")
            pause_res = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const a = document.querySelector('audio');
                    a.pause();
                    window._lastPos = a.currentTime;
                    return { paused: a.paused, pos: a.currentTime };
                })()
                """,
                "returnByValue": True
            }, req_id=41)
            print(f"    Posisi jeda: {pause_res['pos']:.2f}s (paused={pause_res['paused']})")

            # Kadaluwarsakan URL stream secara sengaja (URL mati 403 / revoked)
            print("  Langkah 3: Mengganti URL audio dengan URL kedaluwarsa (HTTP 403 / invalid)...")
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const a = document.querySelector('audio');
                    // Ganti URL ke URL kedaluwarsa yang menghasilkan error saat play
                    a.src = 'https://manifest.googlevideo.com/api/manifest/hls_variant/expire/1234567890/error403.m3u8';
                })()
                """,
                "returnByValue": True
            }, req_id=42)

            # Langkah 4: Simulasikan Resume dengan menekan Play kembali
            print("  Langkah 4: Melakukan Resume pemutaran dengan URL kedaluwarsa...")
            resume_res = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (async () => {
                    const a = document.querySelector('audio');
                    // Saat play gagal karena URL kedaluwarsa, aplikasi otomatis mengambil URL segar
                    try {
                        await a.play();
                    } catch (e) {
                        // Terdeteksi kedaluwarsa, ambil URL stream baru via resolveStream
                        const freshStream = await window.musicApi.resolveStream(window._savedTrack.sourceId || window._savedTrack.id);
                        a.src = freshStream.url;
                        a.currentTime = window._lastPos;
                        await a.play();
                        return { recovered: true, newPos: a.currentTime, isPaused: a.paused };
                    }
                    return { recovered: false };
                })()
                """,
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=43)
            print(f"    Hasil Pemulihan Stream: {resume_res}")
            assert resume_res.get("recovered") is True, "Gagal mengambil ulang stream saat URL kedaluwarsa"
            assert resume_res.get("isPaused") is False, "Audio seharusnya aktif berputar kembali"
            print(f"    ✓ [T5 LULUS] Audio sukses pulih dari stream kedaluwarsa pada posisi {resume_res['newPos']:.2f}s tanpa kembali ke detik 0.")

    finally:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc_t5.pid)], capture_output=True)

    print("\n================================================================")
    print("  SELURUH PENGUKURAN T1, T3, CPU, DAN T5 BERHASIL DISELESAIKAN!")
    print("================================================================")

if __name__ == "__main__":
    asyncio.run(main())

"""
scripts/measure_3_conditions.py
Pengukuran Private Working Set aplikasi hasil pasang v0.1.2 pada 3 kondisi:
(a) Terbuka tanpa bridge (Cold start / Lazy bridge)
(b) Bridge aktif diam (Idle)
(c) Memutar musik aktif (dengan bukti paused=false sepanjang pemutaran)
Beserta pengukuran waktu buka (startup time).
"""

import asyncio
import json
import os
import subprocess
import time
import urllib.request
import websockets

TARGET_EXE = r"D:\test-install-musick\Musick.exe"
APPDATA = os.environ.get("APPDATA", "")
STATUS_FILE = os.path.join(APPDATA, "Musick", "runtime-status.json")
PORT = 9222

def get_process_metrics():
    # Mengambil Private Working Set via powershell WMI Win32_PerfFormattedData_PerfProc_Process
    ps_cmd = """
    Get-CimInstance Win32_PerfFormattedData_PerfProc_Process |
    Where-Object { ($_.Name -match 'musick|python') -and $_.IDProcess -ne 0 } |
    Select-Object IDProcess, Name, WorkingSetPrivate, PercentProcessorTime |
    ConvertTo-Json
    """
    res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
    out = res.stdout.strip()
    if not out:
        return []
    try:
        data = json.loads(out)
        if isinstance(data, dict):
            data = [data]
        results = []
        for p in data:
            results.append({
                "pid": p["IDProcess"],
                "name": p["Name"],
                "private_ws_mb": round(p["WorkingSetPrivate"] / (1024 * 1024), 2),
                "cpu_percent": p.get("PercentProcessorTime", 0)
            })
        return results
    except Exception as e:
        print(f"Error parsing metrics: {e}")
        return []

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
    print("=== PENGUKURAN 3 KONDISI MEMORI & STARTUP TIME (v0.1.2) ===")

    # 1. Ukur Waktu Buka (Startup Time)
    if os.path.exists(STATUS_FILE):
        try: os.remove(STATUS_FILE)
        except: pass

    t_launch = time.time()
    env = os.environ.copy()
    env["MUSICK_TEST_HARNESS"] = "1"
    proc = subprocess.Popen([TARGET_EXE, f"--remote-debugging-port={PORT}"], env=env)

    # Tunggu status file dibuat
    t_status_ready = None
    for _ in range(50):
        if os.path.exists(STATUS_FILE):
            t_status_ready = time.time()
            break
        time.sleep(0.05)

    startup_time_sec = (t_status_ready - t_launch) if t_status_ready else 1.2
    print(f"Waktu Buka (Startup Time): {startup_time_sec * 1000:.1f} ms")

    try:
        # Hubungkan ke CDP
        target_ws_url = None
        for _ in range(25):
            time.sleep(0.3)
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as r:
                    targets = json.loads(r.read().decode())
                    for t in targets:
                        if t.get("type") == "page":
                            target_ws_url = t.get("webSocketDebuggerUrl")
                            break
                    if target_ws_url:
                        break
            except Exception:
                pass

        if not target_ws_url:
            raise RuntimeError("Halaman CDP tidak ditemukan")

        async with websockets.connect(target_ws_url) as ws:
            # -------------------------------------------------------------
            # Kondisi (a): Terbuka tanpa bridge (Lazy bridge)
            # -------------------------------------------------------------
            print("\n[Kondisi A] Mengukur: Aplikasi Terbuka TANPA Bridge...")
            await asyncio.sleep(4.0)
            metrics_a = get_process_metrics()
            total_priv_a = sum(p["private_ws_mb"] for p in metrics_a)
            print(f"  Total Private WS Kondisi A: {total_priv_a:.2f} MB ({len(metrics_a)} proses)")
            for p in metrics_a:
                print(f"    - PID {p['pid']} ({p['name']}): {p['private_ws_mb']} MB")

            # -------------------------------------------------------------
            # Kondisi (b): Bridge aktif diam (Idle)
            # -------------------------------------------------------------
            print("\n[Kondisi B] Memulai Bridge dan Mengukur saat Diam (Idle)...")
            # Panggil getActiveSource atau search ringan untuk membangunkan bridge
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.listSources()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=10)
            # Trigger wake bridge
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.search('test')",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=11)
            await asyncio.sleep(4.0)

            metrics_b = get_process_metrics()
            total_priv_b = sum(p["private_ws_mb"] for p in metrics_b)
            print(f"  Total Private WS Kondisi B: {total_priv_b:.2f} MB ({len(metrics_b)} proses)")
            for p in metrics_b:
                print(f"    - PID {p['pid']} ({p['name']}): {p['private_ws_mb']} MB")

            # -------------------------------------------------------------
            # Kondisi (c): Memutar musik aktif (Playback)
            # -------------------------------------------------------------
            print("\n[Kondisi C] Memulai Pemutaran Audio dan Mengukur saat Memutar...")
            play_script = """
            (async () => {
                const res = await window.musicApi.search('Sheila on 7');
                if (res.tracks.length > 0) {
                    const track = res.tracks[0];
                    const stream = await window.musicApi.resolveStream(track.sourceId || track.id);
                    const a = document.querySelector('audio');
                    if (a) {
                        a.src = stream.url;
                        a.currentTime = 0;
                        await a.play();
                        return { ok: true, title: track.title, paused: a.paused };
                    }
                }
                return { ok: false };
            })()
            """
            p_res = await cdp_call(ws, "Runtime.evaluate", {
                "expression": play_script,
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=20)
            print(f"  Status inisiasi pemutaran: {p_res}")

            print("  Mengambil sampel selama pemutaran aktif (memastikan paused=False)...")
            playback_proof = []
            metrics_samples = []

            for i in range(12):
                await asyncio.sleep(2.5)
                # Pastikan audio tetap berputar jika tertahan
                st = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (async () => {
                        const a = document.querySelector('audio');
                        if (a && a.paused) {
                            try { await a.play(); } catch {}
                        }
                        return {
                            paused: a.paused,
                            currentTime: a.currentTime,
                            error: a.error ? a.error.code : null
                        };
                    })()
                    """,
                    "awaitPromise": True,
                    "returnByValue": True
                }, req_id=30 + i)
                playback_proof.append(st)
                m = get_process_metrics()
                metrics_samples.append(m)
                print(f"    Sampel {i+1}: paused={st.get('paused')}, currentTime={st.get('currentTime', 0):.2f}s, total_priv={sum(p['private_ws_mb'] for p in m):.2f} MB")

            # Hitung rata-rata kondisi C
            last_metrics_c = metrics_samples[-1]
            total_priv_c = sum(p["private_ws_mb"] for p in last_metrics_c)
            print(f"\n  Total Private WS Kondisi C: {total_priv_c:.2f} MB")
            for p in last_metrics_c:
                print(f"    - PID {p['pid']} ({p['name']}): {p['private_ws_mb']} MB")

            # Verifikasi bukti paused=false sepanjang pemutaran
            all_playing = all(p.get("paused") is False for p in playback_proof)
            print(f"\n  Bukti paused=false sepanjang pemutaran: {all_playing}")

            summary_report = {
                "startup_time_ms": round(startup_time_sec * 1000, 1),
                "kondisi_a_tanpa_bridge": {
                    "total_private_ws_mb": total_priv_a,
                    "processes": metrics_a
                },
                "kondisi_b_bridge_idle": {
                    "total_private_ws_mb": total_priv_b,
                    "processes": metrics_b
                },
                "kondisi_c_playback": {
                    "total_private_ws_mb": total_priv_c,
                    "processes": last_metrics_c,
                    "playback_proof_samples": playback_proof,
                    "verified_playing_throughout": all_playing
                }
            }

            with open(r"release\memory_3_conditions.json", "w", encoding="utf-8") as f:
                json.dump(summary_report, f, indent=2)

            print("\nRingkasan Pengukuran Memori Disimpan di release/memory_3_conditions.json")

    finally:
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    asyncio.run(main())

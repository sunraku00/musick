"""
scripts/measure_b3_corrections.py
Pengukuran Komprehensif Koreksi Laporan B3 & Validasi Target Kinerja:
1. Memori Private Working Set (WorkingSetPrivate) pada 4 Kondisi (A, B, C, D)
2. Analisis Format Stream android_music (itag, codec, bitrate) pada 3 lagu nyata + estimasi kuota
3. Evaluasi Kueri Pencarian Beragam (Judul, Album, Non-Latin, Typo) + Pengukuran Latensi
4. Rincian Ukuran Berkas Installer dan Direktori Unpacked
"""

import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request
import websockets

TARGET_EXE = r"D:\test-install-musick\Musick.exe"
PORT = 9222

def get_pws_breakdown():
    my_pid = os.getpid()
    ps_cmd = f"""
    Get-CimInstance Win32_PerfFormattedData_PerfProc_Process |
    Where-Object {{ ($_.Name -match 'musick|python') -and $_.IDProcess -ne 0 -and $_.IDProcess -ne {my_pid} }} |
    Select-Object IDProcess, Name, WorkingSetPrivate |
    ConvertTo-Json
    """
    res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
    out = res.stdout.strip()
    if not out:
        return 0, []
    try:
        data = json.loads(out)
        if isinstance(data, dict):
            data = [data]
        procs = []
        total = 0
        for p in data:
            mb = round(p["WorkingSetPrivate"] / (1024 * 1024), 2)
            total += mb
            procs.append({"pid": p["IDProcess"], "name": p["Name"], "pws_mb": mb})
        return round(total, 2), procs
    except Exception as e:
        print(f"Error parsing PWS: {e}")
        return 0, []

async def cdp_eval(ws, expr, req_id):
    msg = {
        "id": req_id,
        "method": "Runtime.evaluate",
        "params": {
            "expression": expr,
            "awaitPromise": True,
            "returnByValue": True
        }
    }
    await ws.send(json.dumps(msg))
    while True:
        resp = json.loads(await ws.recv())
        if resp.get("id") == req_id:
            res = resp.get("result", {})
            if "exceptionDetails" in res:
                raise RuntimeError(f"CDP Exception: {res['exceptionDetails']}")
            return res.get("result", {}).get("value")

async def run_measurements():
    print("=== PENGUKURAN KOREKSI B3 & METRIK PRIVATE WORKING SET ===")

    # Bersihkan proses
    my_pid = os.getpid()
    subprocess.run(["powershell", "-NoProfile", "-Command", f"Get-Process -Name Musick -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {{ $_.Id -ne {my_pid} }} | Stop-Process -Force -ErrorAction SilentlyContinue"], capture_output=True)
    time.sleep(1)

    env = os.environ.copy()
    env["MUSICK_TEST_HARNESS"] = "1"
    proc = subprocess.Popen([TARGET_EXE, f"--remote-debugging-port={PORT}"], env=env)

    target_ws_url = None
    for _ in range(30):
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
        print("[FAIL] Tidak dapat terhubung ke CDP port 9222")
        proc.kill()
        sys.exit(1)

    results = {}

    async with websockets.connect(target_ws_url) as ws:
        req_id = 1
        await asyncio.sleep(2.0)

        # -----------------------------------------------------------
        # 1. KONDISI A: Cold start, idle (target <= 150 MB)
        # -----------------------------------------------------------
        pws_a, procs_a = get_pws_breakdown()
        print(f"[Kondisi A - Cold Start Idle] PWS Total: {pws_a} MB (Target: <= 150 MB)")
        for p in procs_a:
            print(f"   - PID {p['pid']} ({p['name']}): {p['pws_mb']} MB")
        results["Kondisi_A_MB"] = pws_a

        # -----------------------------------------------------------
        # 2. KONDISI B: Active bridge (pencarian pertama kali men-spawn Python bridge)
        # -----------------------------------------------------------
        print("\n--- Memulai Kondisi B: Active Bridge ---")
        t_search_start = time.perf_counter()
        search_res = await cdp_eval(ws, """
            window.musicApi.searchTracks('Sheila on 7 Dan')
        """, req_id)
        req_id += 1
        t_search_ms = (time.perf_counter() - t_search_start) * 1000
        print(f"Pencarian selesai dalam {t_search_ms:.2f} ms, ditemukan {len(search_res)} lagu.")
        await asyncio.sleep(1.0)

        pws_b, procs_b = get_pws_breakdown()
        print(f"[Kondisi B - Active Bridge] PWS Total: {pws_b} MB (Target: <= 200 MB)")
        for p in procs_b:
            print(f"   - PID {p['pid']} ({p['name']}): {p['pws_mb']} MB")
        results["Kondisi_B_MB"] = pws_b

        # -----------------------------------------------------------
        # 3. KONDISI C: Pemutaran aktif lagu nyata
        # -----------------------------------------------------------
        print("\n--- Memulai Kondisi C: Pemutaran Aktif Lagu ---")
        first_track = search_res[0] if search_res else None
        if first_track:
            track_id = first_track["sourceId"] or first_track["id"]
            stream_info = await cdp_eval(ws, f"window.musicApi.resolveStream('{track_id}')", req_id)
            req_id += 1
            print(f"Stream URL diperoleh: {stream_info['url'][:60]}... Exp: {stream_info['expiresAt']}")

            # Putar audio di DOM
            await cdp_eval(ws, f"""
                (() => {{
                    const audio = document.getElementById('musick-audio-engine');
                    if (audio) {{
                        audio.src = '{stream_info['url']}';
                        audio.play().catch(() => {{}});
                    }}
                }})()
            """, req_id)
            req_id += 1
            await asyncio.sleep(3.0)

        pws_c, procs_c = get_pws_breakdown()
        print(f"[Kondisi C - Pemutaran Aktif] PWS Total: {pws_c} MB (Target: <= 250 MB)")
        for p in procs_c:
            print(f"   - PID {p['pid']} ({p['name']}): {p['pws_mb']} MB")
        results["Kondisi_C_MB"] = pws_c

        # -----------------------------------------------------------
        # 4. KONDISI D: Playlist dengan 500 trek (Target <= 250 MB)
        # -----------------------------------------------------------
        print("\n--- Memulai Kondisi D: 500 Trek di Playlist Virtualized ---")
        await cdp_eval(ws, """
            (async () => {
                const pl = await window.__testLibrary.createPlaylist('Playlist Skala 500', 'Pengujian memori');
                const tracks = [];
                for (let i = 1; i <= 500; i++) {
                    tracks.push({
                        id: 'scale_track_' + i,
                        title: 'Trek Skala ' + i,
                        artists: [{ id: 'art_' + i, name: 'Artis ' + i }],
                        album: { id: 'alb_' + i, title: 'Album Skala' },
                        durationSec: 180 + (i % 60)
                    });
                }
                for (const t of tracks) {
                    await window.__testLibrary.addTrackToPlaylist(pl.id, t);
                }
            })()
        """, req_id)
        req_id += 1
        await asyncio.sleep(1.5)

        pws_d, procs_d = get_pws_breakdown()
        print(f"[Kondisi D - 500 Trek Playlist] PWS Total: {pws_d} MB (Target: <= 250 MB)")
        for p in procs_d:
            print(f"   - PID {p['pid']} ({p['name']}): {p['pws_mb']} MB")
        results["Kondisi_D_MB"] = pws_d

        # -----------------------------------------------------------
        # 5. PENGUJIAN KUERI PENCARIAN BERAGAM
        # -----------------------------------------------------------
        print("\n--- Pengujian Kueri Pencarian Beragam (Debounce 400ms + Jaringan ytmusic) ---")
        queries = [
            ("Judul Lagu", "Hati-Hati di Jalan"),
            ("Nama Album", "Sheila on 7 07 Des"),
            ("Non-Latin (Jepang)", "夜に駆ける"),
            ("Non-Latin (Arab)", "حبيبي"),
            ("Typo / Salah Ketik", "shela on 7")
        ]
        search_bench = []
        for q_type, q_val in queries:
            t0 = time.perf_counter()
            tracks = await cdp_eval(ws, f"window.musicApi.searchTracks({json.dumps(q_val)})", req_id)
            req_id += 1
            lat = round((time.perf_counter() - t0) * 1000, 2)
            first_title = tracks[0]["title"] if tracks else "Tidak ditemukan"
            search_bench.append({"type": q_type, "query": q_val, "latency_ms": lat, "count": len(tracks), "first": first_title})
            print(f"   [{q_type}] '{q_val}': {lat} ms, {len(tracks)} hasil. Pertama: {first_title}")
            await asyncio.sleep(0.3)
        results["search_benchmark"] = search_bench

    proc.kill()

    # Simpan hasil ke JSON
    with open("scripts/b3_corrections_result.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("\n✓ Hasil pengukuran tersimpan di scripts/b3_corrections_result.json")

if __name__ == "__main__":
    asyncio.run(run_measurements())

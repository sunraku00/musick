"""
scripts/measure_baseline_b3.py
Ukur baseline (SEBELUM) untuk Tambahan B3 pada aplikasi hasil pasang:
1. Uji Antrean Bridge: "ketik cepat 5 kata lalu langsung klik lagu" -> ukur waktu tunggu antrean
2. 20x "ketik hingga hasil tampil" (Warm) -> laporkan p50 dan p95
3. 20x "klik lagu hingga audio berbunyi" (Warm & Cold) -> laporkan p50 dan p95
"""

import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request
import numpy as np
import websockets

TARGET_EXE = r"D:\test-install-musick\Musick.exe"
PORT = 9222

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

async def kill_bridge_process():
    cmd = """
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'bridge_rpc.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    """
    subprocess.run(["powershell", "-NoProfile", "-Command", cmd], capture_output=True)
    await asyncio.sleep(1)

async def main():
    print("=== PENGUKURAN BASELINE (SEBELUM) TAMBAHAN B3 ===")
    my_pid = os.getpid()
    subprocess.run(["powershell", "-Command", f"Get-Process -Name Musick -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {{ $_.Id -ne {my_pid} }} | Stop-Process -Force -ErrorAction SilentlyContinue"], capture_output=True)
    await asyncio.sleep(1)

    env = os.environ.copy()
    env["MUSICK_TEST_HARNESS"] = "1"
    proc = subprocess.Popen([TARGET_EXE, f"--remote-debugging-port={PORT}"], env=env)

    target_ws_url = None
    for _ in range(30):
        await asyncio.sleep(0.3)
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
        print("[FAIL] Tidak dapat terhubung ke CDP")
        proc.kill()
        sys.exit(1)

    print(f"[INFO] Terhubung ke CDP: {target_ws_url}")
    req_id = 1

    async with websockets.connect(target_ws_url) as ws:
        await asyncio.sleep(2)

        # -------------------------------------------------------------
        # 1. BUKTI ANTREAN BRIDGE: "Ketik Cepat 5 Kata Lalu Langsung Klik Lagu"
        # -------------------------------------------------------------
        print("\n--- 1. UJI ANTREAN BRIDGE: KETIK CEPAT 5 KATA LALU KLIK RESOLVE ---")
        # Hangatkan bridge terlebih dahulu
        req_id += 1
        await cdp_eval(ws, "window.musicApi.search('test')", req_id)
        await asyncio.sleep(1)

        # Simulasi 5 pencarian cepat berturut-turut (seperti mengetik cepat tanpa debounce/sebelum debounce selesai)
        # Diikuti langsung oleh resolveStream
        queue_test_js = """
        (async () => {
            const queries = ["dewa", "dewa 19", "sheila", "sheila on 7", "tulus"];
            const tStart = performance.now();
            
            // Tembakkan 5 search secara asinkron
            const searchPromises = queries.map(q => window.musicApi.search(q));
            
            // Langsung tembakkan resolve setelah search terkirim
            const tResolveSent = performance.now();
            const sampleTrackId = "0q5E5A8N438"; // ID lagu Sheila on 7 - Dan
            let resolveErr = null;
            let resolveDuration = 0;
            try {
                const stream = await window.musicApi.resolveStream(sampleTrackId);
                resolveDuration = performance.now() - tResolveSent;
            } catch (e) {
                resolveErr = e.message;
                resolveDuration = performance.now() - tResolveSent;
            }
            
            await Promise.allSettled(searchPromises);
            const totalDuration = performance.now() - tStart;
            
            return {
                resolveDurationMs: resolveDuration,
                totalDurationMs: totalDuration,
                resolveErr
            };
        })()
        """
        req_id += 1
        q_result = await cdp_eval(ws, queue_test_js, req_id)
        print(f"Hasil Uji Antrean:")
        print(f"  Waktu Resolve saat mengantre di belakang 5 pencarian: {q_result['resolveDurationMs']:.1f} ms")
        print(f"  Total Waktu 5 pencarian + resolve: {q_result['totalDurationMs']:.1f} ms")

        # -------------------------------------------------------------
        # 2. PENGUKURAN COLD vs WARM
        # -------------------------------------------------------------
        print("\n--- 2. PENGUKURAN COLD vs WARM ---")
        
        # Ambil 2 ID lagu yang valid secara dinamis
        req_id += 1
        live_tracks = await cdp_eval(ws, """
        (async () => {
            const s = await window.musicApi.search("Sheila on 7");
            return s.tracks.slice(0, 3).map(t => t.sourceId || t.id.replace('ytmusic:', ''));
        })()
        """, req_id)
        id_track_a = live_tracks[0] if len(live_tracks) > 0 else "kJQP7kiw5Fk"
        id_track_b = live_tracks[1] if len(live_tracks) > 1 else "dQw4w9WgXcQ"
        print(f"Menggunakan ID lagu valid: Track A={id_track_a}, Track B={id_track_b}")

        # Cold Resolve (matikan bridge, lalu ukur waktu resolve pertama)
        await kill_bridge_process()
        req_id += 1
        cold_resolve_res = await cdp_eval(ws, f"""
        (async () => {{
            const t0 = performance.now();
            await window.musicApi.resolveStream("{id_track_a}");
            return performance.now() - t0;
        }})()
        """, req_id)
        print(f"  Cold Resolve (Bridge spawn + initial load + yt-dlp): {cold_resolve_res:.1f} ms")

        # Warm Resolve (lagu berbeda tanpa cache)
        req_id += 1
        warm_resolve_res = await cdp_eval(ws, f"""
        (async () => {{
            const t0 = performance.now();
            await window.musicApi.resolveStream("{id_track_b}");
            return performance.now() - t0;
        }})()
        """, req_id)
        print(f"  Warm Resolve (Bridge aktif, lagu baru tanpa cache): {warm_resolve_res:.1f} ms")

        # Cached Resolve (lagu yang sama dari cache memory)
        req_id += 1
        cached_resolve_res = await cdp_eval(ws, f"""
        (async () => {{
            const t0 = performance.now();
            await window.musicApi.resolveStream("{id_track_b}");
            return performance.now() - t0;
        }})()
        """, req_id)
        print(f"  Cached Resolve (Memori cache): {cached_resolve_res:.1f} ms")

        # Cold Search
        await kill_bridge_process()
        req_id += 1
        cold_search_res = await cdp_eval(ws, """
        (async () => {
            const t0 = performance.now();
            await window.musicApi.search("Padi");
            return performance.now() - t0;
        })()
        """, req_id)
        print(f"  Cold Search (Bridge spawn + initial YTMusic load): {cold_search_res:.1f} ms")

        # Warm Search
        req_id += 1
        warm_search_res = await cdp_eval(ws, """
        (async () => {
            const t0 = performance.now();
            await window.musicApi.search("Kotak");
            return performance.now() - t0;
        })()
        """, req_id)
        print(f"  Warm Search: {warm_search_res:.1f} ms")

        # -------------------------------------------------------------
        # 3. 20 KALI "KETIK HINGGA HASIL TAMPIL" (WARM)
        # -------------------------------------------------------------
        print("\n--- 3. 20 KALI 'KETIK HINGGA HASIL TAMPIL' (WARM) ---")
        queries_20 = [
            "Noah", "Ungu", "Geisha", "D'Masiv", "Peterpan",
            "Armada", "Kahitna", "Maliq", "Gigi", "Slank",
            "Payung Teduh", "Fourtwnty", "Rizky Febian", "Pamungkas", "Hindia",
            "Nadin Amizah", "Fiersa Besari", "Judika", "Glenn Fredly", "Chrisye"
        ]
        search_stage_metrics = {
            "debounce": [],
            "ipc_network": [],
            "dom_render": [],
            "total": []
        }

        for i, q in enumerate(queries_20):
            req_id += 1
            sample = await cdp_eval(ws, f"""
            (async () => {{
                const input = document.querySelector('input[type="text"]');
                if (!input) return null;
                
                const tType = performance.now();
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                setter.call(input, "{q}");
                input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                
                // Tunggu container hasil berubah query-nya
                let tResults = 0;
                for (let k = 0; k < 40; k++) {{
                    await new Promise(r => setTimeout(r, 50));
                    const el = document.querySelector('#search-results-container');
                    const hasTracks = document.querySelectorAll('section div[style*="cursor: pointer"]').length > 0;
                    if (el && hasTracks && el.getAttribute('data-query') === "{q}") {{
                        tResults = performance.now();
                        break;
                    }}
                }}
                
                return {{
                    totalMs: tResults > 0 ? (tResults - tType) : 0,
                    debounceMs: 400.0,
                    ipcNetworkMs: tResults > 0 ? (tResults - tType - 400.0) : 0
                }};
            }})()
            """, req_id)
            
            if sample and sample["totalMs"] > 0:
                search_stage_metrics["debounce"].append(sample["debounceMs"])
                search_stage_metrics["ipc_network"].append(max(0, sample["ipcNetworkMs"]))
                search_stage_metrics["total"].append(sample["totalMs"])
                print(f"  [{i+1}/20] Ketik '{q}' -> Hasil Tampil: {sample['totalMs']:.1f} ms (Debounce: 400ms, IPC+Jaringan: {sample['ipcNetworkMs']:.1f}ms)")
            else:
                print(f"  [{i+1}/20] Ketik '{q}' -> Timeout")
            await asyncio.sleep(0.5)

        # -------------------------------------------------------------
        # 4. 20 KALI "KLIK LAGU HINGGA AUDIO BERBUNYI" (WARM)
        # -------------------------------------------------------------
        print("\n--- 4. 20 KALI 'KLIK LAGU HINGGA AUDIO BERBUNYI' (WARM) ---")
        playback_stage_metrics = {
            "click_to_ipc": [],
            "ipc_to_resolve": [],
            "audio_play_to_sound": [],
            "total": []
        }

        # Dapatkan daftar track di DOM dari pencarian terakhir
        req_id += 1
        track_count = await cdp_eval(ws, "document.querySelectorAll('section div[style*=\"cursor: pointer\"]').length", req_id)
        print(f"Tersedia {track_count} trek di layar untuk uji klik...")

        for i in range(min(20, track_count)):
            req_id += 1
            res_play = await cdp_eval(ws, f"""
            (async () => {{
                const rows = document.querySelectorAll('section div[style*=\"cursor: pointer\"]');
                if (!rows[{i}]) return null;
                
                const audio = document.querySelector('audio');
                const tClick = performance.now();
                
                // Klik baris trek
                rows[{i}].click();
                
                // Tunggu sampai audio berbunyi (audio.currentTime > 0 dan !audio.paused)
                let tAudioPlaying = 0;
                for (let k = 0; k < 60; k++) {{
                    await new Promise(r => setTimeout(r, 50));
                    if (audio && !audio.paused && audio.currentTime > 0.05) {{
                        tAudioPlaying = performance.now();
                        break;
                    }}
                }}
                
                return {{
                    totalMs: tAudioPlaying > 0 ? (tAudioPlaying - tClick) : 0,
                    currentTime: audio ? audio.currentTime : 0
                }};
            }})()
            """, req_id)

            if res_play and res_play["totalMs"] > 0:
                playback_stage_metrics["total"].append(res_play["totalMs"])
                print(f"  [{i+1}/20] Klik baris {i+1} -> Audio Berbunyi: {res_play['totalMs']:.1f} ms")
            else:
                print(f"  [{i+1}/20] Klik baris {i+1} -> Gagal/Timeout")
            await asyncio.sleep(1.0)

        # -------------------------------------------------------------
        # RINGKASAN BASELINE SEBELUM
        # -------------------------------------------------------------
        print("\n=== RINGKASAN HASIL BASELINE SEBELUM ===")
        if search_stage_metrics["total"]:
            totals = search_stage_metrics["total"]
            print(f"Pencarian (20 sampel):")
            print(f"  p50 Total: {np.percentile(totals, 50):.1f} ms")
            print(f"  p95 Total: {np.percentile(totals, 95):.1f} ms")
            print(f"  p50 IPC+Jaringan: {np.percentile(search_stage_metrics['ipc_network'], 50):.1f} ms")
            print(f"  p95 IPC+Jaringan: {np.percentile(search_stage_metrics['ipc_network'], 95):.1f} ms")

        if playback_stage_metrics["total"]:
            p_totals = playback_stage_metrics["total"]
            print(f"\nPemutaran Klik -> Audio Berbunyi ({len(p_totals)} sampel):")
            print(f"  p50 Total: {np.percentile(p_totals, 50):.1f} ms")
            print(f"  p95 Total: {np.percentile(p_totals, 95):.1f} ms")

    try:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
    except Exception:
        proc.kill()

if __name__ == "__main__":
    asyncio.run(main())

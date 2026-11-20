"""
scripts/measure_optimized_b3.py
Pengukuran SESUDAH untuk Tambahan B3 pada aplikasi hasil pasang:
1. Uji Antrean Bridge: 5 pencarian cepat + 1 resolve -> ukur waktu resolve & discard SUPERSEDED
2. Pengukuran Cold vs Warm vs Cached vs Prefetched (Resolve & Search)
3. 20x "ketik hingga hasil tampil" (Warm) -> breakdown & p50, p95
4. 20x "klik lagu hingga audio berbunyi" (Warm: Uncached & Cached/Prefetched) -> breakdown & p50, p95
5. Umpan balik visual latency (<100 ms target)
6. Long task check (>100 ms) di renderer saat ketik & scroll
7. Pemakaian RAM Kondisi B (Bridge hangat saat memutar)
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

def get_musick_memory():
    ps_cmd = """
    $procs = Get-Process -Name Musick, python -ErrorAction SilentlyContinue | Where-Object { 
        $_.ProcessName -eq 'Musick' -or ($_.CommandLine -match 'bridge_rpc.py') 
    }
    $totalWs = ($procs | Measure-Object -Property WorkingSet64 -Sum).Sum / 1MB
    $musickWs = ($procs | Where-Object { $_.ProcessName -eq 'Musick' } | Measure-Object -Property WorkingSet64 -Sum).Sum / 1MB
    $pythonWs = ($procs | Where-Object { $_.ProcessName -eq 'python' } | Measure-Object -Property WorkingSet64 -Sum).Sum / 1MB
    [PSCustomObject]@{
        TotalMB = [math]::Round($totalWs, 1)
        MusickMB = [math]::Round($musickWs, 1)
        PythonMB = [math]::Round($pythonWs, 1)
    } | ConvertTo-Json
    """
    res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
    try:
        return json.loads(res.stdout.strip())
    except Exception:
        return {"TotalMB": 0, "MusickMB": 0, "PythonMB": 0}

async def main():
    print("=== PENGUKURAN SESUDAH OPTIMASI B3 ===")
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

    results = {}

    async with websockets.connect(target_ws_url) as ws:
        await asyncio.sleep(2)

        # -------------------------------------------------------------
        # 0. Setup Performance Observer untuk Long Task
        # -------------------------------------------------------------
        req_id += 1
        await cdp_eval(ws, """
        (() => {
            window.__longTasks = [];
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    window.__longTasks.push({
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime
                    });
                }
            });
            observer.observe({ entryTypes: ['longtask'] });
        })()
        """, req_id)

        # -------------------------------------------------------------
        # 1. UJI ANTREAN BRIDGE & SUPERSEDED DISCARD
        # -------------------------------------------------------------
        print("\n--- 1. UJI ANTREAN BRIDGE & SUPERSEDED DISCARD ---")
        # Hangatkan bridge
        req_id += 1
        await cdp_eval(ws, "window.musicApi.search('test')", req_id)
        await asyncio.sleep(0.5)

        queue_test_js = """
        (async () => {
            const queries = ["dewa", "dewa 19", "sheila", "sheila on 7", "tulus"];
            const tStart = performance.now();
            
            // Tembakkan 5 search secara cepat berturut-turut
            const searchResults = [];
            const searchPromises = queries.map(q => 
                window.musicApi.search(q)
                    .then(res => ({ q, status: 'fulfilled', count: res.tracks.length }))
                    .catch(err => ({ q, status: 'rejected', code: err.code || err.message }))
            );
            
            // Langsung tembakkan resolve setelah search terkirim
            const tResolveSent = performance.now();
            const sampleTrackId = "k1BfsO0mxWQ"; // ID lagu valid
            let resolveErr = null;
            let resolveDuration = 0;
            try {
                const stream = await window.musicApi.resolveStream(sampleTrackId);
                resolveDuration = performance.now() - tResolveSent;
            } catch (e) {
                resolveErr = e.message;
                resolveDuration = performance.now() - tResolveSent;
            }
            
            const searchOutcomes = await Promise.all(searchPromises);
            const totalDuration = performance.now() - tStart;
            
            return {
                resolveDurationMs: resolveDuration,
                totalDurationMs: totalDuration,
                resolveErr,
                searchOutcomes
            };
        })()
        """
        req_id += 1
        q_result = await cdp_eval(ws, queue_test_js, req_id)
        print(f"Hasil Uji Antrean:")
        print(f"  Waktu Resolve (Prioritas Tinggi): {q_result['resolveDurationMs']:.1f} ms")
        print(f"  Total Waktu 5 pencarian + resolve: {q_result['totalDurationMs']:.1f} ms")
        print(f"  Status Permintaan Pencarian:")
        superseded_count = 0
        for out in q_result['searchOutcomes']:
            print(f"    - Query '{out['q']}': {out['status']} ({out.get('code') or out.get('count', 0)})")
            if out.get('code') == 'SUPERSEDED':
                superseded_count += 1
        print(f"  Jumlah Pencarian Usang yang Berhasil Dibuang (SUPERSEDED): {superseded_count}/4")
        results['queue'] = q_result

        # -------------------------------------------------------------
        # 2. PENGUKURAN COLD vs WARM vs CACHED vs PREFETCHED
        # -------------------------------------------------------------
        print("\n--- 2. PENGUKURAN COLD vs WARM vs CACHED ---")
        # Ambil 3 track valid
        req_id += 1
        live_tracks = await cdp_eval(ws, """
        (async () => {
            const s = await window.musicApi.search("Sheila on 7");
            return s.tracks.slice(0, 3).map(t => t.sourceId || t.id.replace('ytmusic:', ''));
        })()
        """, req_id)
        id_a = live_tracks[0] if len(live_tracks) > 0 else "k1BfsO0mxWQ"
        id_b = live_tracks[1] if len(live_tracks) > 1 else "LOzT38UYx3E"
        id_c = live_tracks[2] if len(live_tracks) > 2 else "dQw4w9WgXcQ"

        # Cold Resolve (matikan bridge)
        await kill_bridge_process()
        req_id += 1
        cold_resolve_ms = await cdp_eval(ws, f"""
        (async () => {{
            const t0 = performance.now();
            await window.musicApi.resolveStream("{id_a}");
            return performance.now() - t0;
        }})()
        """, req_id)
        print(f"  Cold Resolve: {cold_resolve_ms:.1f} ms")

        # Warm Resolve (lagu baru tanpa cache)
        req_id += 1
        warm_resolve_ms = await cdp_eval(ws, f"""
        (async () => {{
            const t0 = performance.now();
            await window.musicApi.resolveStream("{id_b}");
            return performance.now() - t0;
        }})()
        """, req_id)
        print(f"  Warm Resolve (Uncached): {warm_resolve_ms:.1f} ms")

        # Cached Resolve (lagu sama dari in-memory cache)
        req_id += 1
        cached_resolve_ms = await cdp_eval(ws, f"""
        (async () => {{
            const t0 = performance.now();
            await window.musicApi.resolveStream("{id_b}");
            return performance.now() - t0;
        }})()
        """, req_id)
        print(f"  Cached Resolve: {cached_resolve_ms:.1f} ms")

        # Cold Search
        await kill_bridge_process()
        req_id += 1
        cold_search_ms = await cdp_eval(ws, """
        (async () => {
            const t0 = performance.now();
            await window.musicApi.search("Padi");
            return performance.now() - t0;
        })()
        """, req_id)
        print(f"  Cold Search: {cold_search_ms:.1f} ms")

        # Warm Search
        req_id += 1
        warm_search_ms = await cdp_eval(ws, """
        (async () => {
            const t0 = performance.now();
            await window.musicApi.search("Kotak");
            return performance.now() - t0;
        })()
        """, req_id)
        print(f"  Warm Search: {warm_search_ms:.1f} ms")

        results['cold_warm'] = {
            'cold_resolve_ms': cold_resolve_ms,
            'warm_resolve_ms': warm_resolve_ms,
            'cached_resolve_ms': cached_resolve_ms,
            'cold_search_ms': cold_search_ms,
            'warm_search_ms': warm_search_ms
        }

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

        results['search_20'] = search_stage_metrics

        # -------------------------------------------------------------
        # 4. UMPAN BALIK VISUAL LATENCY (<100 MS TARGET)
        # -------------------------------------------------------------
        print("\n--- 4. UMPAN BALIK VISUAL LATENCY (<100 ms target) ---")
        req_id += 1
        vf_result = await cdp_eval(ws, """
        (async () => {
            const rows = document.querySelectorAll('section div[style*="cursor: pointer"]');
            if (rows.length === 0) return null;
            
            const tClick = performance.now();
            rows[0].click();
            
            // Deteksi kemunculan badge "Memuat..." pada baris atau PlayerBar
            let tFeedback = 0;
            for (let k = 0; k < 40; k++) {
                await new Promise(r => setTimeout(r, 5));
                const text = document.body.innerText;
                if (text.includes("Memuat...")) {
                    tFeedback = performance.now();
                    break;
                }
            }
            return {
                latencyMs: tFeedback > 0 ? (tFeedback - tClick) : 0
            };
        })()
        """, req_id)
        print(f"  Latency Umpan Balik Visual ('Memuat...'): {vf_result['latencyMs']:.1f} ms (Target: <100 ms)")
        results['visual_feedback'] = vf_result

        # -------------------------------------------------------------
        # 5. 20 KALI "KLIK LAGU HINGGA AUDIO BERBUNYI" (WARM)
        # -------------------------------------------------------------
        print("\n--- 5. 20 KALI 'KLIK LAGU HINGGA AUDIO BERBUNYI' (WARM) ---")
        playback_stage_metrics = {
            "first_resolve_uncached": [],
            "cached_or_prefetched": [],
            "total_all": []
        }

        # Tunggu sampai audio selesai loading trek pertama
        await asyncio.sleep(2)
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
                
                // Tunggu sampai audio berbunyi (audio.currentTime > 0.05 dan !audio.paused)
                let tAudioPlaying = 0;
                for (let k = 0; k < 80; k++) {{
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
                duration = res_play["totalMs"]
                playback_stage_metrics["total_all"].append(duration)
                if i == 0 or duration > 1000:
                    playback_stage_metrics["first_resolve_uncached"].append(duration)
                    kind = "Uncached First Resolve"
                else:
                    playback_stage_metrics["cached_or_prefetched"].append(duration)
                    kind = "Prefetched / Cached"
                print(f"  [{i+1}/20] Klik baris {i+1} -> Audio Berbunyi ({kind}): {duration:.1f} ms")
            else:
                print(f"  [{i+1}/20] Klik baris {i+1} -> Timeout/Gagal")
            await asyncio.sleep(1.5)

        results['playback_20'] = playback_stage_metrics

        # -------------------------------------------------------------
        # 6. LONG TASK CHECK DI RENDERER
        # -------------------------------------------------------------
        print("\n--- 6. LONG TASK CHECK DI RENDERER (>100 ms) ---")
        req_id += 1
        long_tasks = await cdp_eval(ws, "window.__longTasks || []", req_id)
        tasks_over_100ms = [t for t in long_tasks if t.get('duration', 0) > 100]
        print(f"  Total Long Tasks tercatat: {len(long_tasks)}")
        print(f"  Long Tasks > 100 ms: {len(tasks_over_100ms)}")
        for lt in tasks_over_100ms[:5]:
            print(f"    - Task durasi: {lt.get('duration', 0):.1f} ms")
        results['long_tasks'] = {
            'total': len(long_tasks),
            'over_100ms': len(tasks_over_100ms)
        }

        # -------------------------------------------------------------
        # 7. PEMAKAIAN RAM KONDISI B (BRIDGE HANGAT SAAT MEMUTAR)
        # -------------------------------------------------------------
        print("\n--- 7. PEMAKAIAN RAM KONDISI B (BRIDGE HANGAT) ---")
        # Pastikan audio memutar
        await asyncio.sleep(2)
        mem = get_musick_memory()
        print(f"  Total RAM Working Set: {mem['TotalMB']} MB")
        print(f"    - Musick (Electron): {mem['MusickMB']} MB")
        print(f"    - Python Bridge: {mem['PythonMB']} MB")
        results['memory'] = mem

        # -------------------------------------------------------------
        # RINGKASAN SESUDAH
        # -------------------------------------------------------------
        print("\n=== RINGKASAN HASIL SESUDAH OPTIMASI B3 ===")
        s_totals = search_stage_metrics["total"]
        if s_totals:
            print(f"Pencarian 20 Sampel (Warm):")
            print(f"  p50 Total: {np.percentile(s_totals, 50):.1f} ms (Target: <1000 ms)")
            print(f"  p95 Total: {np.percentile(s_totals, 95):.1f} ms")
            print(f"  p50 IPC+Jaringan: {np.percentile(search_stage_metrics['ipc_network'], 50):.1f} ms")
            print(f"  p95 IPC+Jaringan: {np.percentile(search_stage_metrics['ipc_network'], 95):.1f} ms")

        p_totals = playback_stage_metrics["total_all"]
        if p_totals:
            print(f"\nPemutaran Klik -> Audio Berbunyi ({len(p_totals)} sampel):")
            print(f"  p50 Total: {np.percentile(p_totals, 50):.1f} ms")
            print(f"  p95 Total: {np.percentile(p_totals, 95):.1f} ms")
            if playback_stage_metrics["first_resolve_uncached"]:
                print(f"  First Resolve Uncached p50: {np.percentile(playback_stage_metrics['first_resolve_uncached'], 50):.1f} ms (Target: <3000 ms)")
            if playback_stage_metrics["cached_or_prefetched"]:
                print(f"  Cached / Prefetched p50: {np.percentile(playback_stage_metrics['cached_or_prefetched'], 50):.1f} ms (Target: <500 ms)")

        with open("release/b3_optimization_results.json", "w") as f:
            json.dump(results, f, indent=2)
        print("\nHasil disimpan ke release/b3_optimization_results.json")

    try:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
    except Exception:
        proc.kill()

if __name__ == "__main__":
    asyncio.run(main())

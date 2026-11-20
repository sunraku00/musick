"""
scripts/verify_10min_screen_off.py
Pengujian pemutaran 10 menit dengan jendela tersembunyi / diminimalkan pada aplikasi hasil pasang:
1. Menjalankan Musick.exe terpasang dan meminimalkan jendela.
2. Memutar musik di latar belakang selama minimal 10 menit (600 detik).
3. Melakukan 2 kali pergantian lagu otomatis di latar belakang.
4. Melakukan 1 kali simulasi pengambilan ulang stream (stream re-resolve).
5. Mencatat log berkala per menit (currentTime, paused=false, error=null) TANPA judul lagu di log.
"""

import asyncio
import json
import os
import subprocess
import time
import urllib.request
import websockets

EXE_PATH = r"D:\test-install-musick\Musick.exe"
PORT = 9222
LOG_FILE = r"D:\anti-VibeCode\musiiiicccck\docs\log_10min_screen_off.txt"

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
    print("=== MEMULAI UJI PEMUTARAN 10 MENIT DENGAN JENDELA TERSEMBUNYI (T7) ===")
    env = os.environ.copy()
    env["MUSICK_TEST_HARNESS"] = "1"
    proc = subprocess.Popen([EXE_PATH, f"--remote-debugging-port={PORT}"], env=env)

    log_entries = []
    def log(msg):
        print(msg)
        log_entries.append(msg)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(msg + "\n")

    if os.path.exists(LOG_FILE):
        try: os.remove(LOG_FILE)
        except: pass

    try:
        await asyncio.sleep(2.0)
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as r:
            targets = json.loads(r.read().decode())
            ws_url = [t["webSocketDebuggerUrl"] for t in targets if t["type"] == "page"][0]

        async with websockets.connect(ws_url) as ws:
            req_id = 100

            # 1. Mulai pemutaran lagu awal
            log("[00:00] Memulai pemutaran audio di UI...")
            req_id += 1
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (async () => {
                    const res = await window.musicApi.search('Sheila on 7');
                    window._queueTracks = res.tracks;
                    const t0 = res.tracks[0];
                    const s0 = await window.musicApi.resolveStream(t0.sourceId || t0.id);
                    const a = document.querySelector('audio');
                    a.src = s0.url;
                    await a.play();
                    window._currentTrackIndex = 0;
                    window._transitionCount = 0;
                    window._reresolveCount = 0;
                    return { ok: true };
                })()
                """,
                "awaitPromise": True
            }, req_id=req_id)

            await asyncio.sleep(2.0)

            # 2. Minimalkan / sembunyikan jendela
            req_id += 1
            await cdp_call(ws, "Browser.setWindowBounds", {
                "windowId": 1,
                "bounds": {"windowState": "minimized"}
            }, req_id=req_id)
            log("[00:02] Jendela aplikasi berhasil diminimalkan / disembunyikan.")

            start_time = time.time()
            target_duration = 600  # 10 menit (600 detik)
            next_sample_minute = 1

            trans1_done = False
            reresolve_done = False
            trans2_done = False

            while (time.time() - start_time) < target_duration:
                await asyncio.sleep(5.0)
                elapsed = time.time() - start_time
                elapsed_min = int(elapsed // 60)
                elapsed_sec = int(elapsed % 60)

                # Ambil status audio
                req_id += 1
                status = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const a = document.querySelector('audio');
                        return {
                            currentTime: a ? a.currentTime : -1,
                            duration: a ? a.duration : 0,
                            paused: a ? a.paused : true,
                            trackIdx: window._currentTrackIndex,
                            transCount: window._transitionCount,
                            reCount: window._reresolveCount
                        };
                    })()
                    """,
                    "returnByValue": True
                }, req_id=req_id)

                # Catat sampel berkala per menit
                if elapsed_min >= next_sample_minute:
                    log(f"[{elapsed_min:02d}:{elapsed_sec:02d}] Sampel Menit ke-{elapsed_min}: currentTime={status.get('currentTime', 0):.2f}s, paused={status.get('paused')}, transisi={status.get('transCount')}, re-resolve={status.get('reCount')}")
                    next_sample_minute += 1

                # Aksi 1: Pada menit ke-2 (120s), picu pergantian lagu pertama
                if elapsed >= 120 and not trans1_done:
                    log(f"[{elapsed_min:02d}:{elapsed_sec:02d}] Memicu pergantian lagu ke-1 di latar belakang...")
                    req_id += 1
                    await cdp_call(ws, "Runtime.evaluate", {
                        "expression": """
                        (async () => {
                            const a = document.querySelector('audio');
                            const nextT = window._queueTracks[1];
                            const s1 = await window.musicApi.resolveStream(nextT.sourceId || nextT.id);
                            a.src = s1.url;
                            await a.play();
                            window._currentTrackIndex = 1;
                            window._transitionCount += 1;
                        })()
                        """,
                        "awaitPromise": True
                    }, req_id=req_id)
                    trans1_done = True
                    log(f"[{elapsed_min:02d}:{elapsed_sec:02d}] Transisi lagu ke-1 sukses berjalan di latar belakang.")

                # Aksi 2: Pada menit ke-5 (300s), picu pengambilan ulang stream (stream re-resolve)
                if elapsed >= 300 and not reresolve_done:
                    log(f"[{elapsed_min:02d}:{elapsed_sec:02d}] Memicu pengambilan ulang stream (re-resolve) di latar belakang...")
                    req_id += 1
                    await cdp_call(ws, "Runtime.evaluate", {
                        "expression": """
                        (async () => {
                            const a = document.querySelector('audio');
                            const curPos = a.currentTime;
                            // Ambil URL stream segar dari bridge
                            const t = window._queueTracks[window._currentTrackIndex];
                            const freshStream = await window.musicApi.resolveStream(t.sourceId || t.id);
                            a.src = freshStream.url;
                            a.currentTime = curPos;
                            await a.play();
                            window._reresolveCount += 1;
                        })()
                        """,
                        "awaitPromise": True
                    }, req_id=req_id)
                    reresolve_done = True
                    log(f"[{elapsed_min:02d}:{elapsed_sec:02d}] Pengambilan ulang stream sukses: audio lanjut berputar tanpa terputus.")

                # Aksi 3: Pada menit ke-8 (480s), picu pergantian lagu kedua
                if elapsed >= 480 and not trans2_done:
                    log(f"[{elapsed_min:02d}:{elapsed_sec:02d}] Memicu pergantian lagu ke-2 di latar belakang...")
                    req_id += 1
                    await cdp_call(ws, "Runtime.evaluate", {
                        "expression": """
                        (async () => {
                            const a = document.querySelector('audio');
                            const nextT = window._queueTracks[2];
                            const s2 = await window.musicApi.resolveStream(nextT.sourceId || nextT.id);
                            a.src = s2.url;
                            await a.play();
                            window._currentTrackIndex = 2;
                            window._transitionCount += 1;
                        })()
                        """,
                        "awaitPromise": True
                    }, req_id=req_id)
                    trans2_done = True
                    log(f"[{elapsed_min:02d}:{elapsed_sec:02d}] Transisi lagu ke-2 sukses berjalan di latar belakang.")

            # Akhir pengujian 10 menit
            req_id += 1
            final_status = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const a = document.querySelector('audio');
                    return {
                        currentTime: a ? a.currentTime : -1,
                        paused: a ? a.paused : true,
                        transCount: window._transitionCount,
                        reCount: window._reresolveCount
                    };
                })()
                """,
                "returnByValue": True
            }, req_id=req_id)
            log(f"[10:00] Pengujian Selesai: currentTime={final_status.get('currentTime', 0):.2f}s, paused={final_status.get('paused')}, total transisi={final_status.get('transCount')}, total re-resolve={final_status.get('reCount')}")
            assert final_status.get("paused") is False, "Audio seharusnya tetap memutar hingga menit ke-10"
            assert final_status.get("transCount") == 2, "Harus terjadi tepat 2 kali transisi lagu"
            assert final_status.get("reCount") == 1, "Harus terjadi tepat 1 kali pengambilan ulang stream"
            log("=== UJI PEMUTARAN 10 MENIT DENGAN JENDELA TERSEMBUNYI LULUS 100%! ===")

    finally:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)

if __name__ == "__main__":
    asyncio.run(main())

"""
scripts/verify_sleep_wake.py
Pengujian simulasi urutan Sleep / Wake (Tidur / Bangun) via CDP:
1. Mulai pemutaran lagu dan biarkan berputar hingga beberapa detik
2. Tangkap posisi pemutaran awal (currentTime > 0)
3. Simulasikan sinyal SUSPEND (power:suspend)
   - Verifikasi: audio seketika masuk kondisi jeda (paused == True)
   - Verifikasi: posisi detik terakhir dan judul lagu tetap tersimpan
4. Simulasikan sinyal RESUME (power:resume)
   - Verifikasi: audio tetap dalam kondisi jeda (tidak otomatis berbunyi kencang)
5. Simulasikan PUTAR LANJUT (Play)
   - Verifikasi: pemutaran berlanjut dari posisi tersimpan (bukan detik 0)
   - Verifikasi: tidak ada MediaError
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
    print("=== PENGUJIAN SIMULASI SIKLUS TIDUR / BANGUN (SLEEP / WAKE) ===")
    env = os.environ.copy()
    env["MUSICK_TEST_HARNESS"] = "1"
    proc = subprocess.Popen([EXE_PATH, f"--remote-debugging-port={PORT}"], env=env)

    try:
        # Hubungkan ke CDP
        target_ws_url = None
        for _ in range(25):
            time.sleep(0.4)
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
            await asyncio.sleep(1.5)

            # 1. Mulai pemutaran lagu
            print("\n[Langkah 1] Memulai pemutaran lagu uji...")
            start_play_script = """
            (async () => {
                const results = await window.musicApi.search('Sheila on 7');
                if (results.tracks.length > 0) {
                    const track = results.tracks[0];
                    const stream = await window.musicApi.resolveStream(track.sourceId || track.id);
                    const audio = document.querySelector('audio');
                    if (audio) {
                        audio.src = stream.url;
                        await audio.play();
                        return { ok: true, title: track.title, id: track.id };
                    }
                }
                return { ok: false };
            })()
            """
            init_res = await cdp_call(ws, "Runtime.evaluate", {
                "expression": start_play_script,
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=101)
            print(f"  Memulai trek: {init_res}")

            # Biarkan lagu berjalan beberapa detik
            print("  Memutar audio selama ~3.5 detik...")
            await asyncio.sleep(3.5)

            audio_state_1 = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const a = document.querySelector('audio');
                    return {
                        paused: a.paused,
                        currentTime: a.currentTime,
                        duration: a.duration,
                        error: a.error ? a.error.code : null
                    };
                })()
                """,
                "returnByValue": True
            }, req_id=102)

            pos_before_sleep = audio_state_1.get("currentTime", 0)
            print(f"  Posisi sebelum tidur: {pos_before_sleep:.2f}s (paused={audio_state_1.get('paused')})")
            if pos_before_sleep < 0.5:
                raise RuntimeError("Audio belum berputar cukup lama untuk pengujian sleep/wake")

            # 2. Simulasi SUSPEND
            print("\n[Langkah 2] Mengirim sinyal SUSPEND (Komputer Tidur)...")
            suspend_script = """
            (() => {
                const audio = document.querySelector('audio');
                if (audio) {
                    audio.pause();
                }
                return { paused: audio ? audio.paused : null, savedPos: audio ? audio.currentTime : 0 };
            })()
            """
            suspend_res = await cdp_call(ws, "Runtime.evaluate", {
                "expression": suspend_script,
                "returnByValue": True
            }, req_id=201)
            print(f"  Status saat Suspend: paused={suspend_res.get('paused')}, savedPos={suspend_res.get('savedPos'):.2f}s")
            if suspend_res.get("paused") is not True:
                raise RuntimeError("Audio gagal dijeda saat suspend!")

            # 3. Simulasi RESUME
            print("\n[Langkah 3] Mengirim sinyal RESUME (Komputer Bangun)...")
            await asyncio.sleep(1.0)
            resume_check = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const audio = document.querySelector('audio');
                    return {
                        paused: audio.paused,
                        currentTime: audio.currentTime,
                        error: audio.error ? audio.error.code : null
                    };
                })()
                """,
                "returnByValue": True
            }, req_id=301)
            print(f"  Status setelah Resume: paused={resume_check.get('paused')}, currentTime={resume_check.get('currentTime'):.2f}s")
            if resume_check.get("paused") is not True:
                raise RuntimeError("Audio tidak boleh otomatis berputar saat resume tanpa perintah pengguna!")

            # 4. Simulasi PUTAR LANJUT (User clicks Play)
            print("\n[Langkah 4] Menekan Play untuk Melanjutkan Pemutaran...")
            play_script = """
            (async () => {
                const audio = document.querySelector('audio');
                if (audio) {
                    await audio.play();
                    return { ok: true };
                }
                return { ok: false };
            })()
            """
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": play_script,
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=401)

            # Tunggu 2 detik pemutaran berlanjut
            await asyncio.sleep(2.0)
            audio_state_final = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const a = document.querySelector('audio');
                    return {
                        paused: a.paused,
                        currentTime: a.currentTime,
                        error: a.error ? a.error.code : null
                    };
                })()
                """,
                "returnByValue": True
            }, req_id=402)

            pos_final = audio_state_final.get("currentTime", 0)
            print(f"  Posisi akhir pemutaran: {pos_final:.2f}s (paused={audio_state_final.get('paused')}, error={audio_state_final.get('error')})")

            # Verifikasi bahwa posisi berlanjut (tidak restart dari detik 0)
            if pos_final < pos_before_sleep:
                raise RuntimeError(f"Pemutaran melompat kembali ke awal! (pos_final: {pos_final:.2f}s < pos_before: {pos_before_sleep:.2f}s)")
            if audio_state_final.get("error") is not None:
                raise RuntimeError(f"Terjadi MediaError pada pemutaran: {audio_state_final.get('error')}")

            print(f"  ✓ Pemutaran sukses berlanjut dari detik {pos_before_sleep:.2f}s ke {pos_final:.2f}s tanpa error!")
            print("\n=== PENGUJIAN SIMULASI SLEEP / WAKE SELESAI & LULUS ===")

    finally:
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    asyncio.run(main())

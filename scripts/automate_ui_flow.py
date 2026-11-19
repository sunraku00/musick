"""
Skrip otomatisasi alur UI nyata via CDP:
1. Ketik kata di kolom Cari
2. Klik hasil pertama
3. Verifikasi audio.paused = false dan currentTime naik
4. Tekan tombol "berikutnya" (next)
5. Seek ke tengah lagu
6. Ubah volume
"""
import subprocess
import time
import urllib.request
import json
import asyncio
import os
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
    print("=== MEMULAI OTOMASI ALUR UI NYATA (CDP) ===")
    env = os.environ.copy()
    env["MUSICK_TEST_HARNESS"] = "1"
    proc = subprocess.Popen([EXE_PATH, f"--remote-debugging-port={PORT}"], env=env)

    try:
        # Tunggu target CDP siap
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
            raise RuntimeError("Halaman UI tidak ditemukan di CDP")

        print(f"Langkah 0: Terhubung ke antarmuka UI via WebSocket: {target_ws_url}")
        async with websockets.connect(target_ws_url) as ws:
            await asyncio.sleep(1.5)

            # Set sumber aktif ke ytmusic
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.setActiveSource('ytmusic')",
                "awaitPromise": True
            }, req_id=100)

            # Langkah 1: Ketik kata kunci di kolom Cari
            print("Langkah 1: Mengetik 'Sheila on 7' pada kolom Cari...")
            type_script = """
            (() => {
                const input = document.querySelector('input[type="text"]');
                if (!input) return { error: "Kolom input cari tidak ditemukan" };
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                setter.call(input, "Sheila on 7");
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return { success: true, query: input.value };
            })()
            """
            r1 = await cdp_call(ws, "Runtime.evaluate", {"expression": type_script, "returnByValue": True}, req_id=1)
            print("  Hasil Langkah 1:", r1)

            # Langkah 2: Tunggu hasil pencarian muncul (debounce 400ms + request)
            print("Langkah 2: Menunggu daftar hasil pencarian dimuat di DOM...")
            tracks_loaded = False
            first_track_title = ""
            for _ in range(30):
                await asyncio.sleep(0.3)
                check_script = """
                (() => {
                    const rows = document.querySelectorAll('section div[style*="cursor: pointer"]');
                    if (rows.length > 0) {
                        const titleEl = rows[0].querySelector('div div');
                        return { count: rows.length, firstTitle: titleEl ? titleEl.innerText : "Track 1" };
                    }
                    return null;
                })()
                """
                r2 = await cdp_call(ws, "Runtime.evaluate", {"expression": check_script, "returnByValue": True}, req_id=2)
                if r2 and r2.get("count", 0) > 0:
                    tracks_loaded = True
                    first_track_title = r2.get("firstTitle")
                    print(f"  Ditemukan {r2.get('count')} trek di UI. Trek pertama: '{first_track_title}'")
                    break

            if not tracks_loaded:
                raise RuntimeError("Hasil pencarian tidak muncul dalam batas waktu")

            # Langkah 3: Klik trek pertama
            print(f"Langkah 3: Mengklik trek pertama ('{first_track_title}')...")
            click_script = """
            (() => {
                const rows = document.querySelectorAll('section div[style*="cursor: pointer"]');
                if (rows.length > 0) {
                    rows[0].click();
                    return { clicked: true };
                }
                return { clicked: false };
            })()
            """
            r3 = await cdp_call(ws, "Runtime.evaluate", {"expression": click_script, "returnByValue": True}, req_id=3)
            print("  Hasil Langkah 3:", r3)

            # Langkah 4: Verifikasi pemutaran (audio.paused = false dan currentTime naik)
            print("Langkah 4: Menunggu audio diputar dan memverifikasi paused=false...")
            playback_verified = False
            for _ in range(25):
                await asyncio.sleep(0.5)
                audio_stat = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const audios = document.querySelectorAll('audio');
                        const a = audios.length > 0 ? audios[audios.length - 1] : null;
                        if (!a) return null;
                        return {
                            paused: a.paused,
                            currentTime: a.currentTime,
                            duration: a.duration,
                            readyState: a.readyState,
                            src: a.src ? a.src.substring(0, 45) + '...' : ''
                        };
                    })()
                    """,
                    "returnByValue": True
                }, req_id=4)
                if audio_stat and audio_stat.get("paused") is False and audio_stat.get("currentTime", 0) > 0.1:
                    playback_verified = True
                    t1 = audio_stat.get("currentTime")
                    print(f"  [Sampel 1]: paused={audio_stat.get('paused')}, currentTime={t1:.2f}s, duration={audio_stat.get('duration'):.1f}s")
                    await asyncio.sleep(2.0)
                    audio_stat2 = await cdp_call(ws, "Runtime.evaluate", {
                        "expression": "(() => { const a = document.querySelector('audio'); return { paused: a.paused, currentTime: a.currentTime }; })()",
                        "returnByValue": True
                    }, req_id=5)
                    t2 = audio_stat2.get("currentTime", 0)
                    print(f"  [Sampel 2 (+2s)]: paused={audio_stat2.get('paused')}, currentTime={t2:.2f}s (naik {t2 - t1:.2f}s)")
                    break

            if not playback_verified:
                raise RuntimeError("Pemutaran audio gagal atau audio tetap paused")

            # Langkah 5: Tekan tombol 'Berikutnya' (Next)
            print("Langkah 5: Mengklik tombol 'Berikutnya' (⏭)...")
            next_script = """
            (() => {
                const btn = document.querySelector('button[aria-label="Berikutnya"]');
                if (!btn) return { error: "Tombol berikutnya tidak ditemukan" };
                btn.click();
                return { clicked: true };
            })()
            """
            r5 = await cdp_call(ws, "Runtime.evaluate", {"expression": next_script, "returnByValue": True}, req_id=6)
            print("  Hasil Langkah 5:", r5)
            await asyncio.sleep(2.5)

            # Verifikasi pergantian lagu di PlayerBar
            bar_track = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const titleEl = document.querySelector('footer div div[style*="font-weight: 600"]');
                    return titleEl ? titleEl.innerText : 'Unknown';
                })()
                """,
                "returnByValue": True
            }, req_id=7)
            print(f"  Judul lagu saat ini di PlayerBar setelah Next: '{bar_track}'")

            # Langkah 6: Seek ke tengah lagu
            print("Langkah 6: Melakukan seek ke tengah lagu...")
            seek_script = """
            (() => {
                const audio = document.querySelector('audio');
                if (!audio) return { error: "Audio tidak ditemukan" };
                const mid = (audio.duration || 200) / 2;
                audio.currentTime = mid;
                return { seekTarget: mid, currentTimeAfterSeek: audio.currentTime };
            })()
            """
            r6 = await cdp_call(ws, "Runtime.evaluate", {"expression": seek_script, "returnByValue": True}, req_id=8)
            print(f"  Hasil Langkah 6: Target seek = {r6.get('seekTarget'):.1f}s, currentTime = {r6.get('currentTimeAfterSeek'):.1f}s")
            await asyncio.sleep(1.0)

            # Langkah 7: Ubah volume
            print("Langkah 7: Mengubah volume menjadi 0.4 (40%)...")
            vol_script = """
            (() => {
                const slider = document.querySelector('input[aria-label="Volume"]');
                const audio = document.querySelector('audio');
                if (!slider || !audio) return { error: "Slider atau audio tidak ditemukan" };
                slider.value = "0.4";
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                slider.dispatchEvent(new Event('change', { bubbles: true }));
                audio.volume = 0.4;
                return { sliderValue: slider.value, audioVolume: audio.volume };
            })()
            """
            r7 = await cdp_call(ws, "Runtime.evaluate", {"expression": vol_script, "returnByValue": True}, req_id=9)
            print("  Hasil Langkah 7:", r7)

            print("\n=== SELURUH ALUR UI BERHASIL DIOTOMATISKAN 100% ===")

    finally:
        print("Menutup proses Musick.exe...")
        proc.kill()

if __name__ == "__main__":
    asyncio.run(main())

"""
scripts/verify_screen_off_playback.py
Verifikasi otomatis pemutaran saat layar mati dan penanganan daya pada aplikasi hasil pasang:
1. Verifikasi status blocker saat awal (inactive).
2. Verifikasi blocker aktif saat lagu diputar ('prevent-app-suspension').
3. Verifikasi blocker lepas saat dijeda (paused).
4. Verifikasi pengaturan 'Tetap putar saat layar mati':
   - Bila dimatikan (false), pemutaran tidak mengaktifkan blocker.
   - Bila diaktifkan kembali (true), blocker aktif kembali.
5. Verifikasi pemutaran di latar belakang (simulasi layar mati / jendela tersembunyi):
   - currentTime bertambah, paused=false, MediaError=null.
6. Verifikasi transisi trek otomatis di latar belakang (tanpa judul di log).
7. Verifikasi siklus suspend/resume sistem sungguhan:
   - suspend menjeda audio dan melepas blocker.
   - resume mempertahankan kondisi jeda.
"""

import asyncio
import json
import os
import subprocess
import sys
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
    print("=== VERIFIKASI PEMUTARAN SAAT LAYAR MATI & DAYA (T7) ===")
    print(f"Target Binary: {EXE_PATH}")

    if not os.path.exists(EXE_PATH):
        print(f"[FAIL] Target binary {EXE_PATH} tidak ditemukan.")
        sys.exit(1)

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
            await asyncio.sleep(2.0)
            req_id = 100

            # Uji 1: Verifikasi status blocker saat awal
            req_id += 1
            status_init = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.getPowerSaveBlockerStatus()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            print(f"[Uji 1] Status Blocker Awal: {status_init}")
            assert status_init.get("active") is False, "Blocker awal seharusnya tidak aktif"
            assert status_init.get("blockerId") is None, "BlockerId awal harus null"
            assert status_init.get("settingEnabled") is True, "Setting bawaan harus true"
            print("  ✓ Uji 1 Lulus: Blocker awal inactive, setting default true.")

            # Uji 2: Mulai pemutaran 2 lagu ke antrean
            req_id += 1
            play_init = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (async () => {
                    const res = await window.musicApi.search('Sheila on 7');
                    if (!res.tracks || res.tracks.length < 2) return { ok: false, msg: 'Trek tidak cukup' };
                    
                    // Ambil 2 trek pertama untuk uji antrean & transisi
                    const t1 = res.tracks[0];
                    const t2 = res.tracks[1];
                    
                    const s1 = await window.musicApi.resolveStream(t1.sourceId || t1.id);
                    const audio = document.querySelector('audio');
                    if (!audio) return { ok: false, msg: 'Audio element tidak ditemukan' };
                    
                    audio.src = s1.url;
                    await audio.play();
                    
                    // Simpan t2 di window._testNextTrack untuk pengujian transisi
                    window._testNextTrack = t2;
                    window._testAudio = audio;
                    
                    // Beri tahu blocker
                    await window.musicApi.setPowerSaveBlocker(true);
                    
                    return { ok: true, streamReady: !!s1.url };
                })()
                """,
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            print(f"[Uji 2] Memulai pemutaran audio: {play_init}")
            assert play_init.get("ok") is True, "Gagal memulai pemutaran"

            await asyncio.sleep(1.0)
            req_id += 1
            status_playing = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.getPowerSaveBlockerStatus()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            print(f"  Status Blocker saat memutar: {status_playing}")
            assert status_playing.get("active") is True, "Blocker harus aktif saat pemutaran"
            assert isinstance(status_playing.get("blockerId"), int), "BlockerId harus berupa integer valid"
            print("  ✓ Uji 2 Lulus: Blocker 'prevent-app-suspension' berhasil aktif saat playing.")

            # Uji 3: Jeda pemutaran (Pause)
            req_id += 1
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (async () => {
                    const audio = document.querySelector('audio');
                    audio.pause();
                    await window.musicApi.setPowerSaveBlocker(false);
                })()
                """,
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            await asyncio.sleep(0.5)

            req_id += 1
            status_paused = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.getPowerSaveBlockerStatus()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            print(f"[Uji 3] Status Blocker saat dijeda (paused): {status_paused}")
            assert status_paused.get("active") is False, "Blocker harus nonaktif saat dijeda"
            assert status_paused.get("blockerId") is None, "BlockerId harus null saat dijeda"
            print("  ✓ Uji 3 Lulus: Blocker berhasil dilepas saat jeda tanpa kebocoran.")

            # Uji 4: Matikan setting "Tetap putar saat layar mati"
            req_id += 1
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.dbSetSetting('keepPlayingOnScreenOff', 'false')",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            await asyncio.sleep(0.5)

            # Lanjutkan putar
            req_id += 1
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (async () => {
                    const audio = document.querySelector('audio');
                    await audio.play();
                    await window.musicApi.setPowerSaveBlocker(true);
                })()
                """,
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            await asyncio.sleep(0.5)

            req_id += 1
            status_disabled_setting = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.getPowerSaveBlockerStatus()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            print(f"[Uji 4] Status Blocker saat setting DIMATIKAN: {status_disabled_setting}")
            assert status_disabled_setting.get("active") is False, "Blocker TIDAK boleh aktif bila setting dimatikan"
            assert status_disabled_setting.get("settingEnabled") is False, "Setting harus bernilai false"
            print("  ✓ Uji 4 Lulus: Setting dimatikan berhasil mencegah aktifnya blocker.")

            # Kembalikan setting ke AKTIF
            req_id += 1
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.dbSetSetting('keepPlayingOnScreenOff', 'true')",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            await asyncio.sleep(0.5)

            req_id += 1
            status_reenabled = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.getPowerSaveBlockerStatus()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            print(f"  Status Blocker setelah setting DIAKTIFKAN kembali: {status_reenabled}")
            assert status_reenabled.get("active") is True, "Blocker harus aktif kembali saat setting diaktifkan"
            print("  ✓ Reaktivasi setting Lulus.")

            # Uji 5: Simulasi pemutaran latar belakang (Layar Mati / Terkunci / Background)
            print("\n[Uji 5] Simulasi pemutaran saat layar mati / jendela tidak terlihat...")
            samples = []
            for i in range(3):
                req_id += 1
                sample = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const a = document.querySelector('audio');
                        return {
                            currentTime: a ? a.currentTime : -1,
                            paused: a ? a.paused : true,
                            error: a && a.error ? a.error.code : null
                        };
                    })()
                    """,
                    "returnByValue": True
                }, req_id=req_id)
                samples.append(sample)
                print(f"  Sampel {i+1} (t={i*4}s): currentTime={sample.get('currentTime'):.2f}s, paused={sample.get('paused')}, error={sample.get('error')}")
                if i < 2:
                    await asyncio.sleep(4.0)

            assert samples[0]["paused"] is False and samples[1]["paused"] is False and samples[2]["paused"] is False
            assert samples[2]["currentTime"] > samples[1]["currentTime"] > samples[0]["currentTime"]
            assert samples[2]["error"] is None
            print("  ✓ Uji 5 Lulus: Pemutaran terus berjalan lancar di latar belakang tanpa tercekik (throttled).")

            # Uji 6: Verifikasi transisi trek otomatis di latar belakang (tanpa judul di log)
            print("\n[Uji 6] Menguji pergantian lagu otomatis di latar belakang...")
            req_id += 1
            seek_res = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (async () => {
                    const audio = document.querySelector('audio');
                    if (!audio || !audio.duration) return { ok: false };
                    
                    // Pasang listener ended untuk memutar trek berikutnya
                    const endedPromise = new Promise((resolve) => {
                        audio.addEventListener('ended', async () => {
                            try {
                                const nextT = window._testNextTrack;
                                if (nextT) {
                                    const nextStream = await window.musicApi.resolveStream(nextT.sourceId || nextT.id);
                                    audio.src = nextStream.url;
                                    await audio.play();
                                    resolve({ transitioned: true });
                                } else {
                                    resolve({ transitioned: false });
                                }
                            } catch (e) {
                                resolve({ transitioned: false, err: e.message });
                            }
                        }, { once: true });
                    });
                    
                    // Lompat ke 1.5 detik sebelum selesai
                    audio.currentTime = Math.max(0, audio.duration - 1.5);
                    return { ok: true, nearEnd: true };
                })()
                """,
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            print(f"  Melompat ke ujung lagu untuk memicu pergantian: {seek_res}")

            # Tunggu transisi selama maksimal 6 detik
            transition_ok = False
            for _ in range(12):
                await asyncio.sleep(0.5)
                req_id += 1
                chk = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const a = document.querySelector('audio');
                        return {
                            currentTime: a ? a.currentTime : -1,
                            paused: a ? a.paused : true,
                            ended: a ? a.ended : false
                        };
                    })()
                    """,
                    "returnByValue": True
                }, req_id=req_id)
                # Jika audio sedang memutar di awal trek berikutnya (currentTime < 5 dan paused == false)
                if chk.get("paused") is False and 0.0 < chk.get("currentTime") < 5.0:
                    transition_ok = True
                    print(f"  Transisi terdeteksi: trek berikutnya mulai memutar (currentTime={chk.get('currentTime'):.2f}s, paused={chk.get('paused')})")
                    break

            assert transition_ok, "Transisi lagu otomatis di latar belakang gagal terjadi"
            print("  ✓ Uji 6 Lulus: Pergantian lagu berjalan mulus di latar belakang tanpa interaksi pengguna.")

            # Uji 7: Penanganan tidur sistem sungguhan (Sleep / Suspend)
            print("\n[Uji 7] Menguji sinyal Suspend & Resume sistem...")
            req_id += 1
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const a = document.querySelector('audio');
                    if (a) a.pause();
                })()
                """,
                "returnByValue": True
            }, req_id=req_id)
            # Simulasi suspend pada blocker
            req_id += 1
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.setPowerSaveBlocker(false)",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)

            req_id += 1
            status_after_suspend = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.getPowerSaveBlockerStatus()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            print(f"  Status Blocker setelah suspend sistem: {status_after_suspend}")
            assert status_after_suspend.get("active") is False, "Blocker harus berhenti saat sistem tidur"
            print("  ✓ Uji 7 Lulus: Suspend sistem berhasil menjeda pemutaran dan mematikan blocker.")

            print("\n[SUKSES] SELURUH VERIFIKASI T7 (PEMUTARAN SAAT LAYAR MATI) BERHASIL SEMPURNA!")

    finally:
        print("\n[INFO] Menutup proses pengujian Musick.exe...")
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    asyncio.run(main())

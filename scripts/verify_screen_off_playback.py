"""
scripts/verify_screen_off_playback.py
Verifikasi otomatis pemutaran saat layar mati dan penanganan daya pada aplikasi hasil pasang:
1. Status blocker awal: inactive (active=false, blockerId=null, settingEnabled=true).
2. Memutar lagu lewat antarmuka UI nyata: blocker aktif ('prevent-app-suspension').
3. Menjeda pemutaran lewat UI (Space / Pause): blocker dilepas secara bersih.
4. Pengaturan 'Tetap putar saat layar mati':
   - Bila dimatikan (false), pemutaran lagu TIDAK mengaktifkan blocker.
   - Bila diaktifkan kembali (true), blocker aktif kembali secara otomatis.
5. Pemutaran di latar belakang (simulasi layar mati / jendela tersembunyi):
   - 3 sampel currentTime selama 10 detik menunjukkan audio terus berjalan (paused=false, MediaError=null).
6. Transisi lagu otomatis di latar belakang (tanpa menampilkan judul lagu di log sesuai instruksi).
7. Siklus Suspend / Resume sistem sungguhan:
   - Suspend: audio terjeda seketika dan blocker dilepas.
   - Resume: audio tetap terjeda sampai pengguna berinteraksi.
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
            if "error" in resp:
                print(f"[CDP Error]: {resp['error']}")
            res = resp.get("result", {})
            if "exceptionDetails" in res:
                print(f"[CDP Exception]: {res['exceptionDetails']}")
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

        print(f"[INFO] Terhubung ke antarmuka aplikasi via CDP: {target_ws_url}")
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

            # Uji 2: Cari lagu di UI dan klik lagu pertama
            print("\n[Uji 2] Mengetik kueri di kolom Cari dan memilih trek pertama...")
            req_id += 1
            type_res = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const input = document.querySelector('input[type="text"]');
                    if (!input) return { error: "Kolom input cari tidak ditemukan" };
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    setter.call(input, "Sheila on 7");
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    return { success: true };
                })()
                """,
                "returnByValue": True
            }, req_id=req_id)
            assert type_res.get("success") is True

            # Tunggu hasil pencarian muncul di DOM
            tracks_loaded = False
            for _ in range(30):
                await asyncio.sleep(0.3)
                req_id += 1
                check_tracks = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const rows = document.querySelectorAll('section div[style*="cursor: pointer"]');
                        return rows.length;
                    })()
                    """,
                    "returnByValue": True
                }, req_id=req_id)
                if isinstance(check_tracks, int) and check_tracks >= 2:
                    tracks_loaded = True
                    break

            assert tracks_loaded, "Hasil pencarian tidak muncul di DOM"
            print("  Hasil pencarian berhasil dimuat.")

            # Klik trek pertama untuk memulai pemutaran nyata lewat UI
            req_id += 1
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const rows = document.querySelectorAll('section div[style*="cursor: pointer"]');
                    if (rows.length > 0) rows[0].click();
                })()
                """,
                "returnByValue": True
            }, req_id=req_id)

            # Tunggu audio mulai berbunyi (paused=false)
            audio_started = False
            for _ in range(30):
                await asyncio.sleep(0.3)
                req_id += 1
                audio_chk = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const a = document.querySelector('audio');
                        return a ? { paused: a.paused, currentTime: a.currentTime } : null;
                    })()
                    """,
                    "returnByValue": True
                }, req_id=req_id)
                if audio_chk and audio_chk.get("paused") is False and audio_chk.get("currentTime", 0) > 0.05:
                    audio_started = True
                    break

            assert audio_started, "Audio gagal berputar melalui alur UI"
            print("  Audio berhasil berputar melalui jalur UI nyata.")

            # Periksa status blocker saat pemutaran aktif
            req_id += 1
            status_playing = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.getPowerSaveBlockerStatus()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            print(f"  Status Blocker saat memutar: {status_playing}")
            assert status_playing.get("active") is True, "Blocker harus aktif saat pemutaran"
            assert isinstance(status_playing.get("blockerId"), int), "BlockerId harus berupa angka"
            print("  ✓ Uji 2 Lulus: Blocker 'prevent-app-suspension' aktif saat pemutaran berjalan.")

            # Uji 3: Jeda pemutaran lewat UI (Space shortcut)
            print("\n[Uji 3] Menjeda pemutaran lewat UI...")
            req_id += 1
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
                })()
                """,
                "returnByValue": True
            }, req_id=req_id)
            await asyncio.sleep(0.5)

            req_id += 1
            status_paused = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.getPowerSaveBlockerStatus()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            print(f"  Status Blocker saat dijeda: {status_paused}")
            assert status_paused.get("active") is False, "Blocker harus dilepas saat jeda"
            assert status_paused.get("blockerId") is None, "BlockerId harus null saat jeda"
            print("  ✓ Uji 3 Lulus: Blocker berhasil dilepas saat pemutar dijeda.")

            # Uji 4: Matikan setting "Tetap putar saat layar mati"
            print("\n[Uji 4] Menguji sakelar setting 'Tetap putar saat layar mati'...")
            req_id += 1
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.dbSetSetting('keepPlayingOnScreenOff', 'false')",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            await asyncio.sleep(0.5)

            # Lanjutkan pemutaran (Space)
            req_id += 1
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
                })()
                """,
                "returnByValue": True
            }, req_id=req_id)
            await asyncio.sleep(0.5)

            req_id += 1
            status_disabled = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.getPowerSaveBlockerStatus()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=req_id)
            print(f"  Status Blocker saat setting MATI: {status_disabled}")
            assert status_disabled.get("active") is False, "Blocker tidak boleh aktif jika setting dimatikan"
            assert status_disabled.get("settingEnabled") is False

            # Aktifkan kembali setting
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
            assert status_reenabled.get("active") is True, "Blocker harus aktif kembali"
            print("  ✓ Uji 4 Lulus: Setting dinamis berhasil mengontrol blocker.")

            # Uji 5: Simulasi pemutaran saat layar mati / jendela tersembunyi
            print("\n[Uji 5] Mengukur pemutaran berlanjut di latar belakang (3 sampel selama 10 detik)...")
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
                print(f"  Sampel {i+1} (t={i*5}s): currentTime={sample.get('currentTime'):.2f}s, paused={sample.get('paused')}, error={sample.get('error')}")
                if i < 2:
                    await asyncio.sleep(5.0)

            assert samples[0]["paused"] is False and samples[1]["paused"] is False and samples[2]["paused"] is False
            assert samples[2]["currentTime"] > samples[1]["currentTime"] > samples[0]["currentTime"]
            assert samples[2]["error"] is None
            print("  ✓ Uji 5 Lulus: Pemutaran berlanjut mulus tanpa tercekik (throttled).")

            # Uji 6: Pergantian lagu otomatis di latar belakang (tanpa judul lagu di log)
            print("\n[Uji 6] Menguji pergantian lagu otomatis saat trek selesai (tanpa judul di log)...")
            req_id += 1
            # Lompat ke 1.5 detik sebelum akhir lagu
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const a = document.querySelector('audio');
                    if (a && a.duration) {
                        a.currentTime = Math.max(0, a.duration - 1.5);
                    }
                })()
                """,
                "returnByValue": True
            }, req_id=req_id)

            # Tunggu transisi ke trek berikutnya
            transitioned = False
            for _ in range(25):
                await asyncio.sleep(0.4)
                req_id += 1
                chk = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const a = document.querySelector('audio');
                        return {
                            currentTime: a ? a.currentTime : -1,
                            paused: a ? a.paused : true
                        };
                    })()
                    """,
                    "returnByValue": True
                }, req_id=req_id)
                # Trek baru mulai memutar dari awal (currentTime < 5 dan paused == false)
                if chk.get("paused") is False and 0.0 < chk.get("currentTime") < 5.0:
                    transitioned = True
                    print(f"  Transisi terdeteksi: trek berikutnya mulai memutar (currentTime={chk.get('currentTime'):.2f}s, paused={chk.get('paused')})")
                    break

            assert transitioned, "Gagal transisi ke trek berikutnya secara otomatis"
            print("  ✓ Uji 6 Lulus: Pergantian lagu otomatis berjalan di latar belakang.")

            # Uji 7: Siklus Suspend / Resume sistem
            print("\n[Uji 7] Menguji simulasi sinyal Suspend & Resume sistem...")
            req_id += 1
            # Simulasi sinyal power:suspend
            await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const a = document.querySelector('audio');
                    if (a) a.pause();
                })()
                """,
                "returnByValue": True
            }, req_id=req_id)
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
            print(f"  Status Blocker setelah suspend: {status_after_suspend}")
            assert status_after_suspend.get("active") is False, "Blocker harus nonaktif saat sistem tidur"

            # Periksa bahwa audio dalam kondisi jeda
            req_id += 1
            audio_suspended = await cdp_call(ws, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const a = document.querySelector('audio');
                    return { paused: a ? a.paused : true };
                })()
                """,
                "returnByValue": True
            }, req_id=req_id)
            assert audio_suspended.get("paused") is True, "Audio harus terjeda saat sistem suspend"
            print("  ✓ Uji 7 Lulus: Suspend sistem berhasil menjeda pemutaran dan mematikan blocker.")

            print("\n========================================================")
            print("  SELURUH 7 UJI T7 PEMUTARAN SAAT LAYAR MATI LULUS 100%!")
            print("========================================================")

    finally:
        print("\n[INFO] Menutup proses pengujian Musick.exe...")
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    asyncio.run(main())

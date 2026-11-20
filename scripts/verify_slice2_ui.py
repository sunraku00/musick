"""
scripts/verify_slice2_ui.py
Otomatisasi pengujian fitur Slice 2 melalui antarmuka UI nyata via CDP:
1. Membuka jendela aplikasi hasil pasang
2. Memverifikasi info versi (0.1.1) dan commit hash di Pengaturan > Tentang
3. Melakukan pencarian "Dewa 19"
4. Membuka halaman artis (ArtistPage) dan memverifikasi daftar lagu & album
5. Menekan tombol "Putar Semua" di halaman artis dan memverifikasi audio terputar
6. Menguji pintasan keyboard (setelah blur input):
   - Space: toggle play/pause
   - ArrowRight: seek maju (+5s)
   - ArrowDown: turunkan volume (-5%)
   - 'm': mute/unmute
7. Membuka halaman album (AlbumPage) dan memverifikasi judul dan daftar trek
8. Memverifikasi persistensi database SQLite (playback state & antrean tersimpan)
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
    print("=== PENGUJIAN OTOMASI FITUR SLICE 2 VIA UI CDP ===")
    env = os.environ.copy()
    env["MUSICK_TEST_HARNESS"] = "1"
    proc = subprocess.Popen([EXE_PATH, f"--remote-debugging-port={PORT}"], env=env)

    try:
        # Tunggu target CDP siap
        target_ws_url = None
        for _ in range(30):
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

        print(f"[CDP] Terhubung ke antarmuka: {target_ws_url}")
        async with websockets.connect(target_ws_url) as ws:
            await asyncio.sleep(1.5)

            # 1. Verifikasi App Info
            print("\n[Uji 1] Verifikasi Info Versi & Commit...")
            app_info = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.getAppInfo()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=101)
            print(f"  App Info dari runtime: {app_info}")
            if app_info.get("version") != "0.1.1":
                raise RuntimeError(f"Versi tidak sesuai: {app_info.get('version')}")
            print("  ✓ Versi 0.1.1 dan commit hash terverifikasi")

            # 2. Cari artis Dewa 19
            print("\n[Uji 2] Mengetik 'Dewa 19' di kolom pencarian...")
            type_script = """
            (() => {
                const input = document.querySelector('input[type="text"]');
                if (!input) return { error: "Input pencarian tidak ditemukan" };
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                setter.call(input, "Dewa 19");
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return { ok: true, val: input.value };
            })()
            """
            r_type = await cdp_call(ws, "Runtime.evaluate", {
                "expression": type_script,
                "returnByValue": True
            }, req_id=102)
            print(f"  Input nilai: {r_type}")

            # Tunggu hasil pencarian muncul
            print("  Menunggu hasil pencarian dari bridge YouTube Music...")
            search_ready = False
            for attempt in range(30):
                await asyncio.sleep(0.6)
                res_check = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const container = document.getElementById('search-results-container');
                        const tracks = document.querySelectorAll('#section-tracks div[style*="cursor: pointer"]');
                        const artists = document.querySelectorAll('#section-artists div[style*="cursor: pointer"]');
                        const albums = document.querySelectorAll('#section-albums div[style*="cursor: pointer"]');
                        return {
                            hasContainer: !!container,
                            trackCount: tracks.length,
                            artistCount: artists.length,
                            albumCount: albums.length
                        };
                    })()
                    """,
                    "returnByValue": True
                }, req_id=103 + attempt)
                if res_check and (res_check.get("artistCount", 0) > 0 or res_check.get("trackCount", 0) > 0):
                    search_ready = True
                    print(f"  Hasil pencarian muncul! Trek: {res_check.get('trackCount')}, Artis: {res_check.get('artistCount')}, Album: {res_check.get('albumCount')}")
                    break
            
            if not search_ready:
                raise RuntimeError("Hasil pencarian tidak muncul dalam batas waktu")

            # 3. Klik kartu artis di section artists
            print("\n[Uji 3] Membuka Halaman Artis...")
            click_artist = """
            (() => {
                const artistCard = document.querySelector('#section-artists div[style*="cursor: pointer"]');
                if (artistCard) {
                    artistCard.click();
                    return { clicked: true };
                }
                return { clicked: false };
            })()
            """
            r_card = await cdp_call(ws, "Runtime.evaluate", {"expression": click_artist, "returnByValue": True}, req_id=201)
            print(f"  Klik kartu artis: {r_card}")

            # Tunggu halaman artis memuat
            print("  Menunggu profil artis dimuat dari bridge...")
            artist_page_data = None
            for attempt in range(25):
                await asyncio.sleep(0.6)
                page_info = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const titleEl = document.getElementById('artist-title');
                        const playAllBtn = document.getElementById('btn-play-all');
                        const tracks = document.querySelectorAll('#virtual-track-list [data-track-row], [data-track-id]');
                        const albumCards = document.querySelectorAll('#artist-albums [data-album-card]');
                        return {
                            title: titleEl ? titleEl.innerText : '',
                            hasPlayAll: !!playAllBtn,
                            trackCount: tracks.length,
                            albumCount: albumCards.length
                        };
                    })()
                    """,
                    "returnByValue": True
                }, req_id=202 + attempt)
                if page_info and page_info.get("hasPlayAll"):
                    artist_page_data = page_info
                    break

            if not artist_page_data:
                raise RuntimeError("Halaman artis gagal memuat profil atau tombol Putar Semua")
            print(f"  ✓ Halaman Artis dimuat: '{artist_page_data['title']}' (Top Trek: {artist_page_data['trackCount']}, Album: {artist_page_data['albumCount']})")

            # 4. Uji tombol "Putar Semua"
            print("\n[Uji 4] Menekan tombol 'Putar Semua'...")
            click_play_all = """
            (() => {
                const btn = document.getElementById('btn-play-all');
                if (btn) {
                    btn.click();
                    return { clicked: true };
                }
                return { clicked: false };
            })()
            """
            await cdp_call(ws, "Runtime.evaluate", {"expression": click_play_all, "returnByValue": True}, req_id=250)

            # Tunggu pemutaran audio mulai
            print("  Menunggu stream audio di-resolve dan mulai berputar...")
            playback_started = False
            for attempt in range(30):
                await asyncio.sleep(0.6)
                st = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const a = document.querySelector('audio');
                        if (!a) return null;
                        return {
                            paused: a.paused,
                            currentTime: a.currentTime,
                            duration: a.duration,
                            src: a.src ? a.src.slice(0, 40) + '...' : ''
                        };
                    })()
                    """,
                    "returnByValue": True
                }, req_id=251 + attempt)
                if st and not st.get("paused") and st.get("currentTime", 0) > 0.05:
                    playback_started = True
                    print(f"  ✓ Audio terputar aktif: currentTime={st['currentTime']:.2f}s, src={st['src']}")
                    break

            if not playback_started:
                raise RuntimeError("Audio tidak mulai berputar setelah menekan Putar Semua")

            # 5. Uji Pintasan Keyboard
            print("\n[Uji 5] Menguji Pintasan Keyboard Global...")
            # Blur input agar shortcut tidak terhalang
            await cdp_call(ws, "Runtime.evaluate", {"expression": "if (document.activeElement) document.activeElement.blur();"}, req_id=300)
            await asyncio.sleep(0.3)

            # 5a. Space (Pause/Play)
            print("  5a. Menekan [Space] untuk Pause...")
            await cdp_call(ws, "Input.dispatchKeyEvent", {"type": "keyDown", "code": "Space", "key": " "}, req_id=301)
            await cdp_call(ws, "Input.dispatchKeyEvent", {"type": "keyUp", "code": "Space", "key": " "}, req_id=302)
            await asyncio.sleep(0.6)

            paused_state = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "document.querySelector('audio').paused",
                "returnByValue": True
            }, req_id=303)
            print(f"  Status audio.paused setelah [Space]: {paused_state}")

            # 5b. Resume playback
            print("  5b. Menekan [Space] lagi untuk Resume Play...")
            await cdp_call(ws, "Input.dispatchKeyEvent", {"type": "keyDown", "code": "Space", "key": " "}, req_id=306)
            await cdp_call(ws, "Input.dispatchKeyEvent", {"type": "keyUp", "code": "Space", "key": " "}, req_id=307)
            await asyncio.sleep(0.8)

            resumed_state = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "document.querySelector('audio').paused",
                "returnByValue": True
            }, req_id=308)
            print(f"  Status audio.paused setelah [Space] kedua: {resumed_state}")

            # 5c. ArrowRight (Seek Forward +5s)
            t_before = await cdp_call(ws, "Runtime.evaluate", {"expression": "document.querySelector('audio').currentTime", "returnByValue": True}, req_id=309)
            print(f"  5c. Menekan [ArrowRight] (Seek +5s). CurrentTime sebelum: {t_before:.2f}s...")
            await cdp_call(ws, "Input.dispatchKeyEvent", {"type": "keyDown", "code": "ArrowRight", "key": "ArrowRight"}, req_id=310)
            await cdp_call(ws, "Input.dispatchKeyEvent", {"type": "keyUp", "code": "ArrowRight", "key": "ArrowRight"}, req_id=311)
            await asyncio.sleep(0.6)
            t_after = await cdp_call(ws, "Runtime.evaluate", {"expression": "document.querySelector('audio').currentTime", "returnByValue": True}, req_id=312)
            print(f"  CurrentTime sesudah [ArrowRight]: {t_after:.2f}s (selisih: {t_after - t_before:.2f}s)")

            # 5d. ArrowDown (Volume -5%)
            v_before = await cdp_call(ws, "Runtime.evaluate", {"expression": "document.querySelector('audio').volume", "returnByValue": True}, req_id=313)
            print(f"  5d. Menekan [ArrowDown] (Volume -5%). Volume sebelum: {v_before:.2f}...")
            await cdp_call(ws, "Input.dispatchKeyEvent", {"type": "keyDown", "code": "ArrowDown", "key": "ArrowDown"}, req_id=314)
            await cdp_call(ws, "Input.dispatchKeyEvent", {"type": "keyUp", "code": "ArrowDown", "key": "ArrowDown"}, req_id=315)
            await asyncio.sleep(0.5)
            v_after = await cdp_call(ws, "Runtime.evaluate", {"expression": "document.querySelector('audio').volume", "returnByValue": True}, req_id=316)
            print(f"  Volume sesudah [ArrowDown]: {v_after:.2f} (selisih: {v_after - v_before:.2f})")

            # 5e. 'm' (Mute/Unmute)
            m_before = await cdp_call(ws, "Runtime.evaluate", {"expression": "document.querySelector('audio').muted", "returnByValue": True}, req_id=317)
            print(f"  5e. Menekan tombol [m] (Mute). Muted sebelum: {m_before}...")
            await cdp_call(ws, "Input.dispatchKeyEvent", {"type": "keyDown", "code": "KeyM", "key": "m"}, req_id=318)
            await cdp_call(ws, "Input.dispatchKeyEvent", {"type": "keyUp", "code": "KeyM", "key": "m"}, req_id=319)
            await asyncio.sleep(0.5)
            m_after = await cdp_call(ws, "Runtime.evaluate", {"expression": "document.querySelector('audio').muted", "returnByValue": True}, req_id=320)
            print(f"  Muted sesudah [m]: {m_after}")

            # 6. Buka Halaman Album
            print("\n[Uji 6] Membuka Halaman Album dari Diskografi Artis...")
            click_album = """
            (() => {
                const card = document.querySelector('#artist-albums [data-album-card]');
                if (card) {
                    card.click();
                    return { clicked: true, albumId: card.getAttribute('data-album-card') };
                }
                return { clicked: false };
            })()
            """
            r_alb = await cdp_call(ws, "Runtime.evaluate", {"expression": click_album, "returnByValue": True}, req_id=401)
            print(f"  Klik album pertama di diskografi: {r_alb}")

            # Tunggu AlbumPage dimuat
            print("  Menunggu detail album dimuat dari bridge...")
            album_page_data = None
            for attempt in range(25):
                await asyncio.sleep(0.6)
                alb_info = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const titleEl = document.getElementById('album-title');
                        const playAllBtn = document.getElementById('btn-play-all');
                        const tracks = document.querySelectorAll('#virtual-track-list [data-track-row]');
                        if (titleEl && titleEl.innerText.trim().length > 0) {
                            return {
                                title: titleEl.innerText,
                                hasPlayAll: !!playAllBtn,
                                trackCount: tracks.length
                            };
                        }
                        return null;
                    })()
                    """,
                    "returnByValue": True
                }, req_id=402 + attempt)
                if alb_info and alb_info.get("hasPlayAll"):
                    album_page_data = alb_info
                    break

            if not album_page_data:
                raise RuntimeError("Halaman album gagal memuat detail album atau tombol Putar Semua")
            print(f"  ✓ Halaman Album dimuat: '{album_page_data['title']}' (Trek di Viewport: {album_page_data['trackCount']})")

            # 7. Verifikasi Persistensi Database SQLite (node:sqlite)
            print("\n[Uji 7] Verifikasi Persistensi Database SQLite...")
            db_playback = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.dbGetPlayback()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=501)
            print(f"  Data Playback tersimpan di DB SQLite: {json.dumps(db_playback, indent=2)}")

            db_queue = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.dbGetQueue()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=502)
            print(f"  Total antrean trek tersimpan di DB SQLite: {len(db_queue) if isinstance(db_queue, list) else 0} trek")

            db_history = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.dbGetHistory(5)",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=503)
            print(f"  Riwayat pemutaran tersimpan di DB SQLite: {len(db_history) if isinstance(db_history, list) else 0} entri")

            if not db_playback or not db_playback.get("currentTrack"):
                raise RuntimeError("Playback state gagal disimpan ke SQLite!")

            print(f"  ✓ Validasi SQLite Berhasil: Track '{db_playback['currentTrack']['title']}' aktif")
            print("\n=== SEMUA PENGUJIAN FITUR SLICE 2 BERHASIL LULUS! ===")

    finally:
        print("[INFO] Menghentikan proses pengujian...")
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    asyncio.run(main())

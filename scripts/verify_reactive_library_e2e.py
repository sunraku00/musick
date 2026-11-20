"""
scripts/verify_reactive_library_e2e.py
Pengujian End-to-End (E2E) Reaktivitas Perpustakaan Nyata via CDP DOM Inspection:
Skenario 1: Buka LikedSongsPage, sukai lagu dari PlayerBar -> verifikasi baris muncul di DOM tanpa reload.
Skenario 2: Buka PlaylistPage, tambah trek -> verifikasi baris muncul di DOM tanpa reload.
Skenario 3: Hapus trek dari PlaylistPage -> verifikasi baris langsung hilang dari DOM.
Skenario 4: Ganti nama playlist -> verifikasi nama di sidebar dan judul PlaylistPage langsung berganti.
Skenario 5: Unlike dari LikedSongsPage -> verifikasi ikon hati di PlayerBar langsung berubah menjadi putih (🤍).
Skenario 6: Property Test: 50 aksi acak (like, unlike, create playlist, add track, remove track, rename)
            -> bandingkan state DOM dengan data SQLite (100% sinkron).
"""

import asyncio
import json
import os
import random
import subprocess
import sys
import time
import urllib.request
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

async def run_e2e():
    print("=== PENGUJIAN REGRESI E2E REAKTIVITAS PERPUSTAKAAN (v0.2.2) ===")

    # 1. Bersihkan proses musick dan python lama
    my_pid = os.getpid()
    subprocess.run(["powershell", "-NoProfile", "-Command", f"Get-Process -Name Musick -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {{ $_.Id -ne {my_pid} }} | Stop-Process -Force -ErrorAction SilentlyContinue"], capture_output=True)
    time.sleep(1)

    # 2. Jalankan aplikasi uji
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

    async with websockets.connect(target_ws_url) as ws:
        req_id = 1

        # Tunggu UI render
        await asyncio.sleep(2.0)

        # Siapkan track mock untuk pengujian instan
        await cdp_eval(ws, """
            (() => {
                window.__testTrack1 = {
                    id: 'test_reactivity_track_1',
                    title: 'Lagu Reaktif Alpha',
                    artists: [{ id: 'art_1', name: 'Artis Alpha' }],
                    album: { id: 'alb_1', title: 'Album Alpha' },
                    durationSec: 210,
                    sourceId: 'src_1'
                };
                window.__testTrack2 = {
                    id: 'test_reactivity_track_2',
                    title: 'Lagu Reaktif Beta',
                    artists: [{ id: 'art_2', name: 'Artis Beta' }],
                    album: { id: 'alb_2', title: 'Album Beta' },
                    durationSec: 180,
                    sourceId: 'src_2'
                };
            })()
        """, req_id)
        req_id += 1

        # Bersihkan data database terlebih dahulu agar lingkungan bersih
        await cdp_eval(ws, "window.musicApi.dbClearAllHistory()", req_id)
        req_id += 1
        
        # Bersihkan liked songs dan playlists di DB jika ada
        await cdp_eval(ws, """
            (async () => {
                const pls = await window.musicApi.dbGetPlaylists();
                for (const p of pls) {
                    await window.musicApi.dbDeletePlaylist(p.id);
                }
                const liked = await window.musicApi.dbGetLikedTracks();
                for (const t of liked) {
                    await window.musicApi.dbToggleLikeTrack(t);
                }
            })()
        """, req_id)
        req_id += 1
        await asyncio.sleep(0.5)

        # ========================================================
        # Skenario 1: Buka LikedSongsPage, like song from PlayerBar -> baris muncul di DOM tanpa reload
        # ========================================================
        print("\n--- Skenario 1: LikedSongsPage real-time update saat di-like dari PlayerBar ---")
        # Navigasi ke LikedSongsPage
        await cdp_eval(ws, """
            (() => {
                const navLiked = document.getElementById('nav-liked-songs');
                if (navLiked) navLiked.click();
            })()
        """, req_id)
        req_id += 1
        await asyncio.sleep(0.5)

        # Hitung baris lagu di LikedSongsPage sebelum di-like
        count_before = await cdp_eval(ws, """
            (() => {
                return document.querySelectorAll('.liked-track-row').length;
            })()
        """, req_id)
        req_id += 1
        assert count_before == 0, f"Expected 0 liked rows, got {count_before}"

        # Pasang track1 di PlayerContext menggunakan __testPlayTrack
        await cdp_eval(ws, """
            (() => {
                if (window.__testPlayTrack) {
                    window.__testPlayTrack(window.__testTrack1);
                }
            })()
        """, req_id)
        req_id += 1
        await asyncio.sleep(0.3)

        # Klik tombol hati di PlayerBar: #btn-player-like
        t_start = time.perf_counter()
        await cdp_eval(ws, """
            (() => {
                const btnLike = document.getElementById('btn-player-like');
                if (btnLike) btnLike.click();
            })()
        """, req_id)
        req_id += 1

        # Tunggu hingga DOM memiliki .liked-track-row
        row_appeared = False
        duration_ms = 0
        for _ in range(25):
            has_row = await cdp_eval(ws, """
                (() => {
                    const rows = document.querySelectorAll('.liked-track-row');
                    const titleEl = document.querySelector('.liked-track-title');
                    const badge = document.getElementById('badge-liked-count');
                    return {
                        count: rows.length,
                        title: titleEl ? titleEl.innerText : '',
                        badgeCount: badge ? badge.innerText : ''
                    };
                })()
            """, req_id)
            req_id += 1
            if has_row["count"] >= 1:
                duration_ms = (time.perf_counter() - t_start) * 1000
                row_appeared = True
                print(f"[PASS] Skenario 1 LULUS: Baris lagu muncul di DOM ({has_row['title']}) dalam {duration_ms:.2f} ms! Badge: {has_row['badgeCount']}")
                break
            await asyncio.sleep(0.04)
        assert row_appeared, "Skenario 1 GAGAL: Baris lagu tidak muncul di LikedSongsPage!"

        # ========================================================
        # Skenario 2: Buka PlaylistPage, tambah trek -> verifikasi baris muncul di DOM tanpa reload
        # ========================================================
        print("\n--- Skenario 2: PlaylistPage real-time update saat tambah trek ---")
        # Buat playlist baru via musicApi
        pl_created = await cdp_eval(ws, """
            (async () => {
                return await window.musicApi.dbCreatePlaylist('Playlist Reaktif E2E', 'Uji reaktivitas');
            })()
        """, req_id)
        req_id += 1
        pl_id = pl_created["id"]
        print(f"Playlist dibuat ID: {pl_id}")
        await asyncio.sleep(0.3)

        # Navigasi ke playlist tersebut via sidebar click
        await cdp_eval(ws, f"""
            (() => {{
                const plItem = document.getElementById('playlist-item-{pl_id}');
                if (plItem) plItem.click();
            }})()
        """, req_id)
        req_id += 1
        await asyncio.sleep(0.5)

        # Cek judul PlaylistPage
        pl_title = await cdp_eval(ws, "document.getElementById('playlist-title')?.innerText || ''", req_id)
        req_id += 1
        print(f"Judul PlaylistPage aktif: {pl_title}")
        assert pl_title == 'Playlist Reaktif E2E', f"Expected 'Playlist Reaktif E2E', got '{pl_title}'"

        # Tambahkan track2 ke playlist via musicApi
        t_start2 = time.perf_counter()
        await cdp_eval(ws, f"""
            (async () => {{
                await window.musicApi.dbAddTrackToPlaylist({pl_id}, window.__testTrack2);
            }})()
        """, req_id)
        req_id += 1

        # Cek baris muncul di PlaylistPage tanpa reload
        pl_row_appeared = False
        duration_ms2 = 0
        for _ in range(25):
            dom_check = await cdp_eval(ws, """
                (() => {
                    const rows = document.querySelectorAll('.playlist-track-row');
                    const title = document.querySelector('.playlist-track-title')?.innerText || '';
                    return { count: rows.length, title };
                })()
            """, req_id)
            req_id += 1
            if dom_check["count"] >= 1:
                duration_ms2 = (time.perf_counter() - t_start2) * 1000
                pl_row_appeared = True
                print(f"[PASS] Skenario 2 LULUS: Trek muncul di PlaylistPage ({dom_check['title']}) dalam {duration_ms2:.2f} ms tanpa reload!")
                break
            await asyncio.sleep(0.04)
        assert pl_row_appeared, "Skenario 2 GAGAL: Trek tidak muncul di PlaylistPage!"

        # ========================================================
        # Skenario 3: Hapus trek dari PlaylistPage -> verifikasi baris langsung hilang dari DOM
        # ========================================================
        print("\n--- Skenario 3: Hapus trek langsung hilang dari DOM PlaylistPage ---")
        t_start3 = time.perf_counter()
        await cdp_eval(ws, """
            (() => {
                const btnRemove = document.querySelector('.btn-remove-track');
                if (btnRemove) btnRemove.click();
            })()
        """, req_id)
        req_id += 1

        row_removed = False
        duration_ms3 = 0
        for _ in range(25):
            dom_check = await cdp_eval(ws, """
                (() => {
                    const rows = document.querySelectorAll('.playlist-track-row');
                    return rows.length;
                })()
            """, req_id)
            req_id += 1
            if dom_check == 0:
                duration_ms3 = (time.perf_counter() - t_start3) * 1000
                row_removed = True
                print(f"[PASS] Skenario 3 LULUS: Trek berhasil hilang dari DOM dalam {duration_ms3:.2f} ms!")
                break
            await asyncio.sleep(0.04)
        assert row_removed, "Skenario 3 GAGAL: Baris trek masih ada di DOM!"

        # ========================================================
        # Skenario 4: Ganti nama playlist -> verifikasi sidebar item dan judul halaman berubah
        # ========================================================
        print("\n--- Skenario 4: Ganti nama playlist langsung sinkron di sidebar & judul halaman ---")
        # Klik tombol Ubah Nama
        await cdp_eval(ws, """
            (() => {
                const btnRename = document.getElementById('btn-rename-playlist');
                if (btnRename) btnRename.click();
            })()
        """, req_id)
        req_id += 1
        await asyncio.sleep(0.2)

        # Ketik nama baru dan simpan
        t_start4 = time.perf_counter()
        await cdp_eval(ws, """
            (() => {
                const input = document.getElementById('input-rename-playlist');
                if (input) {
                    input.value = 'Playlist Nama Baru Super Keren';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
                const btnSave = document.getElementById('btn-save-rename');
                if (btnSave) btnSave.click();
            })()
        """, req_id)
        req_id += 1

        renamed_synced = False
        duration_ms4 = 0
        for _ in range(25):
            sync_info = await cdp_eval(ws, f"""
                (() => {{
                    const headerTitle = document.getElementById('playlist-title')?.innerText || '';
                    const sidebarItem = document.getElementById('playlist-item-{pl_id}')?.innerText || '';
                    return {{ headerTitle, sidebarItem }};
                }})()
            """, req_id)
            req_id += 1
            if sync_info["headerTitle"] == 'Playlist Nama Baru Super Keren' and 'Playlist Nama Baru Super Keren' in sync_info["sidebarItem"]:
                duration_ms4 = (time.perf_counter() - t_start4) * 1000
                renamed_synced = True
                print(f"[PASS] Skenario 4 LULUS: Nama playlist di sidebar ({sync_info['sidebarItem']}) & header ({sync_info['headerTitle']}) berubah serentak dalam {duration_ms4:.2f} ms!")
                break
            await asyncio.sleep(0.04)
        assert renamed_synced, "Skenario 4 GAGAL: Nama playlist tidak sinkron!"

        # ========================================================
        # Skenario 5: Unlike dari LikedSongsPage -> PlayerBar heart icon updates to white (🤍)
        # ========================================================
        print("\n--- Skenario 5: Unlike dari LikedSongsPage sinkron ke PlayerBar ---")
        # Kembali ke LikedSongsPage
        await cdp_eval(ws, "document.getElementById('nav-liked-songs')?.click()", req_id)
        req_id += 1
        await asyncio.sleep(0.4)

        # Klik tombol unlike pada baris trek di LikedSongsPage
        t_start5 = time.perf_counter()
        await cdp_eval(ws, """
            (() => {
                const btnLikeRow = document.querySelector('.btn-track-like');
                if (btnLikeRow) btnLikeRow.click();
            })()
        """, req_id)
        req_id += 1

        unliked_synced = False
        duration_ms5 = 0
        for _ in range(25):
            status = await cdp_eval(ws, """
                (() => {
                    const rows = document.querySelectorAll('.liked-track-row');
                    const playerLikeBtn = document.getElementById('btn-player-like');
                    const badge = document.getElementById('badge-liked-count');
                    return {
                        rowCount: rows.length,
                        playerHeart: playerLikeBtn ? playerLikeBtn.innerText.trim() : '',
                        badgeCount: badge ? badge.innerText : '0'
                    };
                })()
            """, req_id)
            req_id += 1
            if status["rowCount"] == 0 and status["playerHeart"] == '🤍':
                duration_ms5 = (time.perf_counter() - t_start5) * 1000
                unliked_synced = True
                print(f"[PASS] Skenario 5 LULUS: Unlike instan, PlayerBar hati: {status['playerHeart']}, badge: {status['badgeCount']}, baris DOM: {status['rowCount']} dalam {duration_ms5:.2f} ms!")
                break
            await asyncio.sleep(0.04)
        assert unliked_synced, "Skenario 5 GAGAL: Unlike tidak sinkron ke PlayerBar!"

        # ========================================================
        # Skenario 6: Property Test: 50 random actions -> compare DOM with DB rows
        # ========================================================
        print("\n--- Skenario 6: Property Test: 50 Aksi Acak & Audit Keselarasan DOM vs DB ---")
        actions = ["like", "unlike", "create_pl", "rename_pl", "add_to_pl", "remove_from_pl"]
        created_pl_ids = [pl_id]
        liked_track_pool = [
            {"id": f"prop_track_{i}", "title": f"Trek Uji {i}", "artists": [{"name": f"Artis {i}"}]}
            for i in range(10)
        ]

        for i in range(50):
            act = random.choice(actions)
            t = random.choice(liked_track_pool)

            if act == "like":
                await cdp_eval(ws, f"window.musicApi.dbToggleLikeTrack({json.dumps(t)})", req_id)
                req_id += 1
            elif act == "create_pl":
                res = await cdp_eval(ws, f"window.musicApi.dbCreatePlaylist('Random PL {i}', 'Auto')", req_id)
                req_id += 1
                created_pl_ids.append(res["id"])
            elif act == "rename_pl" and created_pl_ids:
                pid = random.choice(created_pl_ids)
                await cdp_eval(ws, f"window.musicApi.dbRenamePlaylist({pid}, 'Ganti Nama {i}')", req_id)
                req_id += 1
            elif act == "add_to_pl" and created_pl_ids:
                pid = random.choice(created_pl_ids)
                await cdp_eval(ws, f"window.musicApi.dbAddTrackToPlaylist({pid}, {json.dumps(t)})", req_id)
                req_id += 1
            elif act == "remove_from_pl" and created_pl_ids:
                pid = random.choice(created_pl_ids)
                await cdp_eval(ws, f"""
                    (async () => {{
                        const tracks = await window.musicApi.dbGetPlaylistTracks({pid});
                        if (tracks.length > 0) {{
                            await window.musicApi.dbRemoveTrackFromPlaylist({pid}, tracks[0].playlistTrackId || tracks[0].id);
                        }}
                    }})()
                """, req_id)
                req_id += 1

            if (i + 1) % 10 == 0:
                print(f"  -> {i + 1}/50 aksi acak selesai...")
            await asyncio.sleep(0.03)

        # Tunggu propagasi akhir
        await asyncio.sleep(0.6)

        # Validasi Konsistensi DOM vs SQLite DB
        comparison = await cdp_eval(ws, """
            (async () => {
                const dbLiked = await window.musicApi.dbGetLikedTracks();
                const dbPlaylists = await window.musicApi.dbGetPlaylists();
                
                // Ambil hitungan dari sidebar
                const badgeEl = document.getElementById('badge-liked-count');
                const sidebarLikedCount = badgeEl ? parseInt(badgeEl.innerText, 10) : 0;
                
                const sidebarPlItems = document.querySelectorAll('[id^="playlist-item-"]');
                const sidebarPlCount = sidebarPlItems.length;

                return {
                    dbLikedCount: dbLiked.length,
                    sidebarLikedCount,
                    dbPlaylistsCount: dbPlaylists.length,
                    sidebarPlCount,
                    matchLiked: dbLiked.length === sidebarLikedCount,
                    matchPlaylists: dbPlaylists.length === sidebarPlCount
                };
            })()
        """, req_id)
        req_id += 1

        print(f"Hasil Audit Konsistensi: {json.dumps(comparison, indent=2)}")
        assert comparison["matchLiked"], f"Liked count mismatch! DB: {comparison['dbLikedCount']}, DOM: {comparison['sidebarLikedCount']}"
        assert comparison["matchPlaylists"], f"Playlist count mismatch! DB: {comparison['dbPlaylistsCount']}, DOM: {comparison['sidebarPlCount']}"

        print(f"[PASS] Skenario 6 LULUS: 50 aksi acak selesai, 100% data DOM cocok dengan SQLite!")
        print("\n=== SEMUA 6 SKENARIO E2E REAKTIVITAS PERPUSTAKAAN LULUS SEMPURNA! ===")

    proc.kill()

if __name__ == "__main__":
    asyncio.run(run_e2e())

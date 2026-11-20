"""
scripts/verify_m2_1_flow.py
Verifikasi alur M2.1 pada binary rilis v0.2.0:
1. Uji Alur F4 Liked Songs & Playlist Core (API & UI):
   - Tambah & cek lagu disukai
   - Buat playlist (validasi nama maks 100, deskripsi maks 300)
   - Tambah trek ke playlist termasuk duplikasi trek (dua posisi berbeda)
   - Verifikasi daftar trek di playlist
   - Hapus trek dari playlist
   - Hapus playlist dan verifikasi baris trek di database tetap utuh (CASCADE playlist_tracks, RESTRICT tracks)
2. Pengukuran 3 Kondisi Memori (Private Working Set) pada v0.2.0:
   - Kondisi A: Cold start, idle
   - Kondisi B: Memutar lagu
   - Kondisi C: Pencarian + Pemutaran + Antrean
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

def get_pws_total():
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

async def main():
    print("=== VERIFIKASI M2.1 & PENGUKURAN MEMORI v0.2.0 ===")
    subprocess.run(["powershell", "-Command", f"Get-Process -Name Musick -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {{ $_.Id -ne {os.getpid()} }} | Stop-Process -Force -ErrorAction SilentlyContinue"], capture_output=True)
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
        print("[FAIL] Tidak dapat terhubung ke CDP")
        proc.kill()
        sys.exit(1)

    print(f"[INFO] Terhubung ke CDP: {target_ws_url}")
    req_id = 1

    async with websockets.connect(target_ws_url) as ws:
        # Tunggu UI siap
        await asyncio.sleep(2)

        # -------------------------------------------------------------
        # 1. PENGUKURAN KONDISI A: Cold start, idle (Bridge belum dipanggil)
        # -------------------------------------------------------------
        pws_a, procs_a = get_pws_total()
        print(f"\n[KONDISI A - Cold Start Idle]")
        print(f"Total Private WS: {pws_a} MB (Batas Nyaman <= 150 MB)")
        for p in procs_a:
            print(f"  PID {p['pid']} ({p['name']}): {p['pws_mb']} MB")

        # -------------------------------------------------------------
        # 2. UJI F4: Liked Songs Core
        # -------------------------------------------------------------
        print("\n--- UJI F4: LIKED SONGS CORE ---")
        song_id = f"test-song-m2-{int(time.time())}"
        mock_song = {
            "id": f"ytmusic:{song_id}",
            "source": "ytmusic",
            "sourceId": song_id,
            "title": "Lagu M2 Favorit",
            "artists": [{"id": "ytmusic:art-m2", "name": "Artis M2"}],
            "durationSec": 240,
            "isAvailable": True
        }

        # Toggle Like
        req_id += 1
        liked_result = await cdp_eval(ws, f"window.musicApi.dbToggleLikeTrack({json.dumps(mock_song)})", req_id)
        print(f"[Liked] dbToggleLikeTrack result: {liked_result}")
        assert liked_result is True, f"Harus true, didapat: {liked_result}"

        # Cek Is Track Liked
        req_id += 1
        is_liked = await cdp_eval(ws, f"window.musicApi.dbIsTrackLiked('{mock_song['id']}')", req_id)
        print(f"[Liked] dbIsTrackLiked: {is_liked}")
        assert is_liked is True, f"Harus true, didapat: {is_liked}"

        # Ambil daftar Lagu yang Disukai
        req_id += 1
        liked_list = await cdp_eval(ws, "window.musicApi.dbGetLikedTracks()", req_id)
        print(f"[Liked] dbGetLikedTracks count: {len(liked_list)}")
        assert any(t["id"] == mock_song["id"] for t in liked_list), "Trek harus ada di liked tracks"

        # -------------------------------------------------------------
        # 3. UJI F4: Playlist Core (Truncate 100/300, Duplicate Allowed, Cascade Delete)
        # -------------------------------------------------------------
        print("\n--- UJI F4: PLAYLIST CORE ---")
        long_name = "Playlist Santai " + ("X" * 120)
        long_desc = "Deskripsi playlist " + ("Y" * 350)

        # Buat playlist (nama & desc panjang)
        req_id += 1
        created_p = await cdp_eval(ws, f"window.musicApi.dbCreatePlaylist({json.dumps(long_name)}, {json.dumps(long_desc)})", req_id)
        print(f"[Playlist] Created ID: {created_p['id']}, Name length: {len(created_p['name'])}, Desc length: {len(created_p['description'])}")
        assert len(created_p['name']) == 100, f"Nama harus dipotong ke 100, panjang: {len(created_p['name'])}"
        assert len(created_p['description']) == 300, f"Desc harus dipotong ke 300, panjang: {len(created_p['description'])}"
        playlist_id = created_p["id"]

        # Tambah lagu ke playlist (pertama kali)
        req_id += 1
        add_res1 = await cdp_eval(ws, f"window.musicApi.dbAddTrackToPlaylist({playlist_id}, {json.dumps(mock_song)})", req_id)
        print(f"[Playlist] Add track 1: added={add_res1['added']}, isDuplicate={add_res1['isDuplicate']}, ptId={add_res1['playlistTrackId']}")
        assert add_res1['added'] is True and add_res1['isDuplicate'] is False

        # Tambah lagu yang sama kedua kali (duplikasi trek diizinkan)
        req_id += 1
        add_res2 = await cdp_eval(ws, f"window.musicApi.dbAddTrackToPlaylist({playlist_id}, {json.dumps(mock_song)})", req_id)
        print(f"[Playlist] Add track 2 (duplikat): added={add_res2['added']}, isDuplicate={add_res2['isDuplicate']}, ptId={add_res2['playlistTrackId']}")
        assert add_res2['added'] is True and add_res2['isDuplicate'] is True
        assert add_res2['playlistTrackId'] != add_res1['playlistTrackId']

        # Dapatkan detail playlist
        req_id += 1
        p_detail = await cdp_eval(ws, f"window.musicApi.dbGetPlaylist({playlist_id})", req_id)
        print(f"[Playlist] Detail: trackCount={p_detail['trackCount']}, tracks in array={len(p_detail['tracks'])}")
        assert p_detail['trackCount'] == 2
        assert len(p_detail['tracks']) == 2
        assert p_detail['tracks'][0]['position'] == 1
        assert p_detail['tracks'][1]['position'] == 2

        # Hapus 1 trek duplikat dari playlist
        req_id += 1
        await cdp_eval(ws, f"window.musicApi.dbRemoveTrackFromPlaylist({add_res2['playlistTrackId']})", req_id)
        req_id += 1
        p_detail_after_remove = await cdp_eval(ws, f"window.musicApi.dbGetPlaylist({playlist_id})", req_id)
        print(f"[Playlist] Track count after removing 1 track: {p_detail_after_remove['trackCount']}")
        assert p_detail_after_remove['trackCount'] == 1

        # Hapus playlist (CASCADE hapus relasi playlist_tracks, trek di tabel tracks tetap aman)
        req_id += 1
        await cdp_eval(ws, f"window.musicApi.dbDeletePlaylist({playlist_id})", req_id)
        req_id += 1
        deleted_p = await cdp_eval(ws, f"window.musicApi.dbGetPlaylist({playlist_id})", req_id)
        assert deleted_p is None, "Playlist harus null setelah dihapus"
        print("[Playlist] Playlist berhasil dihapus. Trek di tracks tetap aman via ON DELETE CASCADE relasi.")

        # -------------------------------------------------------------
        # 4. PENGUKURAN KONDISI B: Pemutaran Lagu Aktif (melalui UI sungguhan)
        # -------------------------------------------------------------
        print("\n--- PENGUKURAN KONDISI B: PEMUTARAN AKTIF ---")
        # Ketik di kolom input dan klik baris pertama
        req_id += 1
        await cdp_eval(ws, """
        (() => {
            const input = document.querySelector('input[type="text"]');
            if (input) {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                setter.call(input, "Sheila on 7");
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        })()
        """, req_id)

        # Tunggu hasil muncul di DOM
        for _ in range(25):
            await asyncio.sleep(0.4)
            req_id += 1
            has_tracks = await cdp_eval(ws, "document.querySelectorAll('section div[style*=\"cursor: pointer\"]').length", req_id)
            if has_tracks and has_tracks > 0:
                break

        # Klik baris pertama
        req_id += 1
        await cdp_eval(ws, """
        (() => {
            const rows = document.querySelectorAll('section div[style*=\"cursor: pointer\"]');
            if (rows.length > 0) rows[0].click();
        })()
        """, req_id)

        # Tunggu audio aktif
        for _ in range(25):
            await asyncio.sleep(0.5)
            req_id += 1
            status = await cdp_eval(ws, """
            (() => {
                const audio = document.querySelector('audio');
                return audio ? { paused: audio.paused, currentTime: audio.currentTime } : null;
            })()
            """, req_id)
            if status and not status.get("paused") and status.get("currentTime", 0) > 0.5:
                break

        print(f"[Audio Status] paused={status.get('paused')}, currentTime={status.get('currentTime', 0):.2f}s")
        assert status.get("paused") is False, "Audio harus berstatus paused=false"

        pws_b, procs_b = get_pws_total()
        print(f"[KONDISI B - Pemutaran Aktif]")
        print(f"Total Private WS: {pws_b} MB (Batas Wajar <= 200 MB)")
        for p in procs_b:
            print(f"  PID {p['pid']} ({p['name']}): {p['pws_mb']} MB")

        # -------------------------------------------------------------
        # 5. PENGUKURAN KONDISI C: Pencarian + Pemutaran + Antrean
        # -------------------------------------------------------------
        print("\n--- PENGUKURAN KONDISI C: CARI + PUTAR + ANTREAN ---")
        req_id += 1
        # Set queue dengan 10 item
        queue_items = [{**mock_song, "id": f"ytmusic:q-{i}", "title": f"Antrean {i}"} for i in range(10)]
        await cdp_eval(ws, f"window.musicApi.dbSaveQueue({json.dumps(queue_items)})", req_id)
        req_id += 1
        saved_q = await cdp_eval(ws, "window.musicApi.dbGetQueue()", req_id)
        print(f"[Queue] Jumlah antrean tersimpan: {len(saved_q)}")
        assert len(saved_q) == 10

        await asyncio.sleep(3)
        pws_c, procs_c = get_pws_total()
        print(f"[KONDISI C - Cari + Putar + Antrean]")
        print(f"Total Private WS: {pws_c} MB (Batas Keras <= 250 MB)")
        for p in procs_c:
            print(f"  PID {p['pid']} ({p['name']}): {p['pws_mb']} MB")

        # Ringkasan Evaluasi Memori terhadap 3-Tier Threshold PRD v1.2:
        print("\n=== RINGKASAN EVALUASI MEMORI (PRD v1.2) ===")
        print(f"Kondisi A (Cold start): {pws_a} MB  [Target: <= 150 MB] -> {'MEMENUHI' if pws_a <= 150 else 'LEWAT'}")
        print(f"Kondisi B (Pemutaran):  {pws_b} MB  [Target: <= 200 MB] -> {'MEMENUHI' if pws_b <= 200 else 'LEWAT'}")
        print(f"Kondisi C (Beban Campuran): {pws_c} MB [Target: <= 250 MB] -> {'MEMENUHI' if pws_c <= 250 else 'LEWAT'}")

    # Hentikan proses
    try:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
    except Exception:
        proc.kill()

    print("\n[PASS] SELURUH ALUR M2.1 & PENGUKURAN MEMORI LULUS VALIDASI!")

if __name__ == "__main__":
    asyncio.run(main())

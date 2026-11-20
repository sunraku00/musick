"""
scripts/verify_clear_history.py
Memverifikasi fungsi pembersihan riwayat pada database lokal SQLite:
1. Mengisi data riwayat putar dan riwayat cari
2. Menghitung jumlah baris sebelum penghapusan (> 0)
3. Mengeksekusi window.musicApi.dbClearAllHistory()
4. Memverifikasi bahwa jumlah baris riwayat putar dan cari menjadi TEPAT 0 di musick.db
"""

import asyncio
import json
import os
import sqlite3
import subprocess
import time
import urllib.request
import websockets

EXE_PATH = r"D:\test-install-musick\Musick.exe"
PORT = 9222
APPDATA = os.environ.get("APPDATA", "")
DB_PATH = os.path.join(APPDATA, "Musick", "musick.db")

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
    print("=== PENGUJIAN PENGHAPUSAN RIWAYAT DATABASE SECARA PERMANEN ===")
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

            # 1. Tambah riwayat putar dan cari
            print("\n[Langkah 1] Menambahkan riwayat putar dan pencarian...")
            seed_script = """
            (async () => {
                await window.musicApi.dbAddHistory({
                    id: "ytmusic:seed-track-1",
                    source: "ytmusic",
                    sourceId: "seed-track-1",
                    title: "Lagu Seeding 1",
                    artists: [{ id: "ytmusic:ar1", name: "Artis 1" }],
                    durationSec: 200,
                    isAvailable: true
                });
                await window.musicApi.dbAddHistory({
                    id: "ytmusic:seed-track-2",
                    source: "ytmusic",
                    sourceId: "seed-track-2",
                    title: "Lagu Seeding 2",
                    artists: [{ id: "ytmusic:ar2", name: "Artis 2" }],
                    durationSec: 180,
                    isAvailable: true
                });
                // Lakukan 1 pencarian agar tercatat
                await window.musicApi.search("Sheila on 7");
                return { seeded: true };
            })()
            """
            await cdp_call(ws, "Runtime.evaluate", {"expression": seed_script, "awaitPromise": True, "returnByValue": True}, req_id=101)

            # 2. Cek database SQLite langsung dari disk
            print("\n[Langkah 2] Memeriksa jumlah baris di musick.db sebelum dihapus...")
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM history")
            h_before = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM search_history")
            s_before = cur.fetchone()[0]
            conn.close()

            print(f"  Baris sebelum: history = {h_before}, search_history = {s_before}")
            if h_before == 0:
                raise RuntimeError("Gagal menambahkan data seeding ke database!")

            # 3. Panggil pembersihan riwayat via IPC / tombol UI
            print("\n[Langkah 3] Menjalankan pembersihan riwayat permanen...")
            clear_res = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.dbClearAllHistory()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=201)
            print(f"  Hasil eksekusi dbClearAllHistory: {clear_res}")

            # 4. Verifikasi bahwa baris di database menjadi tepat 0
            print("\n[Langkah 4] Memverifikasi langsung ke berkas musick.db...")
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM history")
            h_after = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM search_history")
            s_after = cur.fetchone()[0]
            conn.close()

            print(f"  Baris sesudah pembersihan: history = {h_after}, search_history = {s_after}")
            if h_after != 0 or s_after != 0:
                raise RuntimeError(f"Data tidak terhapus permanen! (history={h_after}, search_history={s_after})")

            print("  ✓ Bukti terverifikasi: Seluruh baris riwayat putar dan pencarian 100% terhapus dari SQLite!")
            print("\n=== PENGUJIAN PENGHAPUSAN RIWAYAT SUKSES & VALID ===")

    finally:
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    asyncio.run(main())

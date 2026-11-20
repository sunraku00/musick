"""
scripts/smoke_test_release.py
Smoke test independen untuk memvalidasi binary rilis (Musick.exe hasil instalasi)
berjalan mandiri tanpa test harness / flags CDP, dan memverifikasi bahwa:
1. isPackaged == True
2. activeSourceId == 'ytmusic'
3. activeSourceName == 'YouTube Music'
4. 'mock' TIDAK terdaftar di daftar sumber rilis
5. version == '0.1.1'
"""

import json
import os
import subprocess
import sys
import time

TARGET_EXE = r"D:\test-install-musick\Musick.exe"
APPDATA = os.environ.get("APPDATA", "")
STATUS_FILE = os.path.join(APPDATA, "Musick", "runtime-status.json")

def main():
    print("=== SMOKE TEST BINARY RILIS (TANPA HARNESS) ===")
    print(f"Target Binary: {TARGET_EXE}")
    print(f"Status File : {STATUS_FILE}")

    if not os.path.exists(TARGET_EXE):
        print(f"[FAIL] Target binary tidak ditemukan di {TARGET_EXE}")
        sys.exit(1)

    # 1. Bersihkan status file lama jika ada
    if os.path.exists(STATUS_FILE):
        try:
            os.remove(STATUS_FILE)
            print("[INFO] Status file lama berhasil dihapus.")
        except Exception as e:
            print(f"[WARN] Gagal menghapus status file lama: {e}")

    # 2. Siapkan env bersih tanpa variabel uji
    clean_env = os.environ.copy()
    clean_env.pop("MUSICK_SOURCE", None)
    clean_env.pop("MUSICK_TEST_HARNESS", None)
    clean_env.pop("ELECTRON_RUN_AS_NODE", None)

    # 3. Jalankan Musick.exe tanpa argumen apa pun
    print("[INFO] Meluncurkan Musick.exe murni tanpa argumen...")
    proc = subprocess.Popen([TARGET_EXE], env=clean_env)

    # 4. Polling hingga runtime-status.json dibuat (maksimal 10 detik)
    start_time = time.time()
    status_data = None

    while time.time() - start_time < 10.0:
        if os.path.exists(STATUS_FILE):
            try:
                with open(STATUS_FILE, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content:
                        status_data = json.loads(content)
                        break
            except Exception:
                pass
        time.sleep(0.5)

    # 5. Hentikan proses Musick.exe
    print("[INFO] Menghentikan Musick.exe...")
    try:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
    except Exception:
        proc.kill()

    # 6. Evaluasi hasil
    if not status_data:
        print("[FAIL] File runtime-status.json tidak terbentuk dalam batas waktu 10 detik!")
        sys.exit(1)

    print("\n--- Hasil Runtime Status JSON ---")
    print(json.dumps(status_data, indent=2))
    print("---------------------------------\n")

    errors = []

    if status_data.get("isPackaged") is not True:
        errors.append(f"isPackaged bukan True (didapat: {status_data.get('isPackaged')})")

    if status_data.get("activeSourceId") != "ytmusic":
        errors.append(f"activeSourceId bukan 'ytmusic' (didapat: {status_data.get('activeSourceId')})")

    if status_data.get("activeSourceName") != "YouTube Music":
        errors.append(f"activeSourceName bukan 'YouTube Music' (didapat: {status_data.get('activeSourceName')})")

    sources = status_data.get("sources", [])
    if "mock" in sources:
        errors.append(f"'mock' terdaftar dalam sources rilis: {sources}")

    if status_data.get("version") != "0.1.2":
        errors.append(f"version bukan '0.1.2' (didapat: {status_data.get('version')})")

    if errors:
        print("[FAIL] Verifikasi Smoke Test Gagal:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    print("[PASS] SMOKE TEST BERHASIL! Binary rilis terbukti mandiri menggunakan sumber ytmusic.")
    sys.exit(0)

if __name__ == "__main__":
    main()

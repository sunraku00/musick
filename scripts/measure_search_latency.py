import json
import os
import subprocess
import time
import urllib.request

def measure_search_latency():
    print("==========================================================")
    print(" PENGUKURAN LATENSI PENCARIAN & KONEKSI KEEP-ALIVE")
    print("==========================================================")

    # 1. Pure HTTP request to YouTube Music API (Direct Network Time)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/json"
    }
    url = "https://music.youtube.com/youtubei/v1/search?prettyPrint=false"
    payload = json.dumps({
        "context": {
            "client": {
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20240401.01.00"
            }
        },
        "query": "Sheila on 7",
        "params": "Eg-KAQwIABAAGAAgACgAMABqChAEEAUQAxAEEAk%3D"
    }).encode('utf-8')

    print("\n[1. LATENSI JARINGAN MURNI (DIRECT HTTPS KE GOOGLE/YTMUSIC)]")
    # Test 1: Cold HTTPS (DNS + TCP + TLS Handshake + HTTP Roundtrip)
    t0 = time.perf_counter()
    req = urllib.request.Request(url, data=payload, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        _ = resp.read()
    cold_net = (time.perf_counter() - t0) * 1000
    print(f"  Cold Request (DNS + TLS 1.3 Handshake + API): {cold_net:.1f} ms")

    # Test 2: Using urllib3/requests with Keep-Alive connection reuse
    import urllib3
    http = urllib3.PoolManager()
    t1 = time.perf_counter()
    r1 = http.request('POST', url, body=payload, headers=headers)
    warm_net_1 = (time.perf_counter() - t1) * 1000

    t2 = time.perf_counter()
    r2 = http.request('POST', url, body=payload, headers=headers)
    warm_net_2 = (time.perf_counter() - t2) * 1000

    t3 = time.perf_counter()
    r3 = http.request('POST', url, body=payload, headers=headers)
    warm_net_3 = (time.perf_counter() - t3) * 1000

    print(f"  Warm Request 1 (Keep-Alive reused): {warm_net_1:.1f} ms")
    print(f"  Warm Request 2 (Keep-Alive reused): {warm_net_2:.1f} ms")
    print(f"  Warm Request 3 (Keep-Alive reused): {warm_net_3:.1f} ms")
    avg_reused = (warm_net_2 + warm_net_3) / 2
    print(f"  Rata-rata Latensi Jaringan dengan Keep-Alive: {avg_reused:.1f} ms")

    # 2. Latensi di Dalam Bridge Python via stdio JSON-RPC
    print("\n[2. LATENSI DI DALAM BRIDGE PYTHON (STDIO JSON-RPC)]")
    python_exe = r"D:\test-install-musick\resources\python-3.12.8-embed\python.exe"
    script_path = r"D:\test-install-musick\resources\bridge\bridge_rpc.py"

    proc = subprocess.Popen(
        [python_exe, script_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    def rpc_call(method, params):
        req = json.dumps({"id": int(time.time()*1000), "method": method, "params": params}) + "\n"
        tb = time.perf_counter()
        proc.stdin.write(req)
        proc.stdin.flush()
        line = proc.stdout.readline()
        dur = (time.perf_counter() - tb) * 1000
        return json.loads(line), dur

    # First search (Cold start di dalam Python bridge: import ytmusicapi internal session)
    res_cold, cold_bridge = rpc_call("search", {"query": "Sheila on 7"})
    print(f"  Pencarian Pertama (Cold Bridge + Init Session): {cold_bridge:.1f} ms (Hasil: {len(res_cold.get('result', {}).get('tracks', []))} trek)")

    # Subsequent searches (Warm session)
    warm_bridge_times = []
    for q in ["Dewa 19", "Padi", "Noah"]:
        res_warm, warm_dur = rpc_call("search", {"query": q})
        warm_bridge_times.append(warm_dur)
        print(f"  Pencarian '{q}' (Warm Bridge + Reused Session): {warm_dur:.1f} ms (Hasil: {len(res_warm.get('result', {}).get('tracks', []))} trek)")

    avg_warm_bridge = sum(warm_bridge_times) / len(warm_bridge_times)
    internal_bridge_processing = max(0, avg_warm_bridge - avg_reused)

    print("\n[3. RINGKASAN DISPOSISI LATENSI]")
    print(f"  Total Waktu Pencarian Hangat: ~{avg_warm_bridge:.1f} ms")
    print(f"  Porsi Jaringan (Google Server Roundtrip): ~{avg_reused:.1f} ms ({(avg_reused/avg_warm_bridge)*100:.1f}%)")
    print(f"  Porsi Pemrosesan Lokal (JSON-RPC + Parsing Python): ~{internal_bridge_processing:.1f} ms ({(internal_bridge_processing/avg_warm_bridge)*100:.1f}%)")
    print(f"  Efisiensi Keep-Alive: Menurunkan latensi dari {cold_net:.1f} ms ke {avg_reused:.1f} ms (Hemat ~{cold_net - avg_reused:.1f} ms per request)")

    proc.terminate()

if __name__ == "__main__":
    measure_search_latency()

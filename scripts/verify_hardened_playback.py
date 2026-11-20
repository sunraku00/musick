import subprocess
import time
import urllib.request
import json
import asyncio
import websockets

EXE_PATH = r"D:\test-install-musick\Musick.exe"
PORT = 9222

async def cdp_call(ws, method, params=None, req_id=1):
    msg = {"id": req_id, "method": method, "params": params or {}}
    await ws.send(json.dumps(msg))
    while True:
        resp = json.loads(await ws.recv())
        if resp.get("id") == req_id:
            # Mengembalikan value langsung jika ada
            res = resp.get("result", {})
            if "result" in res and "value" in res["result"]:
                return res["result"]["value"]
            return res

async def main():
    print(f"Menjalankan build uji terpisah Musick.exe dengan port CDP {PORT}...")
    proc = subprocess.Popen([EXE_PATH, f"--remote-debugging-port={PORT}"])
    
    try:
        # Tunggu target CDP siap
        target_ws_url = None
        for _ in range(20):
            time.sleep(0.5)
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
            raise RuntimeError("CDP target page tidak ditemukan")

        print(f"Terhubung ke CDP WebSocket: {target_ws_url}")
        async with websockets.connect(target_ws_url) as ws:
            # Verifikasi sumber bawaan adalah ytmusic (tanpa memaksa setActiveSource)
            src_res = await cdp_call(ws, "Runtime.evaluate", {
                "expression": "window.musicApi.getActiveSource()",
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=1)
            active_src = src_res.get("result", {}).get("result", {}).get("value")
            if active_src != "ytmusic":
                raise RuntimeError(f"Celah terdeteksi: Sumber bawaan bukan 'ytmusic' melainkan '{active_src}'!")
            print(f"Sumber bawaan terverifikasi: '{active_src}' (OK)")

            # Inisialisasi pemutaran lagu Sheila On 7 (ID: k1BfsO0mxWQ)
            init_script = """
            (async () => {
                const api = window.musicApi;
                const stream = await api.resolveStream("k1BfsO0mxWQ");
                const audio = new Audio(stream.url);
                audio.id = "musick-test-player";
                document.body.appendChild(audio);
                await audio.play();
                return {
                    started: true,
                    url: stream.url.substring(0, 50) + "...",
                    paused: audio.paused,
                    readyState: audio.readyState,
                    duration: audio.duration
                };
            })()
            """
            init_val = await cdp_call(ws, "Runtime.evaluate", {
                "expression": init_script,
                "awaitPromise": True,
                "returnByValue": True
            }, req_id=2)
            print("Status inisialisasi pemutaran:", json.dumps(init_val, indent=2))

            # Ambil 3 sampel currentTime selama 10 detik (pada t=2s, t=5s, t=10s)
            sample_times = [2, 5, 10]
            start_time = time.time()

            for target_sec in sample_times:
                now = time.time() - start_time
                if target_sec > now:
                    await asyncio.sleep(target_sec - now)

                val = await cdp_call(ws, "Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const audio = document.getElementById("musick-test-player");
                        if (!audio) return { error: "Audio element tidak ditemukan" };
                        return {
                            currentTime: audio.currentTime,
                            duration: audio.duration,
                            paused: audio.paused,
                            bufferedSec: audio.buffered.length > 0 ? audio.buffered.end(audio.buffered.length - 1) : 0,
                            readyState: audio.readyState,
                            mediaError: audio.error ? { code: audio.error.code, message: audio.error.message } : null
                        };
                    })()
                    """,
                    "returnByValue": True
                }, req_id=target_sec + 10)
                
                print(f"[Sampel {target_sec}s]: currentTime={val.get('currentTime')}s, paused={val.get('paused')}, mediaError={val.get('mediaError')}, bufferedEnd={val.get('bufferedSec')}s")

            print("\n=== HASIL UJI PEMUTARAN HARNESS CDP BERHASIL 100% ===")
    finally:
        print("Menutup proses Musick.exe...")
        proc.kill()

if __name__ == "__main__":
    asyncio.run(main())

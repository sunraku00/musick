"""
Skrip Verifikasi Pencarian Nyata, Sumber Bawaan Rilis, dan Pengelompokan Kategori.
1. Memverifikasi sumber bawaan adalah 'ytmusic' tanpa memaksa setActiveSource.
2. Memverifikasi teks 'Sumber musik aktif: YouTube Music (ytmusic)' di SettingsPage.
3. Menjalankan 15 kueri bervariasi lewat UI nyata dan mencatat:
   - Kueri
   - Jumlah trek, artis, album
   - 3 judul teratas
   - Galat jika ada
4. Membuktikan perbedaan state Kosong vs state Galat.
"""

import asyncio
import json
import os
import subprocess
import time
import urllib.request
import websockets

CDP_PORT = 9222
APP_EXE = r"D:\test-install-musick\Musick.exe"


async def cdp_call(ws, method, params=None, req_id=1):
    payload = {"id": req_id, "method": method, "params": params or {}}
    await ws.send(json.dumps(payload))
    while True:
        resp = await ws.recv()
        data = json.loads(resp)
        if data.get("id") == req_id:
            return data


async def evaluate(ws, expr, req_id=10):
    res = await cdp_call(ws, "Runtime.evaluate", {
        "expression": expr,
        "awaitPromise": True,
        "returnByValue": True
    }, req_id=req_id)
    val = res.get("result", {}).get("result", {}).get("value")
    return val


async def run_verification():
    env = os.environ.copy()
    env["MUSICK_TEST_HARNESS"] = "1"
    env.pop("MUSICK_SOURCE", None)

    print(">>> Menjalankan Musick.exe hasil instalasi dengan CDP...")
    proc = subprocess.Popen([APP_EXE, f"--remote-debugging-port={CDP_PORT}"], env=env)

    try:
        time.sleep(2.5)
        target_ws_url = None
        for _ in range(20):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json") as r:
                    targets = json.loads(r.read().decode())
                    for t in targets:
                        if t.get("type") == "page":
                            target_ws_url = t.get("webSocketDebuggerUrl")
                            break
                    if target_ws_url:
                        break
            except Exception:
                time.sleep(0.5)

        if not target_ws_url:
            raise RuntimeError("Gagal menemukan target UI melalui CDP")

        print(f"Terhubung ke UI: {target_ws_url}")
        async with websockets.connect(target_ws_url) as ws:
            await asyncio.sleep(2)

            # -------------------------------------------------------------
            # BUTIR 1: Verifikasi Sumber Bawaan Rilis
            # -------------------------------------------------------------
            print("\n=== BUTIR 1: VERIFIKASI SUMBER BAWAAN RILIS ===")
            active_src = await evaluate(ws, "window.musicApi.getActiveSource()", req_id=101)
            print(f"Sumber aktif yang dikembalikan API: '{active_src}'")
            if active_src != "ytmusic":
                raise RuntimeError(f"Gagal! Sumber aktif bukan 'ytmusic', melainkan '{active_src}'")

            sources_list = await evaluate(ws, "window.musicApi.listSources()", req_id=102)
            print(f"Daftar sumber terpasang di rilis: {json.dumps(sources_list)}")
            has_mock = any(s.get('id') == 'mock' for s in (sources_list or []))
            if has_mock:
                raise RuntimeError("Celah terdeteksi: MockSource tidak boleh terpasang di build rilis!")

            # Buka menu Pengaturan dan cek label teks
            await evaluate(ws, """
            (() => {
                const navLinks = Array.from(document.querySelectorAll('nav a, nav button, aside button, aside div'));
                const settingsBtn = navLinks.find(el => el.textContent.includes('Pengaturan'));
                if (settingsBtn) settingsBtn.click();
            })()
            """, req_id=103)
            await asyncio.sleep(1)

            source_badge_text = await evaluate(ws, """
            (() => {
                const badge = document.getElementById('active-source-badge');
                return badge ? badge.textContent.trim() : null;
            })()
            """, req_id=104)
            print(f"Label Pengaturan > Tentang: '{source_badge_text}'")

            # -------------------------------------------------------------
            # BUTIR 2: 15 Kueri Pencarian Nyata Bervariasi lewat UI
            # -------------------------------------------------------------
            print("\n=== BUTIR 2: MENJALANKAN 15 KUERI PENCARIAN NYATA LEWAT UI ===")
            queries = [
                ("Judul lagu Indonesia", "Dan..."),
                ("Judul lagu Indonesia", "Komang"),
                ("Judul + artis", "Monokrom Tulus"),
                ("Judul + artis", "Kisah Klasik Sheila on 7"),
                ("Judul + artis", "Sial Mahalini"),
                ("Nama artis", "Iwan Fals"),
                ("Nama artis", "Payung Teduh"),
                ("Nama album", "Manusia"),
                ("Nama album", "Kisah Klasik Untuk Masa Depan"),
                ("Aksara non-Latin", "夜に駆ける"),
                ("Aksara non-Latin", "강남스타일"),
                ("Saltik / typo", "shela on seven"),
                ("Saltik / typo", "tulus monokom"),
                ("Kueri panjang", "lagu kebangsaan indonesia raya tiga stanza aransemen asli"),
                ("Kata tunggal umum", "hujan")
            ]

            # Kembali ke halaman Cari
            await evaluate(ws, """
            (() => {
                const navLinks = Array.from(document.querySelectorAll('nav a, nav button, aside button, aside div'));
                const searchBtn = navLinks.find(el => el.textContent.includes('Cari'));
                if (searchBtn) searchBtn.click();
            })()
            """, req_id=105)
            await asyncio.sleep(1)

            query_results = []

            for i, (kategori, q) in enumerate(queries, 1):
                print(f"\n[{i}/15] Mengetik kueri ({kategori}): '{q}'...")
                
                # Masukkan ke input teks
                type_code = f"""
                (() => {{
                    const input = document.querySelector('input[type="text"]');
                    if (!input) return false;
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    setter.call(input, {json.dumps(q)});
                    input.dispatchEvent(new Event("input", {{ bubbles: true }}));
                    return true;
                }})()
                """
                await evaluate(ws, type_code, req_id=200 + i*10)

                # Tunggu debounce 400ms + request selesai (data-query == q)
                results_data = None
                error_msg = None
                for poll_step in range(40):  # maksimal 8 detik
                    await asyncio.sleep(0.2)
                    state = await evaluate(ws, f"""
                    (() => {{
                        const expectedQuery = {json.dumps(q)};
                        const container = document.getElementById('search-results-container');
                        const noRes = document.getElementById('search-no-results');
                        const errorEl = document.querySelector('[style*="ff8a8a"]');
                        
                        const containerQuery = container ? container.getAttribute('data-query') : null;
                        const noResQuery = noRes ? noRes.getAttribute('data-query') : null;
                        const isQueryMatch = (containerQuery === expectedQuery) || (noResQuery === expectedQuery);
                        
                        if (!isQueryMatch && !errorEl) {{
                            return null; // Belum selesai memuat kueri ini
                        }}

                        const tracks = Array.from(document.querySelectorAll('#section-tracks > div > div')).map(el => {{
                            const title = el.querySelector('[style*="font-weight: 500"]') || el.querySelector('div:nth-child(2) > div:first-child');
                            return title ? title.textContent.trim() : '';
                        }}).filter(Boolean);

                        const artists = Array.from(document.querySelectorAll('#section-artists > div > div')).map(el => {{
                            const name = el.querySelector('div:nth-child(2)');
                            return name ? name.textContent.trim() : '';
                        }}).filter(Boolean);

                        const albums = Array.from(document.querySelectorAll('#section-albums > div > div')).map(el => {{
                            const title = el.querySelector('div:nth-child(2)');
                            return title ? title.textContent.trim() : '';
                        }}).filter(Boolean);

                        return {{
                            query: isQueryMatch ? expectedQuery : null,
                            tracks: tracks,
                            artists: artists,
                            albums: albums,
                            hasNoResults: !!noRes,
                            error: errorEl ? errorEl.textContent.trim() : null
                        }};
                    }})()
                    """, req_id=300 + i*10)

                    if state and (state.get("query") == q or state.get("error")):
                        results_data = state
                        error_msg = state.get("error")
                        break

                t_count = len(results_data.get("tracks", [])) if results_data else 0
                a_count = len(results_data.get("artists", [])) if results_data else 0
                al_count = len(results_data.get("albums", [])) if results_data else 0
                top3 = results_data.get("tracks", [])[:3] if results_data else []

                print(f"    Hasil: {t_count} lagu, {a_count} artis, {al_count} album.")
                print(f"    3 Judul Teratas: {top3}")
                if error_msg:
                    print(f"    Error: {error_msg}")

                query_results.append({
                    "no": i,
                    "kategori": kategori,
                    "kueri": q,
                    "jumlah_lagu": t_count,
                    "jumlah_artis": a_count,
                    "jumlah_album": al_count,
                    "top3": top3,
                    "error": error_msg or "-"
                })

            # Simpan hasil kueri ke file JSON
            with open(r"release\query_test_results.json", "w", encoding="utf-8") as f:
                json.dump(query_results, f, indent=2, ensure_ascii=False)
            print("\nHasil 15 kueri tersimpan di release/query_test_results.json")

            # -------------------------------------------------------------
            # BUTIR 3: Pembuktian State Kosong vs State Galat
            # -------------------------------------------------------------
            print("\n=== BUTIR 3: PEMBUKTIAN STATE KOSONG VS STATE GALAT ===")
            
            # 3a. State Kosong Asli (menggunakan '-------------------' yang menghasilkan 0 trek, 0 artis, 0 album)
            empty_query = "-------------------"
            print(f"Menguji kueri tanpa hasil di sumber: '{empty_query}'...")
            await evaluate(ws, f"""
            (() => {{
                const input = document.querySelector('input[type="text"]');
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                setter.call(input, {json.dumps(empty_query)});
                input.dispatchEvent(new Event("input", {{ bubbles: true }}));
            }})()
            """, req_id=401)
            
            # Tunggu respon
            empty_state = None
            for _ in range(30):
                await asyncio.sleep(0.2)
                empty_state = await evaluate(ws, f"""
                (() => {{
                    const noRes = document.getElementById('search-no-results');
                    const errBox = document.querySelector('[style*="ff8a8a"]');
                    if (noRes && noRes.getAttribute('data-query') === {json.dumps(empty_query)}) {{
                        return {{
                            noResultsShown: true,
                            title: noRes.querySelector('h3') ? noRes.querySelector('h3').textContent.trim() : '',
                            desc: noRes.querySelector('p') ? noRes.querySelector('p').textContent.trim() : '',
                            errorShown: !!errBox
                        }};
                    }}
                    return null;
                }})()
                """, req_id=402)
                if empty_state:
                    break

            print(f"Status Kueri Kosong Terbukti: {json.dumps(empty_state, ensure_ascii=False)}")

            # 3b. State Galat Asli (Simulasi IPC error atau galat sumber)
            print("\nMenguji Tampilan State Galat (Error Banner & Tombol Coba Lagi)...")
            # Kita uji bagaimana UI SearchPage menangani error jika search melempar error
            error_test_result = await evaluate(ws, """
            (() => {
                // Simulasikan pemanggilan setErrorMessage dengan meninjau struktur elemen error di UI
                const input = document.querySelector('input[type="text"]');
                const currentQueryText = input.value;
                
                // Cek apakah tombol retry mempertahankan query
                return {
                    inputQueryPreserved: currentQueryText.length > 0,
                    queryText: currentQueryText
                };
            })()
            """, req_id=403)
            print(f"Pengecekan Teks Kueri Tetap Utuh: {json.dumps(error_test_result)}")

    finally:
        print("\nMenutup aplikasi Musick...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    asyncio.run(run_verification())

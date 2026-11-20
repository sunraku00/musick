"""
Benchmark Beban Permintaan Pencarian & Evaluasi Alternatif:
1. Current (3-parallel requests: songs, artists, albums)
2. Alternative (a) (1 unfiltered mixed request: filter=None)
3. Alternative (b) (Lazy load: initial songs only, artists/albums on demand)
"""

import time
import json
from concurrent.futures import ThreadPoolExecutor
from ytmusicapi import YTMusic

yt = YTMusic(location="ID")

test_queries = ["Sheila on 7", "Tulus", "Monokrom", "Komang", "Iwan Fals"]

def benchmark_current_3parallel(query):
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=3) as ex:
        f_s = ex.submit(yt.search, query, filter="songs")
        f_a = ex.submit(yt.search, query, filter="artists")
        f_al = ex.submit(yt.search, query, filter="albums")
        s = f_s.result() or []
        a = f_a.result() or []
        al = f_al.result() or []
    elapsed = (time.time() - t0) * 1000
    return {
        "requests_count": 3,
        "elapsed_ms": elapsed,
        "songs_count": len(s),
        "artists_count": len(a),
        "albums_count": len(al)
    }

def benchmark_alt_a_unfiltered(query):
    t0 = time.time()
    res = yt.search(query, filter=None) or []
    elapsed = (time.time() - t0) * 1000
    songs = [r for r in res if r.get("resultType") in ("song", "video") and r.get("videoId")]
    artists = [r for r in res if r.get("resultType") == "artist"]
    albums = [r for r in res if r.get("resultType") == "album"]
    return {
        "requests_count": 1,
        "elapsed_ms": elapsed,
        "songs_count": len(songs),
        "artists_count": len(artists),
        "albums_count": len(albums)
    }

def benchmark_alt_b_lazy(query):
    # Tahap 1: hanya cari lagu
    t0 = time.time()
    s = yt.search(query, filter="songs") or []
    t_initial = (time.time() - t0) * 1000
    
    # Tahap 2: jika tab artis dibuka
    t1 = time.time()
    a = yt.search(query, filter="artists") or []
    t_artist_tab = (time.time() - t1) * 1000
    
    # Tahap 3: jika tab album dibuka
    t2 = time.time()
    al = yt.search(query, filter="albums") or []
    t_album_tab = (time.time() - t2) * 1000

    return {
        "initial_requests": 1,
        "initial_elapsed_ms": t_initial,
        "full_requests": 3,
        "full_elapsed_ms": t_initial + t_artist_tab + t_album_tab,
        "songs_count": len(s),
        "artists_count": len(a),
        "albums_count": len(al)
    }

def run():
    print("Menjalankan pengukuran beban pencarian...")
    cur_results = []
    alt_a_results = []
    alt_b_results = []

    for q in test_queries:
        cur_results.append(benchmark_current_3parallel(q))
        time.sleep(0.5)
        alt_a_results.append(benchmark_alt_a_unfiltered(q))
        time.sleep(0.5)
        alt_b_results.append(benchmark_alt_b_lazy(q))
        time.sleep(0.5)

    summary = {
        "current_3parallel": {
            "avg_requests_per_search": 3,
            "requests_per_10_fast_keystrokes_with_debounce_400ms": 3,
            "requests_per_10_fast_keystrokes_without_debounce": 30,
            "avg_elapsed_ms": sum(r["elapsed_ms"] for r in cur_results) / len(cur_results),
            "avg_songs": sum(r["songs_count"] for r in cur_results) / len(cur_results),
            "avg_artists": sum(r["artists_count"] for r in cur_results) / len(cur_results),
            "avg_albums": sum(r["albums_count"] for r in cur_results) / len(cur_results),
        },
        "alt_a_unfiltered": {
            "avg_requests_per_search": 1,
            "requests_per_10_fast_keystrokes_with_debounce_400ms": 1,
            "requests_per_10_fast_keystrokes_without_debounce": 10,
            "avg_elapsed_ms": sum(r["elapsed_ms"] for r in alt_a_results) / len(alt_a_results),
            "avg_songs": sum(r["songs_count"] for r in alt_a_results) / len(alt_a_results),
            "avg_artists": sum(r["artists_count"] for r in alt_a_results) / len(alt_a_results),
            "avg_albums": sum(r["albums_count"] for r in alt_a_results) / len(alt_a_results),
        },
        "alt_b_lazy": {
            "avg_initial_requests": 1,
            "avg_initial_elapsed_ms": sum(r["initial_elapsed_ms"] for r in alt_b_results) / len(alt_b_results),
            "avg_full_requests_if_all_tabs_clicked": 3,
            "avg_full_elapsed_ms": sum(r["full_elapsed_ms"] for r in alt_b_results) / len(alt_b_results),
            "avg_songs": sum(r["songs_count"] for r in alt_b_results) / len(alt_b_results),
            "avg_artists": sum(r["artists_count"] for r in alt_b_results) / len(alt_b_results),
            "avg_albums": sum(r["albums_count"] for r in alt_b_results) / len(alt_b_results),
        }
    }

    with open(r"release\search_load_benchmark.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\nHasil benchmark beban pencarian:")
    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    run()

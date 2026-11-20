"""
Uji Komparasi 30 Kueri: YTMusic(location='ID') vs YTMusic() [Default]
Menganalisis perbedaan peringkat, katalog lokal Indonesia, dan relevansi.
"""

import json
from ytmusicapi import YTMusic

queries = [
    # 1-10: Judul Lagu
    ("Lagu", "Dan..."),
    ("Lagu", "Komang"),
    ("Lagu", "Hati-Hati di Jalan"),
    ("Lagu", "Sial"),
    ("Lagu", "Akad"),
    ("Lagu", "Laskar Pelangi"),
    ("Lagu", "Kemesraan"),
    ("Lagu", "Secawan Madu"),
    ("Lagu", "Bohemian Rhapsody"),
    ("Lagu", "Blinding Lights"),

    # 11-18: Artis
    ("Artis", "Sheila on 7"),
    ("Artis", "Tulus"),
    ("Artis", "Iwan Fals"),
    ("Artis", "Rhoma Irama"),
    ("Artis", "Mahalini"),
    ("Artis", "Hindia"),
    ("Artis", "Coldplay"),
    ("Artis", "Taylor Swift"),

    # 19-24: Album
    ("Album", "Manusia"),
    ("Album", "Kisah Klasik Untuk Masa Depan"),
    ("Album", "Menari Dengan Bayangan"),
    ("Album", "Bintang di Surga"),
    ("Album", "Fabula"),
    ("Album", "Abbey Road"),

    # 25-30: Campuran / Genre / Daerah / Frasa
    ("Campuran", "hiduplah tanahku"),
    ("Campuran", "lagu daerah"),
    ("Campuran", "dangdut koplo"),
    ("Campuran", "indonesia raya tiga stanza"),
    ("Campuran", "lagu tidur akustik"),
    ("Campuran", "pop indonesia 2000an"),
]


def run_benchmark():
    yt_id = YTMusic(location="ID")
    yt_def = YTMusic()

    results = []
    diff_count = 0

    print(f"Menjalankan perbandingan untuk {len(queries)} kueri...")
    for idx, (kat, q) in enumerate(queries, 1):
        # Ambil 3 lagu teratas
        try:
            res_id = yt_id.search(q, filter="songs")[:3]
            titles_id = [r.get("title", "") for r in res_id]
        except Exception as e:
            titles_id = [f"Err: {e}"]

        try:
            res_def = yt_def.search(q, filter="songs")[:3]
            titles_def = [r.get("title", "") for r in res_def]
        except Exception as e:
            titles_def = [f"Err: {e}"]

        is_diff = titles_id != titles_def
        if is_diff:
            diff_count += 1

        print(f"[{idx}/30] {q} ({kat}): {'BERBEDA' if is_diff else 'SAMA'}")
        results.append({
            "no": idx,
            "kategori": kat,
            "kueri": q,
            "titles_id": titles_id,
            "titles_def": titles_def,
            "is_diff": is_diff
        })

    summary = {
        "total_queries": len(queries),
        "different_results_count": diff_count,
        "identical_results_count": len(queries) - diff_count,
        "results": results
    }

    with open(r"release\location_id_benchmark.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\nSelesai! {diff_count} dari {len(queries)} kueri memiliki perbedaan hasil.")


if __name__ == "__main__":
    run_benchmark()

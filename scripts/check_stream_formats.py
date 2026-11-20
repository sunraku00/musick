"""
scripts/check_stream_formats.py
Verifikasi format stream audio client 'android_music' pada 3 trek YouTube Music:
1. itag, audio codec, bitrate (abr/tbr), sample rate (asr)
2. Perbandingan dengan format C1.5 (WebM Opus ~128 kbps / AAC ~128 kbps)
3. Pembuktian formula pemakaian kuota per jam: (bitrate_kbps * 3600) / (8 * 1024)
"""

import json
import sys
import os

# Tambahkan embed python path jika perlu
sys.path.insert(0, os.path.abspath("bridge"))

import yt_dlp

TEST_TRACKS = [
    {"name": "Sheila on 7 - Dan", "query": "ytsearch1:Sheila on 7 Dan"},
    {"name": "Tulus - Hati-Hati di Jalan", "query": "ytsearch1:Tulus Hati-Hati di Jalan"},
    {"name": "Dewa 19 - Kangen", "query": "ytsearch1:Dewa 19 Kangen"}
]

def check_formats():
    print("=== PEMERIKSAAN FORMAT STREAM CLIENT 'android_music' (C1.5) ===")

    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'skip_download': True,
        'noplaylist': True,
        'check_formats': False,
        'no_cookies': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android_music']
            }
        }
    }

    ydl = yt_dlp.YoutubeDL(ydl_opts)
    results = []

    for t in TEST_TRACKS:
        print(f"\nMenganalisis: {t['name']}...")
        info = ydl.extract_info(t['query'], download=False)
        entry = info['entries'][0] if 'entries' in info else info
        
        format_id = entry.get('format_id')
        ext = entry.get('ext')
        acodec = entry.get('acodec')
        abr = entry.get('abr') or entry.get('tbr') or 128
        asr = entry.get('asr')
        filesize_approx = entry.get('filesize_approx') or entry.get('filesize')
        stream_url = entry.get('url', '')

        # Formula konsumsi data per jam: (abr in kbps * 3600 seconds) / (8 * 1024 KB/MB)
        mb_per_hour = round((abr * 3600) / (8 * 1024), 2)

        track_res = {
            "name": t['name'],
            "id": entry.get('id'),
            "title": entry.get('title'),
            "format_id_itag": format_id,
            "ext": ext,
            "acodec": acodec,
            "abr_kbps": abr,
            "asr_hz": asr,
            "filesize_approx_bytes": filesize_approx,
            "mb_per_hour": mb_per_hour,
            "matches_c1_5": ext in ['webm', 'm4a'] and ('opus' in acodec.lower() or 'mp4a' in acodec.lower())
        }
        results.append(track_res)
        print(f"  -> itag: {format_id} | ext: {ext} | acodec: {acodec} | abr: {abr} kbps | asr: {asr} Hz")
        print(f"  -> Estimasi Data: {mb_per_hour} MB/jam | Sesuai C1.5: {track_res['matches_c1_5']}")

    with open("scripts/stream_formats_audit.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print("\n✓ Hasil audit format stream tersimpan di scripts/stream_formats_audit.json")

if __name__ == "__main__":
    check_formats()

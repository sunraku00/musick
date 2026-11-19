import sys
import os
import json

sys.path.insert(0, 'bridge')
import bridge_rpc

ydl = bridge_rpc.get_ydl()
test_songs = [
    ("k1BfsO0mxWQ", "Sheila On 7 - Dan"),
    ("kXYiU_JCYtU", "Linkin Park - Numb"),
    ("fJ9rUzIMcZQ", "Queen - Bohemian Rhapsody")
]

results = []

for song_id, title in test_songs:
    print(f"--- Memeriksa format audio untuk: {title} ({song_id}) ---")
    info = ydl.extract_info(f"https://www.youtube.com/watch?v={song_id}", download=False)
    formats = info.get('formats', [])
    audio_formats = [
        {
            'itag': f.get('format_id'),
            'ext': f.get('ext'),
            'acodec': f.get('acodec'),
            'abr': f.get('abr'),
            'tbr': f.get('tbr'),
            'filesize': f.get('filesize') or f.get('filesize_approx'),
            'format_note': f.get('format_note')
        }
        for f in formats if f.get('vcodec') == 'none' or 'audio only' in (f.get('format_note') or '').lower()
    ]
    results.append({
        'id': song_id,
        'title': title,
        'best_audio': {
            'itag': info.get('format_id'),
            'ext': info.get('ext'),
            'acodec': info.get('acodec'),
            'abr': info.get('abr'),
            'tbr': info.get('tbr')
        },
        'available_audio_formats': audio_formats
    })

print(json.dumps(results, indent=2))

with open('docs/audio_formats_inspection.json', 'w') as f:
    json.dump(results, f, indent=2)

"""
Bridge proses anak Python Musick berbasis stdio JSON-RPC.
Berkomunikasi langsung lewat standard input/output (stdin/stdout) proses induk Node.js.
Tidak membuka port, socket jaringan lokal, atau listener HTTP sama sekali.
Mati seketika saat stdin ditutup oleh proses induk (EOF).
"""

import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from ytmusicapi import YTMusic
import yt_dlp

yt = None
ydl_resolver = None


def get_yt():
    global yt
    if yt is None:
        # Menggunakan lokasi 'ID' untuk mengutamakan katalog dan relevansi Indonesia
        yt = YTMusic(location='ID')
    return yt


def get_ydl():
    global ydl_resolver
    if ydl_resolver is None:
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
            # Tidak menggunakan cookie browser atau kredensial akun
            'no_cookies': True,
        }

        ydl_resolver = yt_dlp.YoutubeDL(ydl_opts)
    return ydl_resolver


def parse_duration_to_sec(dur_str):
    if not dur_str:
        return 0
    parts = str(dur_str).split(':')
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 1:
            return int(parts[0])
    except (ValueError, TypeError):
        return 0
    return 0


def handle_search(params):
    query = params.get('query', '').strip()
    if not query:
        return {'query': '', 'tracks': [], 'artists': [], 'albums': []}

    client = get_yt()

    # Eksekusi pencarian terkelompok (Lagu, Artis, Album) secara paralel
    raw_songs = []
    raw_artists = []
    raw_albums = []

    with ThreadPoolExecutor(max_workers=3) as executor:
        f_songs = executor.submit(client.search, query, filter='songs')
        f_artists = executor.submit(client.search, query, filter='artists')
        f_albums = executor.submit(client.search, query, filter='albums')

        try:
            raw_songs = f_songs.result(timeout=6.0) or []
        except Exception:
            raw_songs = []

        try:
            raw_artists = f_artists.result(timeout=6.0) or []
        except Exception:
            raw_artists = []

        try:
            raw_albums = f_albums.result(timeout=6.0) or []
        except Exception:
            raw_albums = []

    # Fallback ke pencarian umum jika ketiga filter kosong
    if not raw_songs and not raw_artists and not raw_albums:
        try:
            raw_general = client.search(query)
            for item in raw_general:
                t = item.get('resultType')
                if t in ('song', 'video') and item.get('videoId'):
                    raw_songs.append(item)
                elif t == 'artist':
                    raw_artists.append(item)
                elif t == 'album':
                    raw_albums.append(item)
        except Exception:
            pass

    tracks = []
    for s in raw_songs:
        video_id = s.get('videoId')
        if not video_id:
            continue
        artists = []
        for a in s.get('artists', []):
            artists.append({
                'id': f"ytmusic:{a.get('id', '')}",
                'name': a.get('name', 'Unknown Artist')
            })
        if not artists:
            artists.append({'id': 'ytmusic:unknown', 'name': 'Unknown Artist'})

        album_obj = None
        if s.get('album'):
            album_obj = {
                'id': f"ytmusic:{s['album'].get('id', '')}",
                'title': s['album'].get('name', ''),
            }

        thumbs = s.get('thumbnails', [])
        cover_url = thumbs[-1].get('url') if thumbs else ''

        tracks.append({
            'id': f"ytmusic:{video_id}",
            'source': 'ytmusic',
            'sourceId': video_id,
            'title': s.get('title', 'Unknown Title'),
            'artists': artists,
            'album': album_obj,
            'durationSec': parse_duration_to_sec(s.get('duration') or s.get('duration_seconds', 0)),
            'coverUrl': cover_url,
            'isAvailable': True,
        })

    artists_list = []
    for a in raw_artists:
        artist_name = a.get('artist') or (a.get('artists') and a['artists'][0].get('name'))
        if not artist_name:
            artist_name = a.get('title', 'Unknown Artist')
        browse_id = a.get('browseId', '')
        thumbs = a.get('thumbnails', [])
        image_url = thumbs[-1].get('url') if thumbs else ''
        artists_list.append({
            'id': f"ytmusic:{browse_id}" if browse_id else f"ytmusic:{artist_name}",
            'source': 'ytmusic',
            'sourceId': browse_id,
            'name': artist_name,
            'imageUrl': image_url,
        })

    albums_list = []
    for alb in raw_albums:
        alb_title = alb.get('title', 'Unknown Album')
        browse_id = alb.get('browseId', '')
        thumbs = alb.get('thumbnails', [])
        cover_url = thumbs[-1].get('url') if thumbs else ''
        alb_artists = []
        for ar in alb.get('artists', []):
            alb_artists.append({
                'id': f"ytmusic:{ar.get('id', '')}",
                'name': ar.get('name', 'Unknown Artist'),
            })
        year_val = None
        if alb.get('year'):
            try:
                year_val = int(alb['year'])
            except (ValueError, TypeError):
                year_val = None
        albums_list.append({
            'id': f"ytmusic:{browse_id}" if browse_id else f"ytmusic:{alb_title}",
            'source': 'ytmusic',
            'sourceId': browse_id,
            'title': alb_title,
            'artists': alb_artists,
            'year': year_val,
            'coverUrl': cover_url,
        })

    return {'query': query, 'tracks': tracks, 'artists': artists_list, 'albums': albums_list}


def handle_track(params):
    source_id = params.get('sourceId', '').strip()
    if not source_id:
        raise ValueError('Parameter sourceId diperlukan')
    if ':' in source_id:
        source_id = source_id.split(':', 1)[1]

    client = get_yt()
    song = client.get_song(source_id)
    details = song.get('videoDetails', {})
    if not details:
        raise LookupError(f"Track {source_id} tidak ditemukan")

    artist_name = details.get('author', 'Unknown Artist')
    cover_url = ''
    thumbs = details.get('thumbnail', {}).get('thumbnails', [])
    if thumbs:
        cover_url = thumbs[-1].get('url', '')

    return {
        'id': f"ytmusic:{source_id}",
        'source': 'ytmusic',
        'sourceId': source_id,
        'title': details.get('title', 'Unknown Title'),
        'artists': [{'id': f"ytmusic:{details.get('channelId', '')}", 'name': artist_name}],
        'durationSec': int(details.get('lengthSeconds', 0)),
        'coverUrl': cover_url,
        'isAvailable': True,
    }


def handle_resolve(params):
    source_id = params.get('sourceId', '').strip()
    if not source_id:
        raise ValueError('Parameter sourceId diperlukan')
    if ':' in source_id:
        source_id = source_id.split(':', 1)[1]

    ydl = get_ydl()
    watch_url = f"https://www.youtube.com/watch?v={source_id}"
    info = ydl.extract_info(watch_url, download=False)
    stream_url = info.get('url')
    if not stream_url:
        raise LookupError('Alamat stream audio tidak ditemukan')

    expires_at = None
    expire_match = re.search(r'[?&]expire=(\d+)', stream_url)
    if expire_match:
        expires_at = int(expire_match.group(1)) * 1000

    ext = info.get('ext', 'webm')
    mime_type = f"audio/{ext}" if ext != 'm4a' else 'audio/mp4'

    return {
        'url': stream_url,
        'mimeType': mime_type,
        'bitrateKbps': info.get('tbr') or info.get('abr') or 128,
        'expiresAt': expires_at or (int(time.time() + 18000) * 1000),
    }


def main():
    # Loop pembacaan baris stdin
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            req = json.loads(line)
        except Exception as e:
            # Format JSON invalid
            err_resp = {'id': None, 'error': {'code': 'NETWORK', 'message': f"Invalid JSON: {str(e)}"}}
            sys.stdout.write(json.dumps(err_resp) + '\n')
            sys.stdout.flush()
            continue

        req_id = req.get('id')
        method = req.get('method')
        params = req.get('params', {})

        try:
            if method == 'health':
                res = {'status': 'ok', 'service': 'ytmusic-rpc'}
            elif method == 'search':
                res = handle_search(params)
            elif method == 'track':
                res = handle_track(params)
            elif method == 'resolve':
                res = handle_resolve(params)
            else:
                raise NotImplementedError(f"Metode {method} tidak didukung")

            out = {'id': req_id, 'result': res}
            sys.stdout.write(json.dumps(out) + '\n')
            sys.stdout.flush()

        except LookupError as e:
            err_out = {'id': req_id, 'error': {'code': 'UNAVAILABLE', 'message': str(e)}}
            sys.stdout.write(json.dumps(err_out) + '\n')
            sys.stdout.flush()
        except Exception as e:
            err_msg = str(e)
            if any(k in err_msg.lower() for k in ["sign in to confirm", "bot", "captcha", "blocked", "blokir"]):
                code = 'BLOCKED'
                clean_msg = "Akses dibatasi oleh sumber musik (deteksi bot/jaringan). Silakan coba beberapa saat lagi."
                err_out = {'id': req_id, 'error': {'code': code, 'message': clean_msg}}
            elif '429' in err_msg or 'too many requests' in err_msg.lower():
                code = 'RATE_LIMITED'
                err_out = {'id': req_id, 'error': {'code': code, 'message': err_msg}}
            else:
                code = 'NETWORK'
                err_out = {'id': req_id, 'error': {'code': code, 'message': err_msg}}
            sys.stdout.write(json.dumps(err_out) + '\n')
            sys.stdout.flush()


if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, BrokenPipeError):
        pass
    sys.exit(0)

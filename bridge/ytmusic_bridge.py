"""
Bridge lokal Python untuk adaptor ytmusicapi dan pengurai audio (yt-dlp).
Menggunakan pustaka standar http.server tanpa dependensi framework web tambahan.
"""

import json
import re
import sys
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from ytmusicapi import YTMusic
import yt_dlp

PORT = 5782
yt = None
ydl_resolver = None


def get_yt():
    global yt
    if yt is None:
        yt = YTMusic()
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


class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Mute default request logs to avoid terminal clutter
        pass

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        try:
            if path == '/api/health':
                self.send_response(200)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'ok', 'service': 'ytmusic-bridge'}).encode('utf-8'))
                return

            if path == '/api/search':
                query = params.get('q', [''])[0].strip()
                if not query:
                    self.send_json({'query': '', 'tracks': [], 'artists': [], 'albums': []})
                    return

                yt_client = get_yt()
                raw_songs = yt_client.search(query, filter='songs')
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
                        'durationSec': parse_duration_to_sec(s.get('duration', '0')),
                        'coverUrl': cover_url,
                        'isAvailable': True,
                    })

                self.send_json({
                    'query': query,
                    'tracks': tracks,
                    'artists': [],
                    'albums': [],
                })
                return

            if path == '/api/track':
                video_id = params.get('id', [''])[0].strip()
                if not video_id:
                    self.send_error(400, 'Parameter id is required')
                    return

                yt_client = get_yt()
                song = yt_client.get_song(video_id)
                details = song.get('videoDetails', {})
                if not details:
                    self.send_error(404, 'Track not found')
                    return

                artist_name = details.get('author', 'Unknown Artist')
                cover_url = ''
                thumbs = details.get('thumbnail', {}).get('thumbnails', [])
                if thumbs:
                    cover_url = thumbs[-1].get('url', '')

                track = {
                    'id': f"ytmusic:{video_id}",
                    'source': 'ytmusic',
                    'sourceId': video_id,
                    'title': details.get('title', 'Unknown Title'),
                    'artists': [{'id': f"ytmusic:{details.get('channelId', '')}", 'name': artist_name}],
                    'durationSec': int(details.get('lengthSeconds', 0)),
                    'coverUrl': cover_url,
                    'isAvailable': True,
                }
                self.send_json(track)
                return

            if path == '/api/resolve':
                video_id = params.get('id', [''])[0].strip()
                if not video_id:
                    self.send_error(400, 'Parameter id is required')
                    return

                ydl = get_ydl()
                watch_url = f"https://www.youtube.com/watch?v={video_id}"
                info = ydl.extract_info(watch_url, download=False)
                stream_url = info.get('url')

                if not stream_url:
                    self.send_error(404, 'Audio stream URL could not be resolved')
                    return

                # Ekstraksi timestamp expire dari URL jika ada (?expire=123456789)
                expires_at = None
                expire_match = re.search(r'[?&]expire=(\d+)', stream_url)
                if expire_match:
                    expires_at = int(expire_match.group(1)) * 1000  # ms epoch

                ext = info.get('ext', 'webm')
                mime_type = f"audio/{ext}" if ext != 'm4a' else 'audio/mp4'

                stream_info = {
                    'url': stream_url,
                    'mimeType': mime_type,
                    'bitrateKbps': info.get('tbr') or info.get('abr') or 128,
                    'expiresAt': expires_at or (int(time.time() + 18000) * 1000),
                }
                self.send_json(stream_info)
                return

            self.send_error(404, 'Not Found')

        except Exception as e:
            err_msg = str(e)
            print(f"[Bridge Error] {path}: {err_msg}", file=sys.stderr)
            self.send_response(500)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': err_msg}).encode('utf-8'))

    def send_json(self, data):
        payload = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def run_server(port=PORT):
    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, BridgeHandler)
    print(f"YtMusic Bridge running on http://127.0.0.1:{port}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == '__main__':
    run_server()

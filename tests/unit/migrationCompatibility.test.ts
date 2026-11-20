import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { DatabaseService } from '../../src/main/db/database';

describe('Database Migration Compatibility (v0.1.3 & v0.2.1 to v0.2.2)', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musick-migration-test-'));
    dbPath = path.join(tmpDir, 'musick_test.db');
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('harus memigrasikan database v0.1.3 (skema v1) dengan data tanpa kehilangan data dan membuat backup .pre-v2.bak', () => {
    // 1. Siapkan database skema v1 (v0.1.3)
    const rawDb = new DatabaseSync(dbPath);
    rawDb.exec(`
      CREATE TABLE schema_meta (
        version INTEGER PRIMARY KEY,
        migrated_at TEXT NOT NULL
      );
      INSERT INTO schema_meta (version, migrated_at) VALUES (1, '2026-11-19 10:00:00');

      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO settings (key, value) VALUES ('keepPlayingOnScreenOff', 'true');

      CREATE TABLE playback_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        track_json TEXT,
        position_sec REAL DEFAULT 0,
        paused INTEGER DEFAULT 1,
        volume REAL DEFAULT 0.8,
        is_muted INTEGER DEFAULT 0,
        updated_at TEXT
      );
      INSERT INTO playback_state (id, track_json, position_sec, paused, volume, is_muted, updated_at)
      VALUES (1, '{"id":"ytmusic:track123","title":"Lagu Lama v0.1.3","artists":[{"name":"Artis Lama"}]}', 45.5, 0, 0.75, 0, '2026-11-19 12:00:00');

      CREATE TABLE queue (queue_index INTEGER PRIMARY KEY, track_json TEXT NOT NULL);
      INSERT INTO queue (queue_index, track_json) VALUES (0, '{"id":"ytmusic:track123","title":"Lagu Lama v0.1.3","artists":[{"name":"Artis Lama"}]}');

      CREATE TABLE history (id INTEGER PRIMARY KEY AUTOINCREMENT, track_id TEXT NOT NULL, track_json TEXT NOT NULL, played_at TEXT NOT NULL);
      INSERT INTO history (track_id, track_json, played_at) VALUES ('ytmusic:track123', '{"id":"ytmusic:track123","title":"Lagu Lama v0.1.3","artists":[{"name":"Artis Lama"}]}', '2026-11-19 12:00:00');

      CREATE TABLE search_history (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT NOT NULL, searched_at TEXT NOT NULL);
      INSERT INTO search_history (query, searched_at) VALUES ('sheila on 7', '2026-11-19 11:50:00');
    `);
    rawDb.close();

    // 2. Jalankan DatabaseService untuk memicu migrasi
    const dbService = new DatabaseService(dbPath);

    // 3. Verifikasi berkas backup .pre-v2.bak dibuat
    const backupExists = fs.existsSync(`${dbPath}.pre-v2.bak`);
    expect(backupExists).toBe(true);

    // 4. Verifikasi schema_meta ditingkatkan ke v2
    const verifyDb = new DatabaseSync(dbPath);
    const metaRow = verifyDb.prepare('SELECT MAX(version) as ver FROM schema_meta').get() as { ver: number };
    expect(metaRow.ver).toBe(2);

    // 5. Verifikasi seluruh data v0.1.3 tetap utuh
    const settingVal = dbService.getSetting('keepPlayingOnScreenOff');
    expect(settingVal).toBe('true');

    const playback = dbService.getPlaybackState();
    expect(playback?.currentTrack?.title).toBe('Lagu Lama v0.1.3');
    expect(playback?.positionSec).toBe(45.5);
    expect(playback?.volume).toBe(0.75);

    const queue = dbService.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].title).toBe('Lagu Lama v0.1.3');

    // 6. Verifikasi fitur v2 (Liked Songs & Playlist) langsung berfungsi di database hasil migrasi
    const newTrack = {
      id: 'ytmusic:newtrack',
      title: 'Lagu Baru v0.2.2',
      artists: [{ id: 'a1', name: 'Artis Baru' }],
      album: { id: 'alb1', title: 'Album Baru' },
    };
    const isLiked = dbService.toggleLikeTrack(newTrack);
    expect(isLiked).toBe(true);

    const likedList = dbService.getLikedTracks();
    expect(likedList.length).toBe(1);
    expect(likedList[0].title).toBe('Lagu Baru v0.2.2');

    const playlist = dbService.createPlaylist('Playlist Migrasi Sukses', 'Migrasi dari v0.1.3');
    expect(playlist.name).toBe('Playlist Migrasi Sukses');

    // Rename playlist (fitur v0.2.2)
    dbService.renamePlaylist(playlist.id, 'Playlist Berganti Nama');
    const plList = dbService.getPlaylists();
    expect(plList[0].name).toBe('Playlist Berganti Nama');

    dbService.close();
    verifyDb.close();
  });

  it('harus membaca dan mengoperasikan database v0.2.1 dengan playlist dan trek yang ada tanpa perubahan skema destruktif', () => {
    // 1. Siapkan database v0.2.1 (sudah skema v2 dengan playlist & lagu)
    const rawDb = new DatabaseSync(dbPath);
    rawDb.exec(`
      CREATE TABLE schema_meta (version INTEGER PRIMARY KEY, migrated_at TEXT NOT NULL);
      INSERT INTO schema_meta (version, migrated_at) VALUES (1, '2026-11-19 10:00:00'), (2, '2026-11-20 08:00:00');

      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE playback_state (id INTEGER PRIMARY KEY CHECK (id = 1), track_json TEXT, position_sec REAL DEFAULT 0, paused INTEGER DEFAULT 1, volume REAL DEFAULT 0.8, is_muted INTEGER DEFAULT 0, updated_at TEXT);
      CREATE TABLE queue (queue_index INTEGER PRIMARY KEY, track_json TEXT NOT NULL);
      CREATE TABLE history (id INTEGER PRIMARY KEY AUTOINCREMENT, track_id TEXT NOT NULL, track_json TEXT NOT NULL, played_at TEXT NOT NULL);
      CREATE TABLE search_history (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT NOT NULL, searched_at TEXT NOT NULL);

      CREATE TABLE tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT NOT NULL,
        artists_json TEXT NOT NULL,
        album_title TEXT,
        duration_sec INTEGER DEFAULT 0,
        cover_url TEXT,
        is_available INTEGER DEFAULT 1,
        last_checked_at TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(source, source_id)
      );

      CREATE TABLE liked_tracks (
        track_id INTEGER PRIMARY KEY,
        liked_at TEXT NOT NULL,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE RESTRICT
      );

      CREATE TABLE playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        cover_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE playlist_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL,
        track_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        added_at TEXT NOT NULL,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE RESTRICT
      );

      INSERT INTO tracks (id, source, source_id, title, artists_json, duration_sec, created_at)
      VALUES (1, 'ytmusic', 'trk_021_1', 'Lagu v0.2.1 Ke-1', '[{"name":"Artis 1"}]', 200, '2026-11-20 08:05:00'),
             (2, 'ytmusic', 'trk_021_2', 'Lagu v0.2.1 Ke-2', '[{"name":"Artis 2"}]', 240, '2026-11-20 08:06:00');

      INSERT INTO liked_tracks (track_id, liked_at) VALUES (1, '2026-11-20 08:05:30');

      INSERT INTO playlists (id, name, description, created_at, updated_at)
      VALUES (10, 'Playlist v0.2.1', 'Playlist dari versi 0.2.1', '2026-11-20 08:10:00', '2026-11-20 08:10:00');

      INSERT INTO playlist_tracks (id, playlist_id, track_id, position, added_at)
      VALUES (101, 10, 1, 1, '2026-11-20 08:11:00'),
             (102, 10, 2, 2, '2026-11-20 08:12:00');
    `);
    rawDb.close();

    // 2. Jalankan DatabaseService pada database v0.2.1
    const dbService = new DatabaseService(dbPath);

    // 3. Verifikasi data tetap 100% utuh
    const liked = dbService.getLikedTracks();
    expect(liked.length).toBe(1);
    expect(liked[0].title).toBe('Lagu v0.2.1 Ke-1');

    const playlists = dbService.getPlaylists();
    expect(playlists.length).toBe(1);
    expect(playlists[0].name).toBe('Playlist v0.2.1');
    expect(playlists[0].trackCount).toBe(2);

    const playlistDetails = dbService.getPlaylist(10);
    expect(playlistDetails?.tracks.length).toBe(2);
    expect(playlistDetails?.tracks[0].title).toBe('Lagu v0.2.1 Ke-1');
    expect(playlistDetails?.tracks[1].title).toBe('Lagu v0.2.1 Ke-2');

    // 4. Uji operasi v0.2.2: Reorder tracks & Rename playlist
    dbService.reorderPlaylistTracks(10, [102, 101]); // Balik urutan
    const reordered = dbService.getPlaylist(10);
    expect(reordered?.tracks[0].playlistTrackId).toBe(102);
    expect(reordered?.tracks[0].title).toBe('Lagu v0.2.1 Ke-2');
    expect(reordered?.tracks[1].playlistTrackId).toBe(101);
    expect(reordered?.tracks[1].title).toBe('Lagu v0.2.1 Ke-1');

    dbService.renamePlaylist(10, 'Playlist v0.2.1 Diperbarui di v0.2.2');
    expect(dbService.getPlaylist(10)?.name).toBe('Playlist v0.2.1 Diperbarui di v0.2.2');

    dbService.close();
  });
});

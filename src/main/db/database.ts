import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import type { Playlist, PlaylistDetails, PlaylistTrackItem, Track } from '../../shared/types';

export interface SavedPlaybackState {
  currentTrack: Track | null;
  positionSec: number;
  paused: boolean;
  volume: number;
  isMuted: boolean;
}

export class DatabaseService {
  private db: DatabaseSync;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      this.db = new DatabaseSync(dbPath);
      this.configurePragmasAndIntegrity();
      // Buat cadangan otomatis (.bak) hanya jika database terbukti sehat
      if (fs.existsSync(dbPath)) {
        try {
          fs.copyFileSync(dbPath, `${dbPath}.bak`);
        } catch {}
      }
    } catch {
      this.recoverFromBackup();
    }
    this.runMigrations();
  }

  private configurePragmasAndIntegrity(): void {
    // Aktifkan foreign_keys dan WAL journal mode
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');

    // Jalankan pemeriksaan integritas (PRAGMA integrity_check)
    const stmt = this.db.prepare('PRAGMA integrity_check');
    const checkRow = stmt.get() as Record<string, unknown> | undefined;
    const status = checkRow ? Object.values(checkRow)[0] : 'ok';
    if (status !== 'ok') {
      console.warn('[Database] Integritas database rusak, memulihkan dari cadangan terakhir...');
      this.recoverFromBackup();
    }
  }

  private recoverFromBackup(): void {
    try {
      if (this.db) {
        try { this.db.close(); } catch {}
      }
      const corruptPath = `${this.dbPath}.corrupt`;
      // Simpan berkas rusak sebagai .corrupt agar tidak hilang
      if (fs.existsSync(this.dbPath)) {
        try {
          fs.copyFileSync(this.dbPath, corruptPath);
          console.warn(`[Database] Berkas database rusak disimpan ke ${corruptPath}`);
        } catch {}
      }
      const backupPath = `${this.dbPath}.bak`;
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, this.dbPath);
        console.log(`[Database] Database dipulihkan dari cadangan ${backupPath}`);
      } else {
        if (fs.existsSync(this.dbPath)) fs.unlinkSync(this.dbPath);
      }
      this.db = new DatabaseSync(this.dbPath);
      this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    } catch (err) {
      console.error('[Database] Gagal memulihkan database dari cadangan:', err);
    }
  }

  private runMigrations(): void {
    // Tabel pelacak versi skema database (schema_meta)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        version INTEGER PRIMARY KEY,
        migrated_at TEXT NOT NULL
      );
    `);

    const versionRow = this.db.prepare('SELECT MAX(version) as ver FROM schema_meta').get() as { ver: number | null };
    const currentVersion = versionRow?.ver ?? 0;

    if (currentVersion < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS playback_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          track_json TEXT,
          position_sec REAL DEFAULT 0,
          paused INTEGER DEFAULT 1,
          volume REAL DEFAULT 0.8,
          is_muted INTEGER DEFAULT 0,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS queue (
          queue_index INTEGER PRIMARY KEY,
          track_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          track_id TEXT NOT NULL,
          track_json TEXT NOT NULL,
          played_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS search_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query TEXT NOT NULL,
          searched_at TEXT NOT NULL
        );
      `);

      const insertMeta = this.db.prepare('INSERT INTO schema_meta (version, migrated_at) VALUES (?, datetime(\'now\'))');
      insertMeta.run(1);
    }

    if (currentVersion < 2) {
      // Pre-migration automatic backup sebelum menjalankan migrasi v2
      if (this.dbPath && this.dbPath !== ':memory:' && fs.existsSync(this.dbPath)) {
        try {
          fs.copyFileSync(this.dbPath, `${this.dbPath}.pre-v2.bak`);
        } catch {}
      }

      // Migrasi v2: Liked Songs & Playlist Core dengan ON DELETE RESTRICT pada tracks
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tracks (
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

        CREATE TABLE IF NOT EXISTS liked_tracks (
          track_id INTEGER PRIMARY KEY,
          liked_at TEXT NOT NULL,
          FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS playlists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS playlist_tracks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          playlist_id INTEGER NOT NULL,
          track_id INTEGER NOT NULL,
          position INTEGER NOT NULL,
          added_at TEXT NOT NULL,
          FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
          FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE RESTRICT
        );

        CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos ON playlist_tracks(playlist_id, position);
        CREATE INDEX IF NOT EXISTS idx_liked_tracks_time ON liked_tracks(liked_at);
      `);

      // Migrasi data v1: impor trek riwayat yang sudah ada ke tabel tracks baru
      try {
        const v1Rows = this.db.prepare('SELECT track_json FROM history').all() as { track_json: string }[];
        for (const row of v1Rows) {
          try {
            const t = JSON.parse(row.track_json) as Track;
            this.upsertTrack(t);
          } catch {}
        }
      } catch {}

      const insertMeta = this.db.prepare('INSERT INTO schema_meta (version, migrated_at) VALUES (?, datetime(\'now\'))');
      insertMeta.run(2);
    }
  }

  getSetting(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  setSetting(key: string, value: string): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    stmt.run(key, value);
  }

  savePlaybackState(data: SavedPlaybackState): void {
    const trackJson = data.currentTrack ? JSON.stringify(data.currentTrack) : null;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO playback_state (id, track_json, position_sec, paused, volume, is_muted, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(
      trackJson,
      data.positionSec,
      data.paused ? 1 : 0,
      data.volume,
      data.isMuted ? 1 : 0
    );
  }

  getPlaybackState(): SavedPlaybackState | null {
    const stmt = this.db.prepare(
      'SELECT track_json, position_sec, paused, volume, is_muted FROM playback_state WHERE id = 1'
    );
    const row = stmt.get() as any;
    if (!row) return null;

    let track: Track | null = null;
    if (row.track_json) {
      try {
        track = JSON.parse(row.track_json);
      } catch {
        track = null;
      }
    }

    return {
      currentTrack: track,
      positionSec: typeof row.position_sec === 'number' ? row.position_sec : 0,
      paused: Boolean(row.paused),
      volume: typeof row.volume === 'number' ? row.volume : 0.8,
      isMuted: Boolean(row.is_muted),
    };
  }

  saveQueue(tracks: Track[]): void {
    this.db.exec('DELETE FROM queue');
    if (!tracks || tracks.length === 0) return;

    const stmt = this.db.prepare('INSERT INTO queue (queue_index, track_json) VALUES (?, ?)');
    for (let i = 0; i < tracks.length; i++) {
      stmt.run(i, JSON.stringify(tracks[i]));
    }
  }

  getQueue(): Track[] {
    const stmt = this.db.prepare('SELECT track_json FROM queue ORDER BY queue_index ASC');
    const rows = stmt.all() as any[];
    const result: Track[] = [];
    for (const r of rows) {
      try {
        result.push(JSON.parse(r.track_json));
      } catch {
        // Abaikan entri rusak
      }
    }
    return result;
  }

  addHistory(track: Track): void {
    const stmt = this.db.prepare(`
      INSERT INTO history (track_id, track_json, played_at)
      VALUES (?, ?, datetime('now'))
    `);
    stmt.run(track.id, JSON.stringify(track));

    // Batas otomatis: pertahankan maksimal 500 riwayat putar terbaru
    this.db.exec(`
      DELETE FROM history WHERE id NOT IN (
        SELECT id FROM history ORDER BY id DESC LIMIT 500
      );
    `);
  }

  getHistory(limit = 20): Track[] {
    const stmt = this.db.prepare(
      'SELECT track_json FROM history ORDER BY id DESC LIMIT ?'
    );
    const rows = stmt.all(limit) as any[];
    const result: Track[] = [];
    for (const r of rows) {
      try {
        result.push(JSON.parse(r.track_json));
      } catch {
        // Abaikan entri rusak
      }
    }
    return result;
  }

  addSearchHistory(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;

    const stmt = this.db.prepare(`
      INSERT INTO search_history (query, searched_at)
      VALUES (?, datetime('now'))
    `);
    stmt.run(trimmed);

    // Batas otomatis: pertahankan maksimal 50 riwayat cari terbaru
    this.db.exec(`
      DELETE FROM search_history WHERE id NOT IN (
        SELECT id FROM search_history ORDER BY id DESC LIMIT 50
      );
    `);
  }

  getSearchHistory(limit = 10): string[] {
    const stmt = this.db.prepare(
      'SELECT query FROM search_history ORDER BY id DESC LIMIT ?'
    );
    const rows = stmt.all(limit) as { query: string }[];
    return rows.map((r) => r.query);
  }

  clearAllHistory(): { playbackCleared: number; searchCleared: number } {
    const hRow = this.db.prepare('SELECT COUNT(*) as c FROM history').get() as { c: number };
    const sRow = this.db.prepare('SELECT COUNT(*) as c FROM search_history').get() as { c: number };
    const playbackCleared = hRow?.c || 0;
    const searchCleared = sRow?.c || 0;

    this.db.exec('DELETE FROM history; DELETE FROM search_history;');

    // Checkpoint WAL dan VACUUM fisik untuk menghapus residu byte dari berkas .db dan .db-wal
    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      this.db.exec('VACUUM;');
    } catch (err) {
      console.warn('[Database] Peringatan saat wal_checkpoint / vacuum:', err);
    }

    return { playbackCleared, searchCleared };
  }

  getSchemaVersion(): number {
    const row = this.db.prepare('SELECT MAX(version) as ver FROM schema_meta').get() as { ver: number | null };
    return row?.ver ?? 0;
  }

  upsertTrack(track: Track): number {
    const source = track.source || 'ytmusic';
    const sourceId = track.sourceId || track.id.replace(/^ytmusic:/, '');
    const artistsJson = JSON.stringify(track.artists || []);
    const albumTitle = track.album?.title || null;

    const findStmt = this.db.prepare('SELECT id FROM tracks WHERE source = ? AND source_id = ?');
    const existing = findStmt.get(source, sourceId) as { id: number } | undefined;
    if (existing) {
      return existing.id;
    }

    const insertStmt = this.db.prepare(`
      INSERT INTO tracks (source, source_id, title, artists_json, album_title, duration_sec, cover_url, is_available, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const info = insertStmt.run(
      source,
      sourceId,
      track.title,
      artistsJson,
      albumTitle,
      track.durationSec || 0,
      track.coverUrl || null,
      track.isAvailable ? 1 : 0
    );
    return Number(info.lastInsertRowid);
  }

  toggleLikeTrack(track: Track): boolean {
    const trackDbId = this.upsertTrack(track);
    const checkStmt = this.db.prepare('SELECT 1 FROM liked_tracks WHERE track_id = ?');
    const isLiked = checkStmt.get(trackDbId);

    if (isLiked) {
      this.db.prepare('DELETE FROM liked_tracks WHERE track_id = ?').run(trackDbId);
      return false;
    } else {
      this.db.prepare("INSERT INTO liked_tracks (track_id, liked_at) VALUES (?, datetime('now'))").run(trackDbId);
      return true;
    }
  }

  isTrackLiked(trackId: string): boolean {
    const rawId = trackId.replace(/^ytmusic:/, '');
    const stmt = this.db.prepare(`
      SELECT 1 FROM liked_tracks lt
      JOIN tracks t ON lt.track_id = t.id
      WHERE t.source_id = ? OR t.id = ?
    `);
    const row = stmt.get(rawId, trackId);
    return !!row;
  }

  getLikedTracks(): Track[] {
    const stmt = this.db.prepare(`
      SELECT t.* FROM liked_tracks lt
      JOIN tracks t ON lt.track_id = t.id
      ORDER BY lt.liked_at DESC
    `);
    const rows = stmt.all() as any[];
    return rows.map((r) => {
      let artists = [];
      try { artists = JSON.parse(r.artists_json); } catch {}
      return {
        id: `${r.source}:${r.source_id}`,
        source: r.source,
        sourceId: r.source_id,
        title: r.title,
        artists,
        album: r.album_title ? { id: `album:${r.album_title}`, title: r.album_title } : undefined,
        durationSec: r.duration_sec,
        coverUrl: r.cover_url || undefined,
        isAvailable: r.is_available === 1,
      };
    });
  }

  createPlaylist(name: string, description?: string): Playlist {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      throw new Error('Nama playlist wajib diisi');
    }
    const truncatedName = cleanName.slice(0, 100);
    const cleanDesc = description ? description.trim().slice(0, 300) : '';

    const stmt = this.db.prepare(`
      INSERT INTO playlists (name, description, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `);
    const info = stmt.run(truncatedName, cleanDesc);
    const id = Number(info.lastInsertRowid);
    return {
      id,
      name: truncatedName,
      description: cleanDesc,
      trackCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  getPlaylists(): Playlist[] {
    const stmt = this.db.prepare(`
      SELECT p.id, p.name, p.description, p.created_at, p.updated_at, COUNT(pt.id) as trackCount
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `);
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      trackCount: Number(r.trackCount || 0),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  getPlaylist(playlistId: number): PlaylistDetails | null {
    const pStmt = this.db.prepare('SELECT * FROM playlists WHERE id = ?');
    const pRow = pStmt.get(playlistId) as any;
    if (!pRow) return null;

    const tStmt = this.db.prepare(`
      SELECT pt.id as playlistTrackId, pt.position, pt.added_at, t.*
      FROM playlist_tracks pt
      JOIN tracks t ON pt.track_id = t.id
      WHERE pt.playlist_id = ?
      ORDER BY pt.position ASC
    `);
    const tRows = tStmt.all(playlistId) as any[];
    const tracks: PlaylistTrackItem[] = tRows.map((r) => {
      let artists = [];
      try { artists = JSON.parse(r.artists_json); } catch {}
      return {
        id: `${r.source}:${r.source_id}`,
        source: r.source,
        sourceId: r.source_id,
        title: r.title,
        artists,
        album: r.album_title ? { id: `album:${r.album_title}`, title: r.album_title } : undefined,
        durationSec: r.duration_sec,
        coverUrl: r.cover_url || undefined,
        isAvailable: r.is_available === 1,
        playlistTrackId: r.playlistTrackId,
        position: r.position,
        addedAt: r.added_at,
      };
    });

    return {
      id: pRow.id,
      name: pRow.name,
      description: pRow.description || '',
      trackCount: tracks.length,
      createdAt: pRow.created_at,
      updatedAt: pRow.updated_at,
      tracks,
    };
  }

  addTrackToPlaylist(playlistId: number, track: Track): { added: boolean; isDuplicate: boolean; playlistTrackId: number } {
    const trackDbId = this.upsertTrack(track);

    // Cek apakah trek sudah ada di playlist ini sebelumnya (deteksi duplikat)
    const dupStmt = this.db.prepare('SELECT 1 FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?');
    const isDuplicate = !!dupStmt.get(playlistId, trackDbId);

    // Dapatkan posisi tertinggi berikutnya
    const maxStmt = this.db.prepare('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?');
    const maxRow = maxStmt.get(playlistId) as { maxPos: number | null };
    const nextPos = (maxRow?.maxPos || 0) + 1;

    const insertStmt = this.db.prepare(`
      INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    const info = insertStmt.run(playlistId, trackDbId, nextPos);
    this.db.prepare("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?").run(playlistId);

    return {
      added: true,
      isDuplicate,
      playlistTrackId: Number(info.lastInsertRowid),
    };
  }

  removeTrackFromPlaylist(playlistTrackId: number): void {
    const row = this.db.prepare('SELECT playlist_id FROM playlist_tracks WHERE id = ?').get(playlistTrackId) as { playlist_id: number } | undefined;
    this.db.prepare('DELETE FROM playlist_tracks WHERE id = ?').run(playlistTrackId);
    if (row?.playlist_id) {
      this.db.prepare("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?").run(row.playlist_id);
    }
  }

  renamePlaylist(playlistId: number, name: string): void {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      throw new Error('Nama playlist wajib diisi');
    }
    const truncatedName = cleanName.slice(0, 100);
    this.db.prepare("UPDATE playlists SET name = ?, updated_at = datetime('now') WHERE id = ?").run(truncatedName, playlistId);
  }

  reorderPlaylistTracks(playlistId: number, trackIdsInOrder: number[]): void {
    const updateStmt = this.db.prepare('UPDATE playlist_tracks SET position = ? WHERE id = ? AND playlist_id = ?');
    this.db.exec('BEGIN TRANSACTION');
    try {
      for (let i = 0; i < trackIdsInOrder.length; i++) {
        updateStmt.run(i + 1, trackIdsInOrder[i], playlistId);
      }
      this.db.prepare("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?").run(playlistId);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  deletePlaylist(playlistId: number): void {
    // CASCADE otomatis menghapus baris di playlist_tracks, tetapi baris di tracks tetap aman (ON DELETE RESTRICT)
    this.db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId);
  }

  close(): void {
    this.db.close();
  }
}

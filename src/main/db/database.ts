import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import type { Track } from '../../shared/types';

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

    // Buat cadangan otomatis (.bak) sebelum migrasi / inisialisasi jika berkas sudah ada
    if (fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, `${dbPath}.bak`);
      } catch {
        // Abaikan jika tidak dapat menyalin cadangan
      }
    }

    this.db = new DatabaseSync(dbPath);
    this.configurePragmasAndIntegrity();
    this.runMigrations();
  }

  private configurePragmasAndIntegrity(): void {
    // Aktifkan foreign_keys dan WAL journal mode
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');

    // Jalankan pemeriksaan integritas (PRAGMA integrity_check)
    try {
      const stmt = this.db.prepare('PRAGMA integrity_check');
      const checkRow = stmt.get() as Record<string, unknown> | undefined;
      const status = checkRow ? Object.values(checkRow)[0] : 'ok';
      if (status !== 'ok') {
        console.warn('[Database] Integritas database rusak, memulihkan dari cadangan terakhir...');
        this.recoverFromBackup();
      }
    } catch {
      this.recoverFromBackup();
    }
  }

  private recoverFromBackup(): void {
    try {
      this.db.close();
      const backupPath = `${this.dbPath}.bak`;
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, this.dbPath);
      } else {
        fs.unlinkSync(this.dbPath);
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
    return { playbackCleared, searchCleared };
  }

  getSchemaVersion(): number {
    const row = this.db.prepare('SELECT MAX(version) as ver FROM schema_meta').get() as { ver: number | null };
    return row?.ver ?? 0;
  }

  close(): void {
    this.db.close();
  }
}

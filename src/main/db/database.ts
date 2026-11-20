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

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initTables();
  }

  private initTables(): void {
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
    `);
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

  close(): void {
    this.db.close();
  }
}

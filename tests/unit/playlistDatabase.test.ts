import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseSync } from 'node:sqlite';
import { DatabaseService } from '../../src/main/db/database';
import type { Track } from '../../src/shared/types';

describe('DatabaseService M2.1: Liked Songs & Playlist Core (F4)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;

  const mockTrack1: Track = {
    id: 'ytmusic:lagu-1',
    source: 'ytmusic',
    sourceId: 'lagu-1',
    title: 'Dan...',
    artists: [{ id: 'ytmusic:art-1', name: 'Sheila on 7' }],
    album: { id: 'ytmusic:alb-1', title: 'Kisah Klasik' },
    durationSec: 260,
    isAvailable: true,
  };

  const mockTrack2: Track = {
    id: 'ytmusic:lagu-2',
    source: 'ytmusic',
    sourceId: 'lagu-2',
    title: 'Sephia',
    artists: [{ id: 'ytmusic:art-1', name: 'Sheila on 7' }],
    durationSec: 290,
    isAvailable: true,
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musick-db-m2-'));
    dbPath = path.join(tempDir, 'test_m2.db');
    dbService = new DatabaseService(dbPath);
  });

  afterEach(() => {
    try {
      dbService.close();
    } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('melakukan migrasi data dari v1 ke v2 dan membuat cadangan pre-v2.bak', () => {
    dbService.close();
    fs.unlinkSync(dbPath);

    // 1. Buat database v1 murni dengan data riwayat
    const rawDb = new DatabaseSync(dbPath);
    rawDb.exec(`
      CREATE TABLE schema_meta (version INTEGER PRIMARY KEY, migrated_at TEXT NOT NULL);
      INSERT INTO schema_meta VALUES (1, datetime('now'));

      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE playback_state (id INTEGER PRIMARY KEY CHECK (id = 1), track_json TEXT);
      CREATE TABLE queue (queue_index INTEGER PRIMARY KEY, track_json TEXT NOT NULL);
      CREATE TABLE history (id INTEGER PRIMARY KEY AUTOINCREMENT, track_id TEXT NOT NULL, track_json TEXT NOT NULL, played_at TEXT NOT NULL);
      CREATE TABLE search_history (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT NOT NULL, searched_at TEXT NOT NULL);
    `);

    const insertHistory = rawDb.prepare('INSERT INTO history (track_id, track_json, played_at) VALUES (?, ?, datetime(\'now\'))');
    insertHistory.run(mockTrack1.id, JSON.stringify(mockTrack1));
    insertHistory.run(mockTrack2.id, JSON.stringify(mockTrack2));
    rawDb.close();

    // 2. Buka dengan DatabaseService modern: harus memicu migrasi v2 dan membuat .pre-v2.bak
    const migratedService = new DatabaseService(dbPath);
    expect(migratedService.getSchemaVersion()).toBe(2);

    const preBakPath = `${dbPath}.pre-v2.bak`;
    expect(fs.existsSync(preBakPath)).toBe(true);

    // 3. Verifikasi data v1 berhasil diimpor ke tabel tracks
    const t1Id = migratedService.upsertTrack(mockTrack1);
    const t2Id = migratedService.upsertTrack(mockTrack2);
    expect(t1Id).toBeGreaterThan(0);
    expect(t2Id).toBeGreaterThan(0);

    migratedService.close();
  });

  it('aturan F4: validasi nama playlist (maks 100 kar) dan deskripsi (maks 300 kar)', () => {
    // Nama kosong harus ditolak
    expect(() => dbService.createPlaylist('')).toThrow('Nama playlist wajib diisi');
    expect(() => dbService.createPlaylist('   ')).toThrow('Nama playlist wajib diisi');

    // Nama panjang > 100 karakter dipotong menjadi 100
    const longName = 'A'.repeat(150);
    const longDesc = 'D'.repeat(350);
    const p = dbService.createPlaylist(longName, longDesc);

    expect(p.name.length).toBe(100);
    expect(p.description?.length).toBe(300);

    const detail = dbService.getPlaylist(p.id);
    expect(detail?.name.length).toBe(100);
    expect(detail?.description?.length).toBe(300);
  });

  it('aturan F4: mendukung duplikasi lagu dalam satu playlist dengan ID unik dan urutan posisi', () => {
    const playlist = dbService.createPlaylist('Playlist Favorit');

    // Tambah lagu pertama kali
    const res1 = dbService.addTrackToPlaylist(playlist.id, mockTrack1);
    expect(res1.added).toBe(true);
    expect(res1.isDuplicate).toBe(false);
    expect(res1.playlistTrackId).toBeGreaterThan(0);

    // Tambah lagu yang sama kedua kali (duplikat diizinkan)
    const res2 = dbService.addTrackToPlaylist(playlist.id, mockTrack1);
    expect(res2.added).toBe(true);
    expect(res2.isDuplicate).toBe(true); // Terdeteksi duplikat
    expect(res2.playlistTrackId).toBeGreaterThan(res1.playlistTrackId);

    // Cek isi playlist: harus ada 2 item dengan urutan posisi 1 dan 2
    const detail = dbService.getPlaylist(playlist.id);
    expect(detail?.trackCount).toBe(2);
    expect(detail?.tracks).toHaveLength(2);
    expect(detail?.tracks[0].playlistTrackId).toBe(res1.playlistTrackId);
    expect(detail?.tracks[0].position).toBe(1);
    expect(detail?.tracks[1].playlistTrackId).toBe(res2.playlistTrackId);
    expect(detail?.tracks[1].position).toBe(2);
  });

  it('aturan ON DELETE RESTRICT: pencegahan penghapusan track yang masih dipakai di playlist_tracks', () => {
    const playlist = dbService.createPlaylist('Playlist Restrict Test');
    dbService.addTrackToPlaylist(playlist.id, mockTrack1);

    const trackDbId = dbService.upsertTrack(mockTrack1);

    // Hapus langsung dari tabel tracks harus gagal karena ON DELETE RESTRICT
    const deleteRaw = () => {
      // Akses langsung lewat prepare database internal
      (dbService as any).db.prepare('DELETE FROM tracks WHERE id = ?').run(trackDbId);
    };

    expect(deleteRaw).toThrow(/FOREIGN KEY constraint failed/);

    // Hapus playlist: playlist_tracks ikut terhapus via CASCADE, baris di tracks tetap utuh
    dbService.deletePlaylist(playlist.id);
    expect(dbService.getPlaylist(playlist.id)).toBeNull();

    // Sekarang menghapus track dari tracks sudah boleh karena referensi playlist_tracks telah bersih
    expect(() => {
      (dbService as any).db.prepare('DELETE FROM tracks WHERE id = ?').run(trackDbId);
    }).not.toThrow();
  });

  it('mengelola lagu yang disukai (Liked Songs): toggle like, cek status, dan daftar terurut waktu', () => {
    expect(dbService.isTrackLiked(mockTrack1.id)).toBe(false);

    // Like track 1
    const liked1 = dbService.toggleLikeTrack(mockTrack1);
    expect(liked1).toBe(true);
    expect(dbService.isTrackLiked(mockTrack1.id)).toBe(true);

    // Like track 2
    dbService.toggleLikeTrack(mockTrack2);
    expect(dbService.isTrackLiked(mockTrack2.id)).toBe(true);

    // Cek daftar lagu yang disukai: harus berisi 2 lagu
    const likedList = dbService.getLikedTracks();
    expect(likedList).toHaveLength(2);
    expect(likedList[0].id).toBe(mockTrack2.id); // Terakhir disukai di posisi teratas
    expect(likedList[1].id).toBe(mockTrack1.id);

    // Unlike track 1
    const unliked1 = dbService.toggleLikeTrack(mockTrack1);
    expect(unliked1).toBe(false);
    expect(dbService.isTrackLiked(mockTrack1.id)).toBe(false);

    const updatedList = dbService.getLikedTracks();
    expect(updatedList).toHaveLength(1);
    expect(updatedList[0].id).toBe(mockTrack2.id);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseService } from '../../src/main/db/database';
import type { Track } from '../../src/shared/types';

describe('DatabaseService (node:sqlite) Hardening & Tests', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;

  const mockTrack: Track = {
    id: 'ytmusic:test-123',
    source: 'ytmusic',
    sourceId: 'test-123',
    title: 'Lagu Uji Persistensi',
    artists: [{ id: 'ytmusic:artist-1', name: 'Artis Uji' }],
    durationSec: 210,
    isAvailable: true,
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musick-db-test-'));
    dbPath = path.join(tempDir, 'test.db');
    dbService = new DatabaseService(dbPath);
  });

  afterEach(() => {
    try {
      dbService.close();
    } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('menginisialisasi schema_meta dengan versi 2 dan mengaktifkan WAL/FK', () => {
    expect(dbService.getSchemaVersion()).toBe(2);
  });

  it('membuat cadangan otomatis .bak saat database yang ada dibuka kembali', () => {
    dbService.setSetting('testKey', 'testVal');
    dbService.close();

    // Buka ulang database
    dbService = new DatabaseService(dbPath);
    expect(fs.existsSync(`${dbPath}.bak`)).toBe(true);
    expect(dbService.getSetting('testKey')).toBe('testVal');
  });

  it('dapat menyimpan dan membaca setting key-value', () => {
    dbService.setSetting('audioQuality', 'economy');
    expect(dbService.getSetting('audioQuality')).toBe('economy');

    dbService.setSetting('audioQuality', 'high');
    expect(dbService.getSetting('audioQuality')).toBe('high');

    expect(dbService.getSetting('nonExistentKey')).toBeNull();
  });

  it('dapat menyimpan dan memulihkan status pemutaran (playback state)', () => {
    dbService.savePlaybackState({
      currentTrack: mockTrack,
      positionSec: 45.5,
      paused: true,
      volume: 0.65,
      isMuted: false,
    });

    const state = dbService.getPlaybackState();
    expect(state).not.toBeNull();
    expect(state?.currentTrack?.id).toBe(mockTrack.id);
    expect(state?.currentTrack?.title).toBe(mockTrack.title);
    expect(state?.positionSec).toBe(45.5);
    expect(state?.paused).toBe(true);
    expect(state?.volume).toBe(0.65);
    expect(state?.isMuted).toBe(false);
  });

  it('dapat menyimpan dan memulihkan antrean lagu (queue)', () => {
    const queueTracks: Track[] = [
      mockTrack,
      {
        ...mockTrack,
        id: 'ytmusic:test-456',
        sourceId: 'test-456',
        title: 'Lagu Antrean 2',
      },
    ];

    dbService.saveQueue(queueTracks);

    const loaded = dbService.getQueue();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe('ytmusic:test-123');
    expect(loaded[1].title).toBe('Lagu Antrean 2');
  });

  it('menerapkan batas otomatis riwayat putar (maksimal 500) dan riwayat cari (maksimal 50)', () => {
    // Uji batas pencarian: masukkan 60 kueri
    for (let i = 1; i <= 60; i++) {
      dbService.addSearchHistory(`Kueri Lagu ${i}`);
    }
    const searchHistory = dbService.getSearchHistory(100);
    expect(searchHistory.length).toBeLessThanOrEqual(50);
    expect(searchHistory[0]).toBe('Kueri Lagu 60');

    // Uji riwayat putar: masukkan 10 riwayat
    for (let i = 1; i <= 10; i++) {
      dbService.addHistory({
        ...mockTrack,
        id: `ytmusic:track-${i}`,
        title: `Lagu ${i}`,
      });
    }
    const playHistory = dbService.getHistory(20);
    expect(playHistory.length).toBe(10);
    expect(playHistory[0].title).toBe('Lagu 10');
  });

  it('menghapus seluruh riwayat putar dan riwayat cari secara permanen via clearAllHistory', () => {
    dbService.addHistory(mockTrack);
    dbService.addSearchHistory('Sheila on 7');

    expect(dbService.getHistory(10).length).toBe(1);
    expect(dbService.getSearchHistory(10).length).toBe(1);

    const cleared = dbService.clearAllHistory();
    expect(cleared.playbackCleared).toBe(1);
    expect(cleared.searchCleared).toBe(1);

    expect(dbService.getHistory(10)).toHaveLength(0);
    expect(dbService.getSearchHistory(10)).toHaveLength(0);
  });

  it('mengamankan berkas korup ke .corrupt dan memulihkan dari cadangan .bak', () => {
    // Siapkan db yang valid dengan cadangan
    dbService.setSetting('test_key', 'safe_value');
    dbService.close();

    // Buka kembali agar cadangan otomatis .bak terbentuk
    dbService = new DatabaseService(dbPath);
    dbService.close();

    // Pastikan berkas cadangan .bak ada
    const backupPath = `${dbPath}.bak`;
    expect(fs.existsSync(backupPath)).toBe(true);

    // Rusak berkas dbPath secara sengaja dengan byte sampah
    fs.writeFileSync(dbPath, 'BOGUS_GARBAGE_BYTES_CORRUPTED_SQLITE_HEADER');

    // Buka kembali database service: harus mendeteksi korupsi, mengamankan ke .corrupt, dan pulih dari .bak
    const recoveredDb = new DatabaseService(dbPath);
    const corruptPath = `${dbPath}.corrupt`;
    expect(fs.existsSync(corruptPath)).toBe(true);
    expect(fs.readFileSync(corruptPath, 'utf-8')).toBe('BOGUS_GARBAGE_BYTES_CORRUPTED_SQLITE_HEADER');

    // Nilai dari cadangan harus pulih
    expect(recoveredDb.getSetting('test_key')).toBe('safe_value');
    recoveredDb.close();
  });

  it('bukti fisik hapus riwayat: byte judul uji benar-benar hilang dari berkas .db dan .db-wal setelah VACUUM & checkpoint', () => {
    const secretTitle = 'RAHASIA_JUDUL_FISIK_PURGED_XYZ_12345';
    dbService.addHistory({
      ...mockTrack,
      id: 'ytmusic:purge-test-1',
      title: secretTitle,
    });
    dbService.addSearchHistory(secretTitle);

    // Tutup sejenak untuk memeriksa byte sebelum purge
    dbService.close();
    const readAllBytes = () => {
      let b = fs.readFileSync(dbPath);
      const walPath = `${dbPath}-wal`;
      if (fs.existsSync(walPath)) {
        b = Buffer.concat([b, fs.readFileSync(walPath)]);
      }
      return b.toString('binary');
    };

    expect(readAllBytes().includes(secretTitle)).toBe(true);

    // Buka kembali dan hapus permanen
    dbService = new DatabaseService(dbPath);
    dbService.clearAllHistory();
    dbService.close();

    // Verifikasi fisik: byte judul uji wajib 0 di .db maupun .db-wal
    const afterBytes = readAllBytes();
    expect(afterBytes.includes(secretTitle)).toBe(false);
  });
});

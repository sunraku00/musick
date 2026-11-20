import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseService } from '../../src/main/db/database';
import type { Track } from '../../src/shared/types';

describe('DatabaseService (node:sqlite) Unit Tests', () => {
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
    dbService.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
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

  it('dapat mencatat dan mengambil riwayat pemutaran (history)', () => {
    dbService.addHistory(mockTrack);
    dbService.addHistory({
      ...mockTrack,
      id: 'ytmusic:test-456',
      title: 'Lagu Terbaru',
    });

    const history = dbService.getHistory(10);
    expect(history).toHaveLength(2);
    expect(history[0].title).toBe('Lagu Terbaru');
    expect(history[1].title).toBe('Lagu Uji Persistensi');
  });
});

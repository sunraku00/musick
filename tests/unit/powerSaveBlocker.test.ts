import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../../src/main/db/database';
import fs from 'node:fs';
import path from 'node:path';

describe('PowerSaveBlocker and Screen-off Setting Unit Tests', () => {
  const testDbDir = path.resolve(__dirname, '../../test-temp-db-power');
  const testDbPath = path.join(testDbDir, 'test-power.db');
  let db: DatabaseService;

  beforeEach(() => {
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDbDir, { recursive: true });
    db = new DatabaseService(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
  });

  it('bawaan pengaturan keepPlayingOnScreenOff bernilai aktif (null/true)', () => {
    const val = db.getSetting('keepPlayingOnScreenOff');
    expect(val).toBeNull(); // null dianggap aktif (default: ON)
    const isEnabled = val !== 'false';
    expect(isEnabled).toBe(true);
  });

  it('dapat menyimpan dan memperbarui pengaturan keepPlayingOnScreenOff', () => {
    db.setSetting('keepPlayingOnScreenOff', 'false');
    expect(db.getSetting('keepPlayingOnScreenOff')).toBe('false');

    db.setSetting('keepPlayingOnScreenOff', 'true');
    expect(db.getSetting('keepPlayingOnScreenOff')).toBe('true');
  });

  it('logika blocker: mengaktifkan saat playing & setting aktif, melepas saat paused/idle', () => {
    let activeBlockerId: number | null = null;
    let nextId = 101;
    const mockPowerSaveBlocker = {
      start: vi.fn((type: string) => {
        expect(type).toBe('prevent-app-suspension');
        return nextId++;
      }),
      stop: vi.fn((id: number) => {
        if (activeBlockerId === id) activeBlockerId = null;
      }),
      isStarted: vi.fn((id: number) => activeBlockerId === id),
    };

    function updateBlocker(isPlaying: boolean, isEnabled: boolean) {
      if (isPlaying && isEnabled) {
        if (activeBlockerId === null || !mockPowerSaveBlocker.isStarted(activeBlockerId)) {
          activeBlockerId = mockPowerSaveBlocker.start('prevent-app-suspension');
        }
      } else {
        if (activeBlockerId !== null && mockPowerSaveBlocker.isStarted(activeBlockerId)) {
          mockPowerSaveBlocker.stop(activeBlockerId);
          activeBlockerId = null;
        }
      }
      return {
        active: activeBlockerId !== null && mockPowerSaveBlocker.isStarted(activeBlockerId),
        blockerId: activeBlockerId,
      };
    }

    // 1. Playback aktif dengan setting default (true)
    let res = updateBlocker(true, true);
    expect(res.active).toBe(true);
    expect(res.blockerId).toBe(101);
    expect(mockPowerSaveBlocker.start).toHaveBeenCalledTimes(1);

    // 2. Playback berulang kali 'playing' tidak membuat kebocoran ID baru
    res = updateBlocker(true, true);
    expect(res.active).toBe(true);
    expect(res.blockerId).toBe(101);
    expect(mockPowerSaveBlocker.start).toHaveBeenCalledTimes(1);

    // 3. Jeda playback -> blocker dilepas
    res = updateBlocker(false, true);
    expect(res.active).toBe(false);
    expect(res.blockerId).toBeNull();
    expect(mockPowerSaveBlocker.stop).toHaveBeenCalledWith(101);

    // 4. Playback aktif tapi setting dimatikan pengguna (false) -> blocker TIDAK dimulai
    res = updateBlocker(true, false);
    expect(res.active).toBe(false);
    expect(res.blockerId).toBeNull();
    expect(mockPowerSaveBlocker.start).toHaveBeenCalledTimes(1); // tetap 1, tidak nambah
  });
});

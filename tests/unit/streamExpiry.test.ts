import { describe, expect, it, vi, beforeEach } from 'vitest';
import { YtMusicSource } from '../../src/main/adapters/ytmusic/ytmusicSource';
import { BridgeManager } from '../../src/main/bridgeManager';
import { MusicSourceError } from '../../src/shared/errors';

describe('Unit Test: Mekanisme Kedaluwarsa dan Ambil Ulang Stream (PRD F2) [Diverifikasi dengan Simulasi]', () => {
  let mockBridge: BridgeManager;

  beforeEach(() => {
    mockBridge = new BridgeManager();
  });

  it('menggunakan cache jika URL stream masih berlaku (> 60 detik dari sekarang)', async () => {
    const now = Date.now();
    let callCount = 0;

    vi.spyOn(mockBridge, 'resolveStream').mockImplementation(async () => {
      callCount++;
      return {
        url: `https://googlevideo.com/stream-${callCount}`,
        mimeType: 'audio/webm',
        bitrateKbps: 160,
        expiresAt: now + 300000, // Valid 5 menit
      };
    });

    const source = new YtMusicSource({ minRequestIntervalMs: 0, bridge: mockBridge });

    // Panggilan pertama: panggil bridge
    const first = await source.resolveStream('song-1');
    expect(first.url).toBe('https://googlevideo.com/stream-1');
    expect(callCount).toBe(1);

    // Panggilan kedua: ambil dari cache
    const second = await source.resolveStream('song-1');
    expect(second.url).toBe('https://googlevideo.com/stream-1');
    expect(callCount).toBe(1);
  });

  it('mengambil ulang (re-fetch) otomatis jika URL stream mendekati kedaluwarsa (< 60 detik)', async () => {
    const now = Date.now();
    let callCount = 0;

    vi.spyOn(mockBridge, 'resolveStream').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          url: 'https://googlevideo.com/stream-expiring-soon',
          mimeType: 'audio/webm',
          bitrateKbps: 160,
          expiresAt: now + 30000, // Tinggal 30 detik (< 60s)
        };
      }
      return {
        url: 'https://googlevideo.com/stream-fresh-renewed',
        mimeType: 'audio/webm',
        bitrateKbps: 160,
        expiresAt: now + 3600000, // 1 jam
      };
    });

    const source = new YtMusicSource({ minRequestIntervalMs: 0, bridge: mockBridge });

    const first = await source.resolveStream('song-2');
    expect(first.url).toBe('https://googlevideo.com/stream-expiring-soon');
    expect(callCount).toBe(1);

    const renewed = await source.resolveStream('song-2');
    expect(renewed.url).toBe('https://googlevideo.com/stream-fresh-renewed');
    expect(callCount).toBe(2);
  });

  it('invalidateStream menghapus cache sehingga pemutaran berikutnya memaksa pengambilan URL segar', async () => {
    let callCount = 0;
    vi.spyOn(mockBridge, 'resolveStream').mockImplementation(async () => {
      callCount++;
      return {
        url: `https://googlevideo.com/stream-call-${callCount}`,
        mimeType: 'audio/webm',
        bitrateKbps: 160,
        expiresAt: Date.now() + 1000000,
      };
    });

    const source = new YtMusicSource({ minRequestIntervalMs: 0, bridge: mockBridge });

    const first = await source.resolveStream('song-3');
    expect(first.url).toBe('https://googlevideo.com/stream-call-1');
    expect(callCount).toBe(1);

    source.invalidateStream('song-3');

    const second = await source.resolveStream('song-3');
    expect(second.url).toBe('https://googlevideo.com/stream-call-2');
    expect(callCount).toBe(2);
  });

  it('melempar MusicSourceError(UNAVAILABLE) jika resolver gagal mengembalikan URL', async () => {
    vi.spyOn(mockBridge, 'resolveStream').mockRejectedValue(
      new MusicSourceError('UNAVAILABLE', 'Track not found')
    );

    const source = new YtMusicSource({ minRequestIntervalMs: 0, bridge: mockBridge });

    await expect(source.resolveStream('non-existent')).rejects.toThrow(MusicSourceError);
  });
});

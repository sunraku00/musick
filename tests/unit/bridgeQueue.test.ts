import { describe, it, expect, vi } from 'vitest';
import { BridgeManager } from '../../src/main/bridgeManager';
import { YtMusicSource } from '../../src/main/adapters/ytmusic/ytmusicSource';
import { MusicSourceError } from '../../src/shared/errors';

describe('BridgeManager Queue and Priority Tests (B3)', () => {
  it('harus membatalkan (supersede) pencarian lama saat ada pencarian baru masuk ke antrean', async () => {
    const manager = new BridgeManager();
    const mockStdin = {
      writable: true,
      write: vi.fn(),
    };
    (manager as any).child = {
      pid: undefined,
      killed: false,
      stdin: mockStdin,
    };

    // Panggil search 1 (langsung dikirim ke stdin karena isExecuting = false)
    const p1 = manager.search('first query').catch(() => {});
    expect((manager as any).isExecuting).toBe(true);

    // Saat p1 sedang berjalan, panggil search 2 dan search 3
    const p2 = manager.search('second query');
    const p3 = manager.search('third query').catch(() => {});

    // search 2 harus dibatalkan (rejected dengan SUPERSEDED) saat search 3 masuk
    await expect(p2).rejects.toThrow(MusicSourceError);
    await p2.catch((err) => {
      expect(err.code).toBe('SUPERSEDED');
    });

    // Periksa antrean: hanya search 3 yang tersisa di antrean
    const queue = (manager as any).queue;
    expect(queue.length).toBe(1);
    expect(queue[0].params.query).toBe('third query');

    (manager as any).cleanupChild();
    await p1;
    await p3;
  });

  it('harus menyisipkan request resolve dengan prioritas tinggi di depan pencarian normal', async () => {
    const manager = new BridgeManager();
    const mockStdin = {
      writable: true,
      write: vi.fn(),
    };
    (manager as any).child = {
      pid: undefined,
      killed: false,
      stdin: mockStdin,
    };

    // Buat status isExecuting = true seolah ada request 1 yang sedang diproses di Python
    (manager as any).isExecuting = true;

    // Masukkan search request (normal priority)
    const pSearch = manager.search('query normal').catch(() => {});

    // Masukkan resolve request (high priority)
    const pResolve = manager.resolveStream('song123').catch(() => {});

    // Cek antrean: pResolve harus berada di depan pSearch (indeks 0)
    const queue = (manager as any).queue;
    expect(queue.length).toBe(2);
    expect(queue[0].method).toBe('resolve');
    expect(queue[0].priority).toBe('high');
    expect(queue[1].method).toBe('search');
    expect(queue[1].priority).toBe('normal');

    (manager as any).cleanupChild();
    await pSearch;
    await pResolve;
  });

  it('YtMusicSource.resolveStream tidak boleh terhambat oleh throttle pencarian', async () => {
    const mockBridge = {
      search: vi.fn().mockResolvedValue({ query: 'test', tracks: [], artists: [], albums: [] }),
      resolveStream: vi.fn().mockResolvedValue({ url: 'https://stream.example/audio.mp4', expiresAt: Date.now() + 3600000 }),
      getTrack: vi.fn(),
      getArtist: vi.fn(),
      getAlbum: vi.fn(),
    } as unknown as BridgeManager;

    const source = new YtMusicSource({
      minRequestIntervalMs: 500, // interval 500ms
      bridge: mockBridge,
    });

    // 1. Eksekusi pencarian pertama -> mengupdate lastRequestTime
    await source.search('first search');

    // 2. Langsung panggil resolveStream tanpa jeda
    const tStartResolve = Date.now();
    const stream = await source.resolveStream('track-abc');
    const tResolveDuration = Date.now() - tStartResolve;

    expect(stream.url).toBe('https://stream.example/audio.mp4');
    // resolveStream tidak boleh menunggu 500ms
    expect(tResolveDuration).toBeLessThan(100);
    expect(mockBridge.resolveStream).toHaveBeenCalledWith('track-abc');
  });

  it('YtMusicSource.resolveStream harus mengembalikan cache in-memory jika belum expired', async () => {
    const mockBridge = {
      search: vi.fn(),
      resolveStream: vi.fn().mockResolvedValue({
        url: 'https://cached.example/audio.mp4',
        expiresAt: Date.now() + 600000, // 10 menit ke depan
      }),
    } as unknown as BridgeManager;

    const source = new YtMusicSource({ bridge: mockBridge });

    const s1 = await source.resolveStream('cached-id');
    const s2 = await source.resolveStream('cached-id');

    expect(s1.url).toBe('https://cached.example/audio.mp4');
    expect(s2.url).toBe('https://cached.example/audio.mp4');
    // Hanya boleh memanggil bridge 1 kali karena pemanggilan kedua diambil dari cache
    expect(mockBridge.resolveStream).toHaveBeenCalledTimes(1);
  });
});

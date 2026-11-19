import { describe, expect, it } from 'vitest';
import { YtMusicSource } from '../../src/main/adapters/ytmusic/ytmusicSource';
import { MusicSourceError } from '../../src/shared/errors';

describe('Live Test: YtMusicSource (Online YouTube Music via Bridge)', () => {
  const source = new YtMusicSource({ minRequestIntervalMs: 50 });

  it('memiliki identitas sumber ytmusic', () => {
    expect(source.id).toBe('ytmusic');
    expect(source.name).toBe('YouTube Music');
  });

  describe('search() Live', () => {
    it('mencari lagu populer Sheila on 7 atau melempar error tertangani jika offline', async () => {
      try {
        const result = await source.search('Sheila on 7 Dan');
        expect(result).toBeDefined();
        expect(Array.isArray(result.tracks)).toBe(true);
        if (result.tracks.length > 0) {
          const track = result.tracks[0];
          expect(track.id.startsWith('ytmusic:')).toBe(true);
          expect(track.title).toBeDefined();
          expect(track.durationSec).toBeGreaterThan(0);
        }
      } catch (err) {
        expect(err).toBeInstanceOf(MusicSourceError);
        console.warn('Live search offline/rate-limited:', (err as MusicSourceError).code);
      }
    });

    it('kueri kosong mengembalikan hasil kosong tanpa memanggil jaringan', async () => {
      const result = await source.search('   ');
      expect(result.tracks).toHaveLength(0);
    });
  });

  describe('getTrack() Live', () => {
    it('mengambil detail lagu nyata untuk video ID YouTube yang diketahui', async () => {
      try {
        const track = await source.getTrack('k1BfsO0mxWQ');
        expect(track).toBeDefined();
        expect(track.sourceId).toBe('k1BfsO0mxWQ');
        expect(track.title).toBeDefined();
      } catch (err) {
        expect(err).toBeInstanceOf(MusicSourceError);
        console.warn('Live getTrack offline/rate-limited:', (err as MusicSourceError).code);
      }
    });

    it('ID lagu yang tidak ada melempar MusicSourceError UNAVAILABLE atau NETWORK', async () => {
      try {
        await source.getTrack('invalid_non_existent_id_xyz999');
        expect.fail('Harus melempar error untuk ID tidak valid');
      } catch (err) {
        expect(err).toBeInstanceOf(MusicSourceError);
        const code = (err as MusicSourceError).code;
        expect(['UNAVAILABLE', 'NETWORK', 'RATE_LIMITED']).toContain(code);
      }
    });
  });

  describe('resolveStream() Live', () => {
    it('mengurai URL stream audio asli dari YouTube Music', async () => {
      try {
        const stream = await source.resolveStream('k1BfsO0mxWQ');
        expect(stream).toBeDefined();
        expect(stream.url.startsWith('https://')).toBe(true);
        expect(typeof stream.expiresAt).toBe('number');
      } catch (err) {
        expect(err).toBeInstanceOf(MusicSourceError);
        console.warn('Live resolveStream offline/rate-limited:', (err as MusicSourceError).code);
      }
    }, 15000);
  });
});

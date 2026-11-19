import { describe, expect, it } from 'vitest';
import { MockSource } from '../../src/main/adapters/mock/mockSource';
import { MusicSourceError } from '../../src/shared/errors';

describe('Contract Test: MockSource (100% Offline Mandatory Contract)', () => {
  const source = new MockSource();

  it('memiliki properti id dan name yang valid', () => {
    expect(source.id).toBe('mock');
    expect(source.name).toBe('Sumber Mock (Offline)');
  });

  describe('search()', () => {
    it('mengembalikan SearchResult dengan query, tracks, artists, dan albums', async () => {
      const result = await source.search('Senja');
      expect(result).toBeDefined();
      expect(result.query).toBe('Senja');
      expect(Array.isArray(result.tracks)).toBe(true);
      expect(Array.isArray(result.artists)).toBe(true);
      expect(Array.isArray(result.albums)).toBe(true);

      expect(result.tracks.length).toBeGreaterThan(0);
      const track = result.tracks[0];
      expect(track.id).toBeDefined();
      expect(track.source).toBe('mock');
      expect(track.sourceId).toBeDefined();
      expect(typeof track.title).toBe('string');
      expect(Array.isArray(track.artists)).toBe(true);
      expect(typeof track.durationSec).toBe('number');
      expect(typeof track.isAvailable).toBe('boolean');
    });

    it('mengembalikan hasil kosong jika kueri kosong atau spasi', async () => {
      const result = await source.search('   ');
      expect(result.tracks).toHaveLength(0);
      expect(result.artists).toHaveLength(0);
      expect(result.albums).toHaveLength(0);
    });

    it('melempar MusicSourceError(NETWORK) pada trigger simulasi kegagalan', async () => {
      await expect(source.search('trigger:network_error')).rejects.toThrow(MusicSourceError);
      try {
        await source.search('trigger:network_error');
      } catch (err) {
        expect(err).toBeInstanceOf(MusicSourceError);
        expect((err as MusicSourceError).code).toBe('NETWORK');
      }
    });
  });

  describe('getTrack()', () => {
    it('mengambil detail lagu untuk ID valid', async () => {
      const track = await source.getTrack('track-1');
      expect(track).toBeDefined();
      expect(track.sourceId).toBe('track-1');
      expect(track.title).toBe('Harmoni Senja (Tone A 440Hz)');
      expect(track.artists.length).toBeGreaterThan(0);
    });

    it('melempar MusicSourceError(UNAVAILABLE) jika ID tidak ditemukan', async () => {
      await expect(source.getTrack('invalid-id-999')).rejects.toThrow(MusicSourceError);
      try {
        await source.getTrack('invalid-id-999');
      } catch (err) {
        expect(err).toBeInstanceOf(MusicSourceError);
        expect((err as MusicSourceError).code).toBe('UNAVAILABLE');
      }
    });
  });

  describe('resolveStream()', () => {
    it('mengembalikan stream URL data URI yang langsung dapat dibunyikan', async () => {
      const stream = await source.resolveStream('track-1');
      expect(stream).toBeDefined();
      expect(stream.url.startsWith('data:audio/wav;base64,')).toBe(true);
      expect(stream.mimeType).toBe('audio/wav');
      expect(typeof stream.expiresAt).toBe('number');
    });

    it('melempar MusicSourceError(UNAVAILABLE) jika lagu berstatus tidak tersedia', async () => {
      await expect(source.resolveStream('track-4')).rejects.toThrow(MusicSourceError);
      try {
        await source.resolveStream('track-4');
      } catch (err) {
        expect(err).toBeInstanceOf(MusicSourceError);
        expect((err as MusicSourceError).code).toBe('UNAVAILABLE');
      }
    });
  });
});

import { MusicSourceError } from '../../../shared/errors';
import type { MusicSource } from '../../../shared/source';
import type { Album, Artist, SearchResult, StreamInfo, Track } from '../../../shared/types';

function createSyntheticToneDataUri(durationSec: number = 4, frequency: number = 440): string {
  const sampleRate = 8000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let envelope = 1.0;
    if (i < 800) envelope = i / 800;
    else if (i > numSamples - 1600) envelope = (numSamples - i) / 1600;

    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.4 * envelope;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  const base64 = Buffer.from(buffer).toString('base64');
  return `data:audio/wav;base64,${base64}`;
}

const MOCK_COVER_1 = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%232b5c8f"/><circle cx="100" cy="100" r="40" fill="%23e8edf3"/><text x="100" y="105" font-family="sans-serif" font-size="12" fill="%232b5c8f" text-anchor="middle">MOCK 1</text></svg>';
const MOCK_COVER_2 = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%238f2b5c"/><circle cx="100" cy="100" r="40" fill="%23f3e8ed"/><text x="100" y="105" font-family="sans-serif" font-size="12" fill="%238f2b5c" text-anchor="middle">MOCK 2</text></svg>';
const MOCK_COVER_3 = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%232b8f5c"/><circle cx="100" cy="100" r="40" fill="%23e8f3ed"/><text x="100" y="105" font-family="sans-serif" font-size="12" fill="%232b8f5c" text-anchor="middle">MOCK 3</text></svg>';

const MOCK_TRACKS: Track[] = [
  {
    id: 'mock:track-1',
    source: 'mock',
    sourceId: 'track-1',
    title: 'Harmoni Senja (Tone A 440Hz)',
    artists: [{ id: 'mock:artist-1', name: 'Suara Pesisir' }],
    album: { id: 'mock:album-1', title: 'Melodi Nusantara', coverUrl: MOCK_COVER_1, year: 2024 },
    durationSec: 5,
    coverUrl: MOCK_COVER_1,
    isAvailable: true,
  },
  {
    id: 'mock:track-2',
    source: 'mock',
    sourceId: 'track-2',
    title: 'Langkah Hujan (Tone C 523Hz)',
    artists: [{ id: 'mock:artist-1', name: 'Suara Pesisir' }, { id: 'mock:artist-2', name: 'Nada Khatulistiwa' }],
    album: { id: 'mock:album-1', title: 'Melodi Nusantara', coverUrl: MOCK_COVER_1, year: 2024 },
    durationSec: 6,
    coverUrl: MOCK_COVER_1,
    isAvailable: true,
  },
  {
    id: 'mock:track-3',
    source: 'mock',
    sourceId: 'track-3',
    title: 'Bintang Malam (Tone E 659Hz)',
    artists: [{ id: 'mock:artist-2', name: 'Nada Khatulistiwa' }],
    album: { id: 'mock:album-2', title: 'Cakrawala Suara', coverUrl: MOCK_COVER_2, year: 2025 },
    durationSec: 4,
    coverUrl: MOCK_COVER_2,
    isAvailable: true,
  },
  {
    id: 'mock:track-4',
    source: 'mock',
    sourceId: 'track-4',
    title: 'Lagu Hilang (Tidak Tersedia)',
    artists: [{ id: 'mock:artist-3', name: 'Artis Misteri' }],
    durationSec: 180,
    coverUrl: MOCK_COVER_3,
    isAvailable: false,
  },
];

const MOCK_ARTISTS: Artist[] = [
  {
    id: 'mock:artist-1',
    source: 'mock',
    sourceId: 'artist-1',
    name: 'Suara Pesisir',
    imageUrl: MOCK_COVER_1,
    topTracks: [MOCK_TRACKS[0], MOCK_TRACKS[1]],
    albums: [{ id: 'mock:album-1', title: 'Melodi Nusantara', coverUrl: MOCK_COVER_1, year: 2024 }],
  },
  {
    id: 'mock:artist-2',
    source: 'mock',
    sourceId: 'artist-2',
    name: 'Nada Khatulistiwa',
    imageUrl: MOCK_COVER_2,
    topTracks: [MOCK_TRACKS[2]],
    albums: [{ id: 'mock:album-2', title: 'Cakrawala Suara', coverUrl: MOCK_COVER_2, year: 2025 }],
  },
];

const MOCK_ALBUMS: Album[] = [
  {
    id: 'mock:album-1',
    source: 'mock',
    sourceId: 'album-1',
    title: 'Melodi Nusantara',
    artists: [{ id: 'mock:artist-1', name: 'Suara Pesisir' }],
    year: 2024,
    coverUrl: MOCK_COVER_1,
    tracks: [MOCK_TRACKS[0], MOCK_TRACKS[1]],
  },
  {
    id: 'mock:album-2',
    source: 'mock',
    sourceId: 'album-2',
    title: 'Cakrawala Suara',
    artists: [{ id: 'mock:artist-2', name: 'Nada Khatulistiwa' }],
    year: 2025,
    coverUrl: MOCK_COVER_2,
    tracks: [MOCK_TRACKS[2]],
  },
];

export class MockSource implements MusicSource {
  readonly id = 'mock';
  readonly name = 'Sumber Mock (Offline)';

  async search(query: string): Promise<SearchResult> {
    const trimmed = query.trim().toLowerCase();

    if (trimmed === 'trigger:network_error') {
      throw new MusicSourceError('NETWORK', 'Simulated network disconnection');
    }
    if (trimmed === 'trigger:rate_limit') {
      throw new MusicSourceError('RATE_LIMITED', 'Simulated rate limit');
    }
    if (trimmed === 'trigger:blocked') {
      throw new MusicSourceError('BLOCKED', 'Simulated geo-block');
    }

    if (!trimmed) {
      return { query, tracks: [], artists: [], albums: [] };
    }

    const matchedTracks = MOCK_TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(trimmed) ||
        t.artists.some((a) => a.name.toLowerCase().includes(trimmed)) ||
        (t.album && t.album.title.toLowerCase().includes(trimmed))
    );

    const matchedArtists = MOCK_ARTISTS.filter((a) =>
      a.name.toLowerCase().includes(trimmed)
    );

    const matchedAlbums = MOCK_ALBUMS.filter(
      (al) =>
        al.title.toLowerCase().includes(trimmed) ||
        al.artists.some((a) => a.name.toLowerCase().includes(trimmed))
    );

    return {
      query,
      tracks: matchedTracks,
      artists: matchedArtists,
      albums: matchedAlbums,
    };
  }

  async getTrack(sourceId: string): Promise<Track> {
    const track = MOCK_TRACKS.find((t) => t.sourceId === sourceId);
    if (!track) {
      throw new MusicSourceError('UNAVAILABLE', `Track ${sourceId} not found`);
    }
    return track;
  }

  async getArtist(sourceId: string): Promise<Artist> {
    const artist = MOCK_ARTISTS.find((a) => a.sourceId === sourceId);
    if (!artist) {
      throw new MusicSourceError('UNAVAILABLE', `Artist ${sourceId} not found`);
    }
    return artist;
  }

  async getAlbum(sourceId: string): Promise<Album> {
    const album = MOCK_ALBUMS.find((a) => a.sourceId === sourceId);
    if (!album) {
      throw new MusicSourceError('UNAVAILABLE', `Album ${sourceId} not found`);
    }
    return album;
  }

  async resolveStream(sourceId: string): Promise<StreamInfo> {
    const track = await this.getTrack(sourceId);
    if (!track.isAvailable) {
      throw new MusicSourceError('UNAVAILABLE', `Track ${sourceId} is marked unavailable`);
    }

    let freq = 440;
    if (sourceId === 'track-2') freq = 523;
    if (sourceId === 'track-3') freq = 659;

    const audioDataUri = createSyntheticToneDataUri(track.durationSec, freq);

    return {
      url: audioDataUri,
      mimeType: 'audio/wav',
      bitrateKbps: 128,
      expiresAt: Date.now() + 3600 * 1000,
    };
  }
}

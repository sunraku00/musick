import { MusicSourceError } from '../../../shared/errors';
import type { MusicSource } from '../../../shared/source';
import type { Album, Artist, SearchResult, StreamInfo, Track } from '../../../shared/types';
import { bridgeManager, BridgeManager } from '../../bridgeManager';

export interface YtMusicSourceConfig {
  readonly minRequestIntervalMs?: number;
  readonly bridge?: BridgeManager;
}

/**
 * Adaptor YouTube Music yang berjalan di Main Process Node.js.
 * Berkomunikasi dengan bridge Python lewat stdio JSON-RPC (tanpa membuka port HTTP lokal).
 */
export class YtMusicSource implements MusicSource {
  readonly id = 'ytmusic';
  readonly name = 'YouTube Music';

  private readonly minIntervalMs: number;
  private readonly bridge: BridgeManager;
  private lastRequestTime = 0;
  private readonly streamCache = new Map<string, StreamInfo>();

  constructor(config?: YtMusicSourceConfig) {
    this.minIntervalMs = config?.minRequestIntervalMs || 250;
    this.bridge = config?.bridge || bridgeManager;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  async search(query: string): Promise<SearchResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { query, tracks: [], artists: [], albums: [] };
    }

    await this.throttle();
    const result = await this.bridge.search(trimmed);
    if (!result || !Array.isArray(result.tracks)) {
      throw new MusicSourceError('SOURCE_CHANGED', 'Format hasil pencarian sumber tidak valid');
    }
    return result;
  }

  async getTrack(sourceId: string): Promise<Track> {
    if (!sourceId) {
      throw new MusicSourceError('UNAVAILABLE', 'ID lagu kosong');
    }
    await this.throttle();
    const track = await this.bridge.getTrack(sourceId);
    if (!track || !track.title) {
      throw new MusicSourceError('SOURCE_CHANGED', 'Format detail lagu tidak sesuai');
    }
    return track;
  }

  async getArtist(sourceId: string): Promise<Artist> {
    if (!sourceId) {
      throw new MusicSourceError('UNAVAILABLE', 'ID artis kosong');
    }
    throw new MusicSourceError('UNAVAILABLE', 'Fitur getArtist belum diimplementasikan di spike M0');
  }

  async getAlbum(sourceId: string): Promise<Album> {
    if (!sourceId) {
      throw new MusicSourceError('UNAVAILABLE', 'ID album kosong');
    }
    throw new MusicSourceError('UNAVAILABLE', 'Fitur getAlbum belum diimplementasikan di spike M0');
  }

  /**
   * Mengurai alamat stream audio.
   * Dilengkapi deteksi kedaluwarsa URL (expire timestamp) dan pengambilan ulang otomatis.
   */
  async resolveStream(sourceId: string): Promise<StreamInfo> {
    if (!sourceId) {
      throw new MusicSourceError('UNAVAILABLE', 'ID lagu kosong');
    }

    const cleanId = sourceId.startsWith('ytmusic:') ? sourceId.slice('ytmusic:'.length) : sourceId;
    const now = Date.now();
    const cached = this.streamCache.get(sourceId) || this.streamCache.get(cleanId);

    // Jika URL stream di cache masih valid minimal 60 detik lagi, gunakan cache
    if (cached && cached.expiresAt && cached.expiresAt > now + 60000) {
      return cached;
    }

    await this.throttle();
    const streamInfo = await this.bridge.resolveStream(cleanId);
    if (!streamInfo || !streamInfo.url) {
      throw new MusicSourceError('UNAVAILABLE', 'Alamat stream audio tidak ditemukan');
    }

    this.streamCache.set(sourceId, streamInfo);
    this.streamCache.set(cleanId, streamInfo);
    return streamInfo;
  }

  invalidateStream(sourceId: string): void {
    this.streamCache.delete(sourceId);
  }
}

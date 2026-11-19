import type { Album, Artist, SearchResult, StreamInfo, Track } from './types';

export interface MusicSource {
  readonly id: string;
  readonly name: string;
  search(query: string): Promise<SearchResult>;
  getTrack(sourceId: string): Promise<Track>;
  getArtist(sourceId: string): Promise<Artist>;
  getAlbum(sourceId: string): Promise<Album>;
  resolveStream(sourceId: string): Promise<StreamInfo>;
}

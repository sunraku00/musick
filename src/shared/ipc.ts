import type { Album, Artist, SearchResult, SourceMeta, StreamInfo, Track } from './types';

export const IPC_CHANNELS = {
  SEARCH: 'music:search',
  GET_TRACK: 'music:get-track',
  GET_ARTIST: 'music:get-artist',
  GET_ALBUM: 'music:get-album',
  RESOLVE_STREAM: 'music:resolve-stream',
  GET_ACTIVE_SOURCE: 'music:get-active-source',
  SET_ACTIVE_SOURCE: 'music:set-active-source',
  LIST_SOURCES: 'music:list-sources',
} as const;

export interface MusicApi {
  search(query: string): Promise<SearchResult>;
  getTrack(sourceId: string): Promise<Track>;
  getArtist(sourceId: string): Promise<Artist>;
  getAlbum(sourceId: string): Promise<Album>;
  resolveStream(sourceId: string): Promise<StreamInfo>;
  getActiveSource(): Promise<string>;
  setActiveSource(sourceId: string): Promise<void>;
  listSources(): Promise<SourceMeta[]>;
}

declare global {
  interface Window {
    musicApi?: MusicApi;
  }
}

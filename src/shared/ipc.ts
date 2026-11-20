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
  GET_APP_INFO: 'app:get-info',
  DB_GET_SETTING: 'db:get-setting',
  DB_SET_SETTING: 'db:set-setting',
  DB_SAVE_PLAYBACK: 'db:save-playback',
  DB_GET_PLAYBACK: 'db:get-playback',
  DB_SAVE_QUEUE: 'db:save-queue',
  DB_GET_QUEUE: 'db:get-queue',
  DB_ADD_HISTORY: 'db:add-history',
  DB_GET_HISTORY: 'db:get-history',
} as const;

export interface AppInfo {
  readonly version: string;
  readonly commitHash: string;
}

export interface SavedPlayback {
  readonly currentTrack: Track | null;
  readonly positionSec: number;
  readonly paused: boolean;
  readonly volume: number;
  readonly isMuted: boolean;
}

export interface MusicApi {
  search(query: string): Promise<SearchResult>;
  getTrack(sourceId: string): Promise<Track>;
  getArtist(sourceId: string): Promise<Artist>;
  getAlbum(sourceId: string): Promise<Album>;
  resolveStream(sourceId: string): Promise<StreamInfo>;
  getActiveSource(): Promise<string>;
  setActiveSource(sourceId: string): Promise<void>;
  listSources(): Promise<SourceMeta[]>;
  getAppInfo(): Promise<AppInfo>;
  dbGetSetting(key: string): Promise<string | null>;
  dbSetSetting(key: string, value: string): Promise<void>;
  dbSavePlayback(state: SavedPlayback): Promise<void>;
  dbGetPlayback(): Promise<SavedPlayback | null>;
  dbSaveQueue(tracks: Track[]): Promise<void>;
  dbGetQueue(): Promise<Track[]>;
  dbAddHistory(track: Track): Promise<void>;
  dbGetHistory(limit?: number): Promise<Track[]>;
  onSuspend(callback: () => void): () => void;
  onResume(callback: () => void): () => void;
}

declare global {
  interface Window {
    musicApi?: MusicApi;
  }
}

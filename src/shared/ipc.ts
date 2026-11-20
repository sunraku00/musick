import type { Album, Artist, Playlist, PlaylistDetails, SearchResult, SourceMeta, StreamInfo, Track } from './types';

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
  DB_CLEAR_ALL_HISTORY: 'db:clear-all-history',
  POWER_SET_PLAYBACK_ACTIVE: 'power:set-playback-active',
  POWER_GET_BLOCKER_STATUS: 'power:get-blocker-status',
  DB_TOGGLE_LIKE_TRACK: 'db:toggle-like-track',
  DB_IS_TRACK_LIKED: 'db:is-track-liked',
  DB_GET_LIKED_TRACKS: 'db:get-liked-tracks',
  DB_CREATE_PLAYLIST: 'db:create-playlist',
  DB_GET_PLAYLISTS: 'db:get-playlists',
  DB_GET_PLAYLIST: 'db:get-playlist',
  DB_ADD_TRACK_TO_PLAYLIST: 'db:add-track-to-playlist',
  DB_REMOVE_TRACK_FROM_PLAYLIST: 'db:remove-track-from-playlist',
  DB_DELETE_PLAYLIST: 'db:delete-playlist',
} as const;

export interface PowerBlockerStatus {
  readonly active: boolean;
  readonly blockerId: number | null;
  readonly settingEnabled: boolean;
}

export interface ClearHistoryResult {
  readonly playbackCleared: number;
  readonly searchCleared: number;
}

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
  search(query: string, filter?: string): Promise<SearchResult>;
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
  dbClearAllHistory(): Promise<ClearHistoryResult>;
  setPowerSaveBlocker(isPlaying: boolean): Promise<void>;
  getPowerSaveBlockerStatus(): Promise<PowerBlockerStatus>;
  dbToggleLikeTrack(track: Track): Promise<boolean>;
  dbIsTrackLiked(trackId: string): Promise<boolean>;
  dbGetLikedTracks(): Promise<Track[]>;
  dbCreatePlaylist(name: string, description?: string): Promise<Playlist>;
  dbGetPlaylists(): Promise<Playlist[]>;
  dbGetPlaylist(playlistId: number): Promise<PlaylistDetails | null>;
  dbAddTrackToPlaylist(playlistId: number, track: Track): Promise<{ added: boolean; isDuplicate: boolean; playlistTrackId: number }>;
  dbRemoveTrackFromPlaylist(playlistTrackId: number): Promise<void>;
  dbDeletePlaylist(playlistId: number): Promise<void>;
  onSuspend(callback: () => void): () => void;
  onResume(callback: () => void): () => void;
}

declare global {
  interface Window {
    musicApi?: MusicApi;
  }
}

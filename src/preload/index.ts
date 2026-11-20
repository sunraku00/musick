import { contextBridge, ipcRenderer } from 'electron';
import { MusicSourceError, type MusicSourceErrorPayload } from '../shared/errors';
import { IPC_CHANNELS, type AppInfo, type ClearHistoryResult, type MusicApi, type PowerBlockerStatus, type SavedPlayback } from '../shared/ipc';
import type { Album, Artist, SearchResult, SourceMeta, StreamInfo, Track } from '../shared/types';

interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: MusicSourceErrorPayload;
}

async function invokeIpc<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>;
  if (!result.success) {
    if (result.error) {
      throw MusicSourceError.fromJSON(result.error);
    }
    throw new MusicSourceError('NETWORK', 'Permintaan IPC gagal');
  }
  return result.data as T;
}

const api: MusicApi = {
  search: (query: string, filter?: string): Promise<SearchResult> => {
    return invokeIpc<SearchResult>(IPC_CHANNELS.SEARCH, query, filter);
  },
  getTrack: (sourceId: string): Promise<Track> => {
    return invokeIpc<Track>(IPC_CHANNELS.GET_TRACK, sourceId);
  },
  getArtist: (sourceId: string): Promise<Artist> => {
    return invokeIpc<Artist>(IPC_CHANNELS.GET_ARTIST, sourceId);
  },
  getAlbum: (sourceId: string): Promise<Album> => {
    return invokeIpc<Album>(IPC_CHANNELS.GET_ALBUM, sourceId);
  },
  resolveStream: (sourceId: string): Promise<StreamInfo> => {
    return invokeIpc<StreamInfo>(IPC_CHANNELS.RESOLVE_STREAM, sourceId);
  },
  getActiveSource: (): Promise<string> => {
    return invokeIpc<string>(IPC_CHANNELS.GET_ACTIVE_SOURCE);
  },
  setActiveSource: (sourceId: string): Promise<void> => {
    return invokeIpc<void>(IPC_CHANNELS.SET_ACTIVE_SOURCE, sourceId);
  },
  listSources: (): Promise<SourceMeta[]> => {
    return invokeIpc<SourceMeta[]>(IPC_CHANNELS.LIST_SOURCES);
  },
  getAppInfo: (): Promise<AppInfo> => {
    return invokeIpc<AppInfo>(IPC_CHANNELS.GET_APP_INFO);
  },
  dbGetSetting: (key: string): Promise<string | null> => {
    return invokeIpc<string | null>(IPC_CHANNELS.DB_GET_SETTING, key);
  },
  dbSetSetting: (key: string, value: string): Promise<void> => {
    return invokeIpc<void>(IPC_CHANNELS.DB_SET_SETTING, key, value);
  },
  dbSavePlayback: (state: SavedPlayback): Promise<void> => {
    return invokeIpc<void>(IPC_CHANNELS.DB_SAVE_PLAYBACK, state);
  },
  dbGetPlayback: (): Promise<SavedPlayback | null> => {
    return invokeIpc<SavedPlayback | null>(IPC_CHANNELS.DB_GET_PLAYBACK);
  },
  dbSaveQueue: (tracks: Track[]): Promise<void> => {
    return invokeIpc<void>(IPC_CHANNELS.DB_SAVE_QUEUE, tracks);
  },
  dbGetQueue: (): Promise<Track[]> => {
    return invokeIpc<Track[]>(IPC_CHANNELS.DB_GET_QUEUE);
  },
  dbAddHistory: (track: Track): Promise<void> => {
    return invokeIpc<void>(IPC_CHANNELS.DB_ADD_HISTORY, track);
  },
  dbGetHistory: (limit?: number): Promise<Track[]> => {
    return invokeIpc<Track[]>(IPC_CHANNELS.DB_GET_HISTORY, limit);
  },
  dbClearAllHistory: (): Promise<ClearHistoryResult> => {
    return invokeIpc<ClearHistoryResult>(IPC_CHANNELS.DB_CLEAR_ALL_HISTORY);
  },
  setPowerSaveBlocker: (isPlaying: boolean): Promise<void> => {
    return invokeIpc<void>(IPC_CHANNELS.POWER_SET_PLAYBACK_ACTIVE, isPlaying);
  },
  getPowerSaveBlockerStatus: (): Promise<PowerBlockerStatus> => {
    return invokeIpc<PowerBlockerStatus>(IPC_CHANNELS.POWER_GET_BLOCKER_STATUS);
  },
  onSuspend: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('power:suspend', handler);
    return () => ipcRenderer.removeListener('power:suspend', handler);
  },
  onResume: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('power:resume', handler);
    return () => ipcRenderer.removeListener('power:resume', handler);
  },
};

// Ekspos secara aman lewat contextBridge (contextIsolation: true)
contextBridge.exposeInMainWorld('musicApi', api);

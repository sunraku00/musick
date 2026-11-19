import { contextBridge, ipcRenderer } from 'electron';
import { MusicSourceError, type MusicSourceErrorPayload } from '../shared/errors';
import { IPC_CHANNELS, type MusicApi } from '../shared/ipc';
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
  search: (query: string): Promise<SearchResult> => {
    return invokeIpc<SearchResult>(IPC_CHANNELS.SEARCH, query);
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
};

// Ekspos secara aman lewat contextBridge (contextIsolation: true)
contextBridge.exposeInMainWorld('musicApi', api);

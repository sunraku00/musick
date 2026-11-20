import { app, ipcMain } from 'electron';
import { MusicSourceError, type MusicSourceErrorPayload } from '../shared/errors';
import { IPC_CHANNELS, type AppInfo, type SavedPlayback } from '../shared/ipc';
import type { MusicSource } from '../shared/source';
import type { SourceMeta, Track } from '../shared/types';
import { MockSource } from './adapters/mock/mockSource';
import { YtMusicSource } from './adapters/ytmusic/ytmusicSource';
import { DatabaseService } from './db/database';

declare const __COMMIT_HASH__: string;

export interface SourceManagerOptions {
  readonly isPackaged?: boolean;
  readonly defaultSource?: string;
  readonly envSource?: string;
}

export class SourceManager {
  private sources: Map<string, MusicSource> = new Map();
  private activeSourceId: string;
  private readonly isPackaged: boolean;

  constructor(options?: SourceManagerOptions) {
    let packaged = false;
    try {
      packaged = options?.isPackaged ?? (app ? app.isPackaged : process.env.NODE_ENV === 'production');
    } catch {
      packaged = options?.isPackaged ?? (process.env.NODE_ENV === 'production');
    }
    this.isPackaged = Boolean(packaged);

    const envSource = options?.envSource ?? process.env.MUSICK_SOURCE;

    // Sumber YouTube Music selalu terpasang sebagai sumber utama
    const ytmusic = new YtMusicSource();
    this.sources.set(ytmusic.id, ytmusic);

    // MockSource HANYA diizinkan jika sedang development (!isPackaged) ATAU jika env MUSICK_SOURCE=mock
    const allowMock = !this.isPackaged || envSource === 'mock';
    if (allowMock) {
      const mock = new MockSource();
      this.sources.set(mock.id, mock);
    }

    // Default sumber bawaan rilis HARUS ytmusic! Dilarang fallback diam-diam ke MockSource.
    if (envSource === 'mock' && allowMock) {
      this.activeSourceId = 'mock';
    } else if (options?.defaultSource && this.sources.has(options.defaultSource)) {
      this.activeSourceId = options.defaultSource;
    } else {
      this.activeSourceId = 'ytmusic';
    }
  }

  getActiveSource(): MusicSource {
    const source = this.sources.get(this.activeSourceId);
    if (!source) {
      throw new MusicSourceError('UNAVAILABLE', `Sumber '${this.activeSourceId}' tidak ditemukan`);
    }
    return source;
  }

  setActiveSource(id: string): void {
    if (this.isPackaged && id === 'mock' && process.env.MUSICK_SOURCE !== 'mock') {
      throw new MusicSourceError('UNAVAILABLE', 'Sumber Mock dinonaktifkan pada build rilis');
    }
    if (!this.sources.has(id)) {
      throw new MusicSourceError('UNAVAILABLE', `Sumber '${id}' tidak valid atau tidak terpasang`);
    }
    this.activeSourceId = id;
  }

  listSources(): SourceMeta[] {
    return Array.from(this.sources.values()).map((s) => ({
      id: s.id,
      name: s.name,
    }));
  }
}

export function registerIpcHandlers(
  sourceManager: SourceManager,
  dbService?: DatabaseService,
  updateBlocker?: (isPlaying: boolean) => { active: boolean; blockerId: number | null; settingEnabled: boolean },
  getBlockerStatus?: () => { active: boolean; blockerId: number | null; settingEnabled: boolean }
): void {
  // Helper pembungkus untuk serialisasi error IPC
  const handleIpc = <TArgs extends unknown[], TReturn>(
    channel: string,
    handler: (...args: TArgs) => Promise<TReturn>
  ) => {
    ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
      try {
        return { success: true, data: await handler(...(args as TArgs)) };
      } catch (err: unknown) {
        if (err instanceof MusicSourceError) {
          return { success: false, error: err.toJSON() };
        }
        const fallback: MusicSourceErrorPayload = {
          name: 'MusicSourceError',
          code: 'NETWORK',
          message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem',
          retryable: false,
        };
        return { success: false, error: fallback };
      }
    });
  };

  handleIpc(IPC_CHANNELS.SEARCH, async (query: string, filter?: string) => {
    return sourceManager.getActiveSource().search(query, filter);
  });

  handleIpc(IPC_CHANNELS.GET_TRACK, async (sourceId: string) => {
    return sourceManager.getActiveSource().getTrack(sourceId);
  });

  handleIpc(IPC_CHANNELS.GET_ARTIST, async (sourceId: string) => {
    return sourceManager.getActiveSource().getArtist(sourceId);
  });

  handleIpc(IPC_CHANNELS.GET_ALBUM, async (sourceId: string) => {
    return sourceManager.getActiveSource().getAlbum(sourceId);
  });

  handleIpc(IPC_CHANNELS.RESOLVE_STREAM, async (sourceId: string) => {
    return sourceManager.getActiveSource().resolveStream(sourceId);
  });

  handleIpc(IPC_CHANNELS.GET_ACTIVE_SOURCE, async () => {
    return sourceManager.getActiveSource().id;
  });

  handleIpc(IPC_CHANNELS.SET_ACTIVE_SOURCE, async (sourceId: string) => {
    sourceManager.setActiveSource(sourceId);
  });

  handleIpc(IPC_CHANNELS.LIST_SOURCES, async () => {
    return sourceManager.listSources();
  });

  handleIpc(IPC_CHANNELS.GET_APP_INFO, async (): Promise<AppInfo> => {
    let ver = '0.1.3';
    try {
      ver = app.getVersion();
    } catch {
      ver = '0.1.3';
    }
    return {
      version: ver,
      commitHash: (typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : process.env.COMMIT_HASH) || 'unknown',
    };
  });

  // Handler Persistensi Database SQLite (node:sqlite)
  handleIpc(IPC_CHANNELS.DB_GET_SETTING, async (key: string) => {
    return dbService ? dbService.getSetting(key) : null;
  });

  handleIpc(IPC_CHANNELS.DB_SET_SETTING, async (key: string, value: string) => {
    if (dbService) dbService.setSetting(key, value);
    if (key === 'keepPlayingOnScreenOff' && updateBlocker) {
      updateBlocker(undefined as any);
    }
  });

  handleIpc(IPC_CHANNELS.DB_SAVE_PLAYBACK, async (state: SavedPlayback) => {
    if (dbService) dbService.savePlaybackState(state);
  });

  handleIpc(IPC_CHANNELS.DB_GET_PLAYBACK, async () => {
    return dbService ? dbService.getPlaybackState() : null;
  });

  handleIpc(IPC_CHANNELS.DB_SAVE_QUEUE, async (tracks: Track[]) => {
    if (dbService) dbService.saveQueue(tracks);
  });

  handleIpc(IPC_CHANNELS.DB_GET_QUEUE, async () => {
    return dbService ? dbService.getQueue() : [];
  });

  handleIpc(IPC_CHANNELS.DB_ADD_HISTORY, async (track: Track) => {
    if (dbService) dbService.addHistory(track);
  });

  handleIpc(IPC_CHANNELS.DB_GET_HISTORY, async (limit?: number) => {
    return dbService ? dbService.getHistory(limit) : [];
  });

  handleIpc(IPC_CHANNELS.DB_CLEAR_ALL_HISTORY, async () => {
    return dbService ? dbService.clearAllHistory() : { playbackCleared: 0, searchCleared: 0 };
  });

  handleIpc(IPC_CHANNELS.POWER_SET_PLAYBACK_ACTIVE, async (isPlaying: boolean) => {
    if (updateBlocker) {
      updateBlocker(isPlaying);
    }
  });

  handleIpc(IPC_CHANNELS.POWER_GET_BLOCKER_STATUS, async () => {
    if (getBlockerStatus) {
      return getBlockerStatus();
    }
    return { active: false, blockerId: null, settingEnabled: true };
  });
}

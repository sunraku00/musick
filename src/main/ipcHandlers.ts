import { ipcMain } from 'electron';
import { MusicSourceError, type MusicSourceErrorPayload } from '../shared/errors';
import { IPC_CHANNELS } from '../shared/ipc';
import type { MusicSource } from '../shared/source';
import type { SourceMeta } from '../shared/types';
import { MockSource } from './adapters/mock/mockSource';
import { YtMusicSource } from './adapters/ytmusic/ytmusicSource';

export class SourceManager {
  private sources: Map<string, MusicSource> = new Map();
  private activeSourceId: string = 'mock';

  constructor() {
    const mock = new MockSource();
    const ytmusic = new YtMusicSource();
    this.sources.set(mock.id, mock);
    this.sources.set(ytmusic.id, ytmusic);
  }

  getActiveSource(): MusicSource {
    const source = this.sources.get(this.activeSourceId);
    if (!source) {
      throw new MusicSourceError('UNAVAILABLE', `Sumber '${this.activeSourceId}' tidak ditemukan`);
    }
    return source;
  }

  setActiveSource(id: string): void {
    if (!this.sources.has(id)) {
      throw new MusicSourceError('UNAVAILABLE', `Sumber '${id}' tidak valid`);
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

export function registerIpcHandlers(sourceManager: SourceManager): void {
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

  handleIpc(IPC_CHANNELS.SEARCH, async (query: string) => {
    return sourceManager.getActiveSource().search(query);
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
}

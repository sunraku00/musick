import React, { useCallback, useEffect, useState } from 'react';
import { MusicSourceError } from '../shared/errors';
import type { SearchResult, SourceMeta, StreamInfo, Track } from '../shared/types';
import { PlayerBar } from './components/PlayerBar';
import { SearchBar } from './components/SearchBar';
import { SearchResults } from './components/SearchResults';

export const App: React.FC = () => {
  // Renderer HANYA berinteraksi lewat window.musicApi yang diekspos oleh preload
  const api = typeof window !== 'undefined' ? window.musicApi : undefined;

  // State sumber musik aktif
  const [activeSourceId, setActiveSourceId] = useState<string>('mock');
  const [sources, setSources] = useState<SourceMeta[]>([]);

  // State pencarian
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // State pemutar
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const [playbackNotification, setPlaybackNotification] = useState<string | null>(null);

  // Ambil daftar sumber dan sumber aktif saat inisialisasi
  useEffect(() => {
    if (!api) return;
    Promise.all([api.listSources(), api.getActiveSource()])
      .then(([sourceList, currentId]) => {
        setSources(sourceList);
        setActiveSourceId(currentId);
      })
      .catch((err) => {
        console.error('Gagal memuat daftar sumber musik:', err);
      });
  }, [api]);

  const handleSourceChange = async (newId: string) => {
    if (!api) return;
    try {
      await api.setActiveSource(newId);
      setActiveSourceId(newId);
      setSearchResults(null);
      setSearchError(null);
    } catch (err) {
      console.error('Gagal mengganti sumber:', err);
    }
  };

  const handleSearch = useCallback(
    async (query: string) => {
      if (!api) {
        setSearchError('API musik tidak tersedia di lingkungan ini.');
        return;
      }
      setIsSearching(true);
      setSearchError(null);
      try {
        const results = await api.search(query);
        setSearchResults(results);
      } catch (err) {
        if (err instanceof MusicSourceError) {
          setSearchError(err.getUserMessage());
        } else if (err && typeof err === 'object' && 'code' in err) {
          setSearchError(MusicSourceError.fromJSON(err as any).getUserMessage());
        } else {
          setSearchError('Terjadi kesalahan saat mencari lagu.');
        }
      } finally {
        setIsSearching(false);
      }
    },
    [api]
  );

  const playTrack = useCallback(
    async (track: Track, retryCount = 0) => {
      if (!api) return;
      setCurrentTrack(track);
      setIsLoadingStream(true);
      setPlaybackNotification(null);

      try {
        const info = await api.resolveStream(track.sourceId);
        setStreamInfo(info);
      } catch (err) {
        console.error('Gagal mengambil stream:', err);
        if (retryCount < 1) {
          console.log('Mencoba ambil ulang stream 1x...');
          return playTrack(track, retryCount + 1);
        }
        if (err instanceof MusicSourceError) {
          setPlaybackNotification(err.getUserMessage());
        } else if (err && typeof err === 'object' && 'code' in err) {
          setPlaybackNotification(MusicSourceError.fromJSON(err as any).getUserMessage());
        } else {
          setPlaybackNotification('Gagal memutar lagu.');
        }
        setStreamInfo(null);
      } finally {
        setIsLoadingStream(false);
      }
    },
    [api]
  );

  const handleStreamExpiredOrFailed = useCallback(() => {
    if (currentTrack) {
      console.warn('Alamat stream kedaluwarsa/gagal, memicu ambil ulang...');
      playTrack(currentTrack);
    }
  }, [currentTrack, playTrack]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-logo">🎵</span>
          <span className="brand-name">Musick</span>
          <span className="badge-m0">M0 Spike</span>
        </div>

        <div className="source-switcher">
          <label htmlFor="source-select" className="source-label">
            Sumber:
          </label>
          <select
            id="source-select"
            value={activeSourceId}
            onChange={(e) => handleSourceChange(e.target.value)}
            className="source-select"
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="app-main">
        {!api && (
          <div className="notification-banner">
            <span>
              Perhatian: window.musicApi belum terhubung (pastikan aplikasi dijalankan via Electron).
            </span>
          </div>
        )}

        <div className="search-section">
          <SearchBar onSearch={handleSearch} isLoading={isSearching} />
        </div>

        {playbackNotification && (
          <div className="notification-banner">
            <span>{playbackNotification}</span>
            <button
              type="button"
              className="notification-close"
              onClick={() => setPlaybackNotification(null)}
            >
              ✕
            </button>
          </div>
        )}

        <div className="content-area">
          <SearchResults
            results={searchResults}
            error={searchError}
            onSelectTrack={playTrack}
            activeTrackId={currentTrack?.id}
          />
        </div>
      </main>

      <PlayerBar
        track={currentTrack}
        streamInfo={streamInfo}
        isLoadingStream={isLoadingStream}
        onStreamExpiredOrFailed={handleStreamExpiredOrFailed}
      />
    </div>
  );
};

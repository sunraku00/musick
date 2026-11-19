import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { usePlayer } from '../contexts/PlayerContext';
import { BoundedSearchCache, SearchCoordinator } from '../utils/searchManager';
import { ID_STRINGS } from '../../shared/i18n/id';
import { MusicSourceError } from '../../shared/errors';
import type { SearchResult, Track } from '../../shared/types';

const coordinator = new SearchCoordinator(new BoundedSearchCache(50));

export const SearchPage: React.FC = () => {
  const { searchQuery, setSearchQuery } = useNavigation();
  const { setQueue, state: playerState } = usePlayer();

  const [inputVal, setInputVal] = useState<string>(searchQuery);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'tracks' | 'artists' | 'albums'>('all');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const executeSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const api = window.musicApi;
      if (!api) throw new Error('API window.musicApi tidak ditemukan');

      const { result, isLatest } = await coordinator.search(trimmed, (q) => api.search(q));

      if (isLatest && result) {
        setResults(result);
        setIsLoading(false);
      }
    } catch (err: any) {
      setIsLoading(false);
      let userMsg = ID_STRINGS.errors.generic;

      if (err instanceof MusicSourceError) {
        userMsg = err.getUserMessage();
      } else if (err?.code) {
        const mapped = MusicSourceError.fromJSON(err);
        userMsg = mapped.getUserMessage();
      } else if (err?.message) {
        userMsg = err.message;
      }
      setErrorMessage(userMsg);
    }
  }, []);

  // Debounce 400 ms sesuai PRD F1
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!inputVal.trim()) {
      setResults(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(inputVal);
      executeSearch(inputVal);
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputVal, executeSearch, setSearchQuery]);

  const handleRetry = () => {
    if (inputVal.trim()) {
      executeSearch(inputVal);
    }
  };

  const handleTrackClick = (track: Track, index: number) => {
    if (results && results.tracks.length > 0) {
      setQueue(results.tracks, index);
    } else {
      setQueue([track], 0);
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Kolom Pencarian */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={ID_STRINGS.search.placeholder}
          style={{
            width: '100%',
            maxWidth: '480px',
            padding: '12px 18px 12px 42px',
            borderRadius: '500px',
            backgroundColor: '#242424',
            border: '1px solid transparent',
            color: '#ffffff',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#ffffff')}
          onBlur={(e) => (e.target.style.borderColor = 'transparent')}
        />
        <span
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#b3b3b3',
            fontSize: '16px',
            pointerEvents: 'none',
          }}
        >
          🔍
        </span>
      </div>

      {/* Pesan Kesalahan dengan Tombol Coba Lagi (PRD F1) */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: '#2d1515',
            border: '1px solid #5c2222',
            color: '#ff8a8a',
            padding: '16px 20px',
            borderRadius: '6px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>⚠️</span>
            <span style={{ fontSize: '13px' }}>{errorMessage}</span>
          </div>
          <button
            onClick={handleRetry}
            style={{
              backgroundColor: '#3d1d1d',
              color: '#ffffff',
              border: '1px solid #7d2e2e',
              padding: '6px 14px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {ID_STRINGS.search.retryBtn}
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: '#b3b3b3', marginBottom: '8px' }}>
            {ID_STRINGS.search.loading}
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                height: '56px',
                backgroundColor: '#181818',
                borderRadius: '6px',
                animation: 'pulse 1.5s infinite ease-in-out',
              }}
            />
          ))}
        </div>
      )}

      {/* State Awal: Belum Mencari */}
      {!isLoading && !results && !errorMessage && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#777777' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔎</div>
          <h3 style={{ fontSize: '16px', color: '#ffffff', margin: '0 0 6px 0' }}>
            {ID_STRINGS.search.emptyQueryTitle}
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#888888' }}>
            {ID_STRINGS.search.emptyQueryDesc}
          </p>
        </div>
      )}

      {/* State Kosong: Tidak Ada Hasil */}
      {!isLoading && results && results.tracks.length === 0 && !errorMessage && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <h3 style={{ fontSize: '16px', color: '#ffffff', margin: '0 0 6px 0' }}>
            {ID_STRINGS.search.noResultsTitle}
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#888888', maxWidth: '400px', marginInline: 'auto' }}>
            {ID_STRINGS.search.noResultsDesc(inputVal)}
          </p>
        </div>
      )}

      {/* Daftar Hasil Trek */}
      {!isLoading && results && results.tracks.length > 0 && (
        <section>
          <h3 style={{ fontSize: '16px', color: '#ffffff', margin: '0 0 16px 0' }}>
            {ID_STRINGS.search.tabTracks} ({results.tracks.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {results.tracks.map((track, idx) => {
              const isCurrent = playerState.currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => handleTrackClick(track, idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    backgroundColor: isCurrent ? '#282828' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.backgroundColor = '#181818';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '13px', color: isCurrent ? '#1db954' : '#777777', width: '20px' }}>
                      {isCurrent ? '▶' : idx + 1}
                    </span>

                    {track.coverUrl ? (
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '4px',
                          backgroundColor: '#282828',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#777777',
                        }}
                      >
                        🎵
                      </div>
                    )}

                    <div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: isCurrent ? '#1db954' : '#ffffff',
                        }}
                      >
                        {track.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#b3b3b3', marginTop: '2px' }}>
                        {track.artists.map((a) => a.name).join(', ')}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: '12px', color: '#b3b3b3' }}>
                    {track.durationSec ? `${Math.floor(track.durationSec / 60)}:${(track.durationSec % 60).toString().padStart(2, '0')}` : '--:--'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

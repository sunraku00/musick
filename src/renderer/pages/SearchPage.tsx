import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { usePlayer } from '../contexts/PlayerContext';
import { BoundedSearchCache, SearchCoordinator } from '../utils/searchManager';
import { ID_STRINGS } from '../../shared/i18n/id';
import { MusicSourceError } from '../../shared/errors';
import type { SearchResult, Track } from '../../shared/types';

const coordinator = new SearchCoordinator(new BoundedSearchCache(50));

export const SearchPage: React.FC = () => {
  const { searchQuery, setSearchQuery, navigateToArtist, navigateToAlbum } = useNavigation();
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

    // Set loading indicator saat mengetik kueri baru agar UI responsif seketika
    setIsLoading(true);

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

      {/* State Kosong: Tidak Ada Hasil (Lagu, Artis, dan Album Semuanya 0) */}
      {!isLoading && results && results.tracks.length === 0 && results.artists.length === 0 && results.albums.length === 0 && !errorMessage && (
        <div id="search-no-results" data-query={results.query} style={{ textAlign: 'center', padding: '60px 0' }}>
          <h3 style={{ fontSize: '16px', color: '#ffffff', margin: '0 0 6px 0' }}>
            {ID_STRINGS.search.noResultsTitle}
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#888888', maxWidth: '400px', marginInline: 'auto' }}>
            {ID_STRINGS.search.noResultsDesc(inputVal)}
          </p>
        </div>
      )}

      {/* Tab Navigasi Kategori (Semua, Lagu, Artis, Album) sesuai PRD F1 */}
      {!isLoading && results && (results.tracks.length > 0 || results.artists.length > 0 || results.albums.length > 0) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            id="tab-all"
            onClick={() => setActiveTab('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '500px',
              backgroundColor: activeTab === 'all' ? '#ffffff' : '#242424',
              color: activeTab === 'all' ? '#000000' : '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {ID_STRINGS.search.tabAll}
          </button>
          <button
            id="tab-tracks"
            onClick={() => setActiveTab('tracks')}
            style={{
              padding: '6px 14px',
              borderRadius: '500px',
              backgroundColor: activeTab === 'tracks' ? '#ffffff' : '#242424',
              color: activeTab === 'tracks' ? '#000000' : '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {ID_STRINGS.search.tabTracks} ({results.tracks.length})
          </button>
          <button
            id="tab-artists"
            onClick={() => setActiveTab('artists')}
            style={{
              padding: '6px 14px',
              borderRadius: '500px',
              backgroundColor: activeTab === 'artists' ? '#ffffff' : '#242424',
              color: activeTab === 'artists' ? '#000000' : '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {ID_STRINGS.search.tabArtists} ({results.artists.length})
          </button>
          <button
            id="tab-albums"
            onClick={() => setActiveTab('albums')}
            style={{
              padding: '6px 14px',
              borderRadius: '500px',
              backgroundColor: activeTab === 'albums' ? '#ffffff' : '#242424',
              color: activeTab === 'albums' ? '#000000' : '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {ID_STRINGS.search.tabAlbums} ({results.albums.length})
          </button>
        </div>
      )}

      {/* Bagian Hasil Terkelompok (PRD F1) */}
      {!isLoading && results && (
        <div id="search-results-container" data-query={results.query} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Kelompok Lagu */}
          {(activeTab === 'all' || activeTab === 'tracks') && results.tracks.length > 0 && (
            <section id="section-tracks">
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
                {ID_STRINGS.search.tabTracks} ({results.tracks.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(activeTab === 'all' ? results.tracks.slice(0, 8) : results.tracks).map((track, idx) => {
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

          {/* Kelompok Artis */}
          {(activeTab === 'all' || activeTab === 'artists') && results.artists.length > 0 && (
            <section id="section-artists">
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
                {ID_STRINGS.search.tabArtists} ({results.artists.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                {(activeTab === 'all' ? results.artists.slice(0, 6) : results.artists).map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => navigateToArtist(artist.id)}
                    style={{
                      backgroundColor: '#181818',
                      padding: '16px',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: '1px solid #282828',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#242424')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#181818')}
                  >
                    {artist.imageUrl ? (
                      <img
                        src={artist.imageUrl}
                        alt={artist.name}
                        style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', marginBottom: '12px' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '96px',
                          height: '96px',
                          borderRadius: '50%',
                          backgroundColor: '#282828',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '32px',
                          marginBottom: '12px',
                        }}
                      >
                        👤
                      </div>
                    )}
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                      {artist.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888888', marginTop: '4px' }}>
                      {ID_STRINGS.search.tabArtists}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Kelompok Album */}
          {(activeTab === 'all' || activeTab === 'albums') && results.albums.length > 0 && (
            <section id="section-albums">
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
                {ID_STRINGS.search.tabAlbums} ({results.albums.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                {(activeTab === 'all' ? results.albums.slice(0, 6) : results.albums).map((album) => (
                  <div
                    key={album.id}
                    onClick={() => navigateToAlbum(album.id)}
                    style={{
                      backgroundColor: '#181818',
                      padding: '16px',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      border: '1px solid #282828',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#242424')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#181818')}
                  >
                    {album.coverUrl ? (
                      <img
                        src={album.coverUrl}
                        alt={album.title}
                        style={{ width: '100%', aspectRatio: '1/1', borderRadius: '4px', objectFit: 'cover', marginBottom: '12px' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '1/1',
                          borderRadius: '4px',
                          backgroundColor: '#282828',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '32px',
                          marginBottom: '12px',
                        }}
                      >
                        💿
                      </div>
                    )}
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {album.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888888', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {album.year ? `${album.year} • ` : ''}{album.artists?.map((a) => a.name).join(', ') || 'Album'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { usePlayer } from '../contexts/PlayerContext';
import type { Artist, Track } from '../../shared/types';
import { ID_STRINGS } from '../../shared/i18n/id';

export const ArtistPage: React.FC = () => {
  const { selectedArtistId, navigateToAlbum, navigateTo } = useNavigation();
  const { setQueue, state: playerState } = usePlayer();

  const [artist, setArtist] = useState<Artist | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedArtistId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const fetchArtist = async () => {
      try {
        if (!window.musicApi) throw new Error('musicApi tidak tersedia');
        const data = await window.musicApi.getArtist(selectedArtistId);
        setArtist(data);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Gagal memuat profil artis');
      } finally {
        setIsLoading(false);
      }
    };

    fetchArtist();
  }, [selectedArtistId]);

  const handlePlayAll = () => {
    if (artist && artist.topTracks && artist.topTracks.length > 0) {
      setQueue(artist.topTracks as Track[], 0);
    }
  };

  const handleTrackClick = (track: Track, index: number) => {
    if (artist && artist.topTracks) {
      setQueue(artist.topTracks as Track[], index);
    } else {
      setQueue([track], 0);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '36px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
          <div style={{ width: '140px', height: '140px', borderRadius: '50%', backgroundColor: '#242424', animation: 'pulse 1.5s infinite ease-in-out' }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: '32px', width: '240px', backgroundColor: '#242424', borderRadius: '4px', marginBottom: '12px' }} />
            <div style={{ height: '16px', width: '120px', backgroundColor: '#242424', borderRadius: '4px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div style={{ padding: '36px 32px' }}>
        <div style={{ backgroundColor: '#2d1515', border: '1px solid #5c2222', color: '#ff8a8a', padding: '16px', borderRadius: '6px' }}>
          ⚠️ {errorMessage}
        </div>
        <button
          onClick={() => navigateTo('search')}
          style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: '#282828', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Kembali ke Pencarian
        </button>
      </div>
    );
  }

  if (!artist) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center', color: '#888888' }}>
        Artis tidak ditemukan.
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Artis */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '28px', marginBottom: '32px' }}>
        {artist.imageUrl ? (
          <img
            src={artist.imageUrl}
            alt={artist.name}
            style={{ width: '160px', height: '160px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
          />
        ) : (
          <div
            style={{
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              backgroundColor: '#282828',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '64px',
            }}
          >
            👤
          </div>
        )}

        <div>
          <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#b3b3b3' }}>
            Artis
          </span>
          <h1 id="artist-title" style={{ fontSize: '36px', fontWeight: 800, margin: '8px 0 16px 0', color: '#ffffff' }}>
            {artist.name}
          </h1>

          {artist.topTracks && artist.topTracks.length > 0 && (
            <button
              id="btn-play-all"
              onClick={handlePlayAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#1db954',
                color: '#000000',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '500px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'transform 0.1s, background-color 0.1s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
            >
              ▶ Putar Semua
            </button>
          )}
        </div>
      </div>

      {/* Lagu Terpopuler */}
      {artist.topTracks && artist.topTracks.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px 0', color: '#ffffff' }}>
            Lagu Populer
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {artist.topTracks.map((track, idx) => {
              const isCurrent = playerState.currentTrack?.id === track.id;
              return (
                <div
                  key={track.id || idx}
                  onClick={() => handleTrackClick(track as Track, idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    backgroundColor: isCurrent ? '#282828' : 'transparent',
                    cursor: 'pointer',
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
                    {track.coverUrl && (
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                    )}
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: isCurrent ? '#1db954' : '#ffffff' }}>
                        {track.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#888888', marginTop: '2px' }}>
                        {track.album?.title || artist.name}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: '12px', color: '#888888' }}>
                    {track.durationSec ? `${Math.floor(track.durationSec / 60)}:${(track.durationSec % 60).toString().padStart(2, '0')}` : '--:--'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Diskografi Album */}
      {artist.albums && artist.albums.length > 0 && (
        <section id="artist-albums">
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px 0', color: '#ffffff' }}>
            Album
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
            {artist.albums.map((alb) => (
              <div
                key={alb.id}
                data-album-card={alb.id}
                onClick={() => navigateToAlbum(alb.id)}
                style={{
                  backgroundColor: '#181818',
                  padding: '16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: '1px solid #282828',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#242424')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#181818')}
              >
                {alb.coverUrl ? (
                  <img
                    src={alb.coverUrl}
                    alt={alb.title}
                    style={{ width: '100%', aspectRatio: '1/1', borderRadius: '4px', objectFit: 'cover', marginBottom: '10px' }}
                  />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '4px', backgroundColor: '#282828', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '10px' }}>
                    💿
                  </div>
                )}
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {alb.title}
                </div>
                <div style={{ fontSize: '12px', color: '#888888', marginTop: '4px' }}>
                  {alb.year || 'Album'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

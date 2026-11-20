import React, { useEffect, useState } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { usePlayer } from '../contexts/PlayerContext';
import type { Album, Track } from '../../shared/types';
import { VirtualizedTrackList } from '../components/VirtualizedTrackList';

export const AlbumPage: React.FC = () => {
  const { selectedAlbumId, navigateToArtist, navigateTo } = useNavigation();
  const { setQueue, state: playerState } = usePlayer();

  const [album, setAlbum] = useState<Album | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAlbumId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const fetchAlbum = async () => {
      try {
        if (!window.musicApi) throw new Error('musicApi tidak tersedia');
        const data = await window.musicApi.getAlbum(selectedAlbumId);
        setAlbum(data);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Gagal memuat detail album');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbum();
  }, [selectedAlbumId]);

  const handlePlayAll = () => {
    if (album && album.tracks && album.tracks.length > 0) {
      setQueue(album.tracks as Track[], 0);
    }
  };

  const handleTrackClick = (track: Track, index: number) => {
    if (album && album.tracks) {
      setQueue(album.tracks as Track[], index);
    } else {
      setQueue([track], 0);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '36px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', marginBottom: '32px' }}>
          <div style={{ width: '180px', height: '180px', borderRadius: '8px', backgroundColor: '#242424', animation: 'pulse 1.5s infinite ease-in-out' }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: '36px', width: '280px', backgroundColor: '#242424', borderRadius: '4px', marginBottom: '12px' }} />
            <div style={{ height: '16px', width: '160px', backgroundColor: '#242424', borderRadius: '4px' }} />
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

  if (!album) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center', color: '#888888' }}>
        Album tidak ditemukan.
      </div>
    );
  }

  const artistName = album.artists.map((a) => a.name).join(', ') || 'Unknown Artist';
  const primaryArtistId = album.artists[0]?.id;

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Album */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '28px', marginBottom: '32px' }}>
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt={album.title}
            style={{ width: '180px', height: '180px', borderRadius: '8px', objectFit: 'cover', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
          />
        ) : (
          <div
            style={{
              width: '180px',
              height: '180px',
              borderRadius: '8px',
              backgroundColor: '#282828',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '64px',
            }}
          >
            💿
          </div>
        )}

        <div>
          <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#b3b3b3' }}>
            Album
          </span>
          <h1 id="album-title" style={{ fontSize: '32px', fontWeight: 800, margin: '6px 0 10px 0', color: '#ffffff' }}>
            {album.title}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#b3b3b3', marginBottom: '18px' }}>
            {primaryArtistId ? (
              <span
                onClick={() => navigateToArtist(primaryArtistId)}
                style={{ fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {artistName}
              </span>
            ) : (
              <span style={{ fontWeight: 600, color: '#ffffff' }}>{artistName}</span>
            )}
            {album.year && <span>• {album.year}</span>}
            {album.tracks && <span>• {album.tracks.length} lagu</span>}
          </div>

          {album.tracks && album.tracks.length > 0 && (
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

      {/* Daftar Trek Album dengan Virtualisasi */}
      {album.tracks && album.tracks.length > 0 && (
        <section>
          <VirtualizedTrackList
            tracks={album.tracks}
            currentTrackId={playerState.currentTrack?.id}
            onTrackClick={handleTrackClick}
            itemHeight={52}
            viewportHeight={Math.min(500, album.tracks.length * 52 + 10)}
          />
        </section>
      )}
    </div>
  );
};

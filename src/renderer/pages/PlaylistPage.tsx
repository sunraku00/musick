import React, { useEffect, useState } from 'react';
import type { PlaylistDetails } from '../../shared/types';
import { useNavigation } from '../contexts/NavigationContext';
import { usePlayer } from '../contexts/PlayerContext';

function formatDuration(sec?: number): string {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const PlaylistPage: React.FC = () => {
  const { selectedPlaylistId, navigateTo, triggerPlaylistRefresh, playlistRefreshKey } = useNavigation();
  const { playTrack, showToast, state: playerState } = usePlayer();
  const [playlist, setPlaylist] = useState<PlaylistDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlaylist = async () => {
    if (!selectedPlaylistId) return;
    try {
      setIsLoading(true);
      const data = await window.musicApi.dbGetPlaylist(selectedPlaylistId);
      setPlaylist(data);
    } catch (err) {
      console.error('Gagal memuat detail playlist:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlaylist();
  }, [selectedPlaylistId, playlistRefreshKey]);

  const handleDeletePlaylist = async () => {
    if (!playlist) return;
    if (window.confirm(`Yakin ingin menghapus playlist "${playlist.name}"? Lagu di database tidak akan terhapus.`)) {
      try {
        await window.musicApi.dbDeletePlaylist(playlist.id);
        triggerPlaylistRefresh();
        showToast(`Playlist "${playlist.name}" dihapus`);
        navigateTo('home');
      } catch (err) {
        console.error('Gagal menghapus playlist:', err);
      }
    }
  };

  const handleRemoveTrack = async (playlistTrackId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.musicApi.dbRemoveTrackFromPlaylist(playlistTrackId);
      triggerPlaylistRefresh();
      showToast('Lagu dihapus dari playlist');
      loadPlaylist();
    } catch (err) {
      console.error('Gagal menghapus trek:', err);
    }
  };

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Memuat playlist...</div>;
  }

  if (!playlist) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
        <h3>Playlist tidak ditemukan</h3>
        <button
          onClick={() => navigateTo('home')}
          style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '36px 32px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Playlist */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '28px' }}>
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #1db954, #191414)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          📁
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#b3b3b3', textTransform: 'uppercase' }}>
            Playlist Lokal
          </div>
          <h1 id="playlist-title" style={{ fontSize: '32px', fontWeight: 800, margin: '4px 0 8px 0', color: '#ffffff' }}>
            {playlist.name}
          </h1>
          {playlist.description && (
            <p id="playlist-desc" style={{ fontSize: '13px', color: '#b3b3b3', margin: '0 0 10px 0', lineHeight: '1.4' }}>
              {playlist.description}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#888888' }}>
            <span>{playlist.trackCount} lagu</span>
            <span>•</span>
            <button
              id="btn-delete-playlist"
              onClick={handleDeletePlaylist}
              style={{
                background: 'none',
                border: 'none',
                color: '#ff6b6b',
                fontSize: '12px',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Hapus Playlist Ini
            </button>
          </div>
        </div>
      </div>

      {/* Track List */}
      {playlist.tracks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#777' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📂</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>Playlist ini masih kosong</div>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>
            Cari lagu dan klik tombol ➕ untuk memasukkannya ke playlist ini.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {playlist.tracks.map((track) => {
            const isCurrent = playerState.currentTrack?.id === track.id;
            const isTrackLoading = isCurrent && playerState.status === 'loading';
            return (
              <div
                key={track.playlistTrackId}
                className="track-row"
                onClick={() => playTrack(track, playlist.tracks)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: isCurrent ? '#242424' : 'transparent',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) e.currentTarget.style.backgroundColor = '#1f1f1f';
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ width: '32px', fontSize: '13px', color: isCurrent ? '#1db954' : '#777777' }}>
                  {isTrackLoading ? '⏳' : isCurrent ? '▶' : track.position}
                </div>

                {track.coverUrl && (
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    loading="lazy"
                    decoding="async"
                    width={40}
                    height={40}
                    style={{ width: '40px', height: '40px', borderRadius: '4px', marginRight: '14px', objectFit: 'cover' }}
                  />
                )}

                <div style={{ flex: 1, minWidth: 0, marginRight: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: isCurrent ? '#1db954' : '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</span>
                    {isTrackLoading && (
                      <span style={{ fontSize: '11px', color: '#1db954', fontWeight: 600, flexShrink: 0 }}>
                        Memuat...
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#b3b3b3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                    {track.artists?.map((a) => a.name).join(', ') || 'Artis Tidak Diketahui'}
                  </div>
                </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button
                  title="Hapus dari playlist ini"
                  onClick={(e) => handleRemoveTrack(track.playlistTrackId, e)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    color: '#888',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ff6b6b')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
                >
                  ✕
                </button>

                <div style={{ width: '45px', textAlign: 'right', fontSize: '12px', color: '#777777' }}>
                  {formatDuration(track.durationSec)}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

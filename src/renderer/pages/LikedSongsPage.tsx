import React, { useState } from 'react';
import type { Track } from '../../shared/types';
import { usePlayer } from '../contexts/PlayerContext';
import { useLibrary } from '../contexts/LibraryContext';
import { AddToPlaylistModal } from '../components/PlaylistModal';

function formatDuration(sec?: number): string {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const LikedSongsPage: React.FC = () => {
  const { likedTracks: tracks, toggleLike, isLoading } = useLibrary();
  const [modalTrack, setModalTrack] = useState<Track | null>(null);
  const { playTrack, showToast, state: playerState } = usePlayer();

  const handleUnlike = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleLike(track);
      showToast('Dihapus dari Lagu yang Disukai');
    } catch (err) {
      console.error('Gagal mengubah status like:', err);
    }
  };

  return (
    <div style={{ padding: '36px 32px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #450af5, #c4efd9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          ❤️
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#b3b3b3', textTransform: 'uppercase' }}>
            Daftar Putar
          </div>
          <h1 id="liked-songs-title" style={{ fontSize: '36px', fontWeight: 800, margin: '4px 0 12px 0', color: '#ffffff' }}>
            Lagu yang Disukai
          </h1>
          <div style={{ fontSize: '14px', color: '#b3b3b3' }}>
            {tracks.length} lagu tersimpan di database lokal
          </div>
        </div>
      </div>

      {/* Track List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Memuat lagu...</div>
      ) : tracks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#777' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎵</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>Belum ada lagu yang disukai</div>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>
            Klik ikon hati (♡) pada lagu apa pun untuk menyimpannya di sini.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tracks.map((track, idx) => {
            const isCurrent = playerState.currentTrack?.id === track.id;
            const isTrackLoading = isCurrent && playerState.status === 'loading';
            return (
              <div
                key={track.id}
                className="track-row liked-track-row"
                onClick={() => playTrack(track, tracks)}
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
                  {isTrackLoading ? '⏳' : isCurrent ? '▶' : idx + 1}
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
                    <span className="liked-track-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</span>
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
                  title="Tambah ke Playlist"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalTrack(track);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '15px',
                    color: '#888',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  ➕
                </button>

                <button
                  className="btn-track-like"
                  title="Hapus dari Lagu yang Disukai"
                  onClick={(e) => handleUnlike(track, e)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '16px',
                    color: '#e2264d',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  ❤️
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

      {modalTrack && (
        <AddToPlaylistModal
          track={modalTrack}
          isOpen={true}
          onClose={() => setModalTrack(null)}
          onSuccess={(pName, isDup) => {
            showToast(isDup ? `Lagu ditambahkan ke ${pName} (duplikat)` : `Lagu ditambahkan ke ${pName}`);
          }}
        />
      )}
    </div>
  );
};

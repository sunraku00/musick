import React, { useState, useEffect } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { ID_STRINGS } from '../../shared/i18n/id';
import { AddToPlaylistModal } from './PlaylistModal';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const PlayerBar: React.FC = () => {
  const { state, togglePlay, pause, seek, setVolume, toggleMute, previous, next, retryPlay, showToast } = usePlayer();
  const { currentTrack, status, positionSec, durationSec, volume, isMuted, error } = state;

  const [isLiked, setIsLiked] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);

  useEffect(() => {
    if (currentTrack) {
      window.musicApi.dbIsTrackLiked(currentTrack.id).then((liked) => {
        setIsLiked(liked);
      }).catch(() => setIsLiked(false));
    } else {
      setIsLiked(false);
    }
  }, [currentTrack]);

  const handleToggleLike = async () => {
    if (!currentTrack) return;
    try {
      const nowLiked = await window.musicApi.dbToggleLikeTrack(currentTrack);
      setIsLiked(nowLiked);
      showToast(nowLiked ? 'Disimpan ke Lagu yang Disukai' : 'Dihapus dari Lagu yang Disukai');
    } catch (err) {
      console.error('Gagal toggle like:', err);
    }
  };

  const isPlaying = status === 'playing';
  const effectiveDuration = durationSec || currentTrack?.durationSec || 0;
  const progressPercent = effectiveDuration > 0 ? (positionSec / effectiveDuration) * 100 : 0;

  return (
    <footer
      style={{
        height: '84px',
        backgroundColor: '#181818',
        borderTop: '1px solid #282828',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        userSelect: 'none',
        zIndex: 100,
      }}
    >
      {/* Kiri: Info Lagu & Tombol Like/Playlist */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '320px', minWidth: '180px' }}>
        {currentTrack?.coverUrl ? (
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
            loading="lazy"
            decoding="async"
            width={52}
            height={52}
            style={{ width: '52px', height: '52px', borderRadius: '4px', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '4px',
              backgroundColor: '#282828',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#777777',
              fontSize: '20px',
            }}
          >
            🎵
          </div>
        )}

        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title={currentTrack?.title}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentTrack?.title || ID_STRINGS.player.unknownTitle}
            </span>
            {status === 'loading' && (
              <span id="playerbar-loading-badge" style={{ fontSize: '11px', color: '#1db954', fontWeight: 500, flexShrink: 0 }}>
                ⏳ Memuat...
              </span>
            )}
          </div>
          <div
            style={{
              color: '#b3b3b3',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '2px',
            }}
            title={currentTrack?.artists?.map((a) => a.name).join(', ')}
          >
            {currentTrack?.artists?.map((a) => a.name).join(', ') || ID_STRINGS.player.unknownArtist}
          </div>
          {status === 'error' && error && (
            <div id="playerbar-error-badge" style={{ color: '#ff6b6b', fontSize: '11px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{error.message}</span>
              <button
                id="btn-retry-playback"
                onClick={retryPlay}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1db954',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Coba lagi
              </button>
            </div>
          )}
        </div>

        {currentTrack && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              id="btn-toggle-like"
              title={isLiked ? 'Hapus dari Lagu Disukai' : 'Suka lagu ini'}
              onClick={handleToggleLike}
              style={{
                background: 'none',
                border: 'none',
                color: isLiked ? '#e2264d' : '#888888',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '4px',
                transition: 'transform 0.1s, color 0.15s',
              }}
            >
              {isLiked ? '❤️' : '🤍'}
            </button>

            <button
              id="btn-add-to-playlist"
              title="Tambah ke Playlist"
              onClick={() => setIsPlaylistModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888888',
                fontSize: '15px',
                cursor: 'pointer',
                padding: '4px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#888888')}
            >
              ➕
            </button>
          </div>
        )}
      </div>

      {/* Tengah: Kontrol Pemutar & Slider Posisi */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          width: '45%',
          maxWidth: '560px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Tombol Sebelumnya */}
          <button
            onClick={previous}
            disabled={!currentTrack}
            aria-label={ID_STRINGS.player.previous}
            style={{
              background: 'none',
              border: 'none',
              color: currentTrack ? '#b3b3b3' : '#555555',
              fontSize: '18px',
              cursor: currentTrack ? 'pointer' : 'default',
              padding: '6px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (currentTrack) e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              if (currentTrack) e.currentTarget.style.color = '#b3b3b3';
            }}
          >
            ⏮
          </button>

          {/* Tombol Putar / Jeda / Batal Memuat */}
          <button
            id="btn-play-pause"
            onClick={() => {
              if (status === 'loading') {
                pause(); // Batalkan pemuatan
              } else {
                togglePlay();
              }
            }}
            disabled={!currentTrack && state.queue.length === 0}
            aria-label={status === 'loading' ? 'Batalkan pemuatan' : isPlaying ? ID_STRINGS.player.pause : ID_STRINGS.player.play}
            title={status === 'loading' ? 'Klik untuk membatalkan pemuatan' : isPlaying ? 'Jeda' : 'Putar'}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              border: 'none',
              color: '#000000',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentTrack || state.queue.length > 0 ? 'pointer' : 'default',
              transition: 'transform 0.1s, background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {status === 'loading' ? '⏳' : isPlaying ? '⏸' : '▶'}
          </button>

          {/* Tombol Berikutnya */}
          <button
            onClick={next}
            disabled={!currentTrack}
            aria-label={ID_STRINGS.player.next}
            style={{
              background: 'none',
              border: 'none',
              color: currentTrack ? '#b3b3b3' : '#555555',
              fontSize: '18px',
              cursor: currentTrack ? 'pointer' : 'default',
              padding: '6px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (currentTrack) e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              if (currentTrack) e.currentTarget.style.color = '#b3b3b3';
            }}
          >
            ⏭
          </button>
        </div>

        {/* Track Bar (Scrubber) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <span style={{ fontSize: '11px', color: '#b3b3b3', width: '38px', textAlign: 'right' }}>
            {formatTime(positionSec)}
          </span>

          <input
            type="range"
            min={0}
            max={effectiveDuration || 100}
            value={positionSec}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!currentTrack}
            style={{
              flex: 1,
              height: '4px',
              appearance: 'none',
              backgroundColor: '#4d4d4d',
              borderRadius: '2px',
              outline: 'none',
              cursor: currentTrack ? 'pointer' : 'default',
              accentColor: '#1db954',
            }}
          />

          <span style={{ fontSize: '11px', color: '#b3b3b3', width: '38px' }}>
            {formatTime(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Kanan: Kontrol Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '180px', justifyContent: 'flex-end' }}>
        <button
          onClick={toggleMute}
          style={{
            background: 'none',
            border: 'none',
            color: '#b3b3b3',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '4px',
          }}
          title={isMuted ? 'Nyalakan Suara (M)' : 'Bisukan Suara (M)'}
        >
          {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isMuted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          style={{
            width: '90px',
            height: '4px',
            appearance: 'none',
            backgroundColor: '#4d4d4d',
            borderRadius: '2px',
            outline: 'none',
            cursor: 'pointer',
            accentColor: '#1db954',
          }}
        />
      </div>

      {isPlaylistModalOpen && currentTrack && (
        <AddToPlaylistModal
          track={currentTrack}
          isOpen={true}
          onClose={() => setIsPlaylistModalOpen(false)}
          onSuccess={(pName, isDup) => {
            showToast(isDup ? `Lagu ditambahkan ke ${pName} (duplikat)` : `Lagu ditambahkan ke ${pName}`);
          }}
        />
      )}
    </footer>
  );
};

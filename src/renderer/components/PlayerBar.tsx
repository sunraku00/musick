import React from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { ID_STRINGS } from '../../shared/i18n/id';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const PlayerBar: React.FC = () => {
  const { state, togglePlay, seek, setVolume, toggleMute, previous, next } = usePlayer();
  const { currentTrack, status, positionSec, durationSec, volume, isMuted } = state;

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
      {/* Kiri: Info Lagu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '280px', minWidth: '180px' }}>
        {currentTrack?.coverUrl ? (
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
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

        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={currentTrack?.title}
          >
            {currentTrack?.title || ID_STRINGS.player.unknownTitle}
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
        </div>
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

          {/* Tombol Putar / Jeda */}
          <button
            onClick={togglePlay}
            disabled={!currentTrack && state.queue.length === 0}
            aria-label={isPlaying ? ID_STRINGS.player.pause : ID_STRINGS.player.play}
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
              cursor: 'pointer',
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

        {/* Progress Bar & Waktu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <span style={{ fontSize: '11px', color: '#b3b3b3', width: '35px', textAlign: 'right' }}>
            {formatTime(positionSec)}
          </span>

          <input
            type="range"
            min={0}
            max={effectiveDuration || 100}
            value={positionSec}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!currentTrack}
            aria-label={ID_STRINGS.player.trackPosition}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              accentColor: '#1db954',
              cursor: currentTrack ? 'pointer' : 'default',
            }}
          />

          <span style={{ fontSize: '11px', color: '#b3b3b3', width: '35px' }}>
            {formatTime(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Kanan: Slider Volume & Mute */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '200px', justifyContent: 'flex-end' }}>
        <button
          onClick={toggleMute}
          aria-label={isMuted ? ID_STRINGS.player.unmute : ID_STRINGS.player.mute}
          style={{
            background: 'none',
            border: 'none',
            color: '#b3b3b3',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '4px',
          }}
          title={isMuted ? 'Bunyikan' : 'Bisukan'}
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
          aria-label={ID_STRINGS.player.volume}
          style={{
            width: '90px',
            height: '4px',
            borderRadius: '2px',
            accentColor: '#1db954',
            cursor: 'pointer',
          }}
        />
      </div>
    </footer>
  );
};

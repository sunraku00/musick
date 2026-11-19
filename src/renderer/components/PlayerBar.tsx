import React, { useEffect, useRef, useState } from 'react';
import type { StreamInfo, Track } from '../../shared/types';

interface PlayerBarProps {
  track: Track | null;
  streamInfo: StreamInfo | null;
  isLoadingStream: boolean;
  onTrackEnded?: () => void;
  onStreamExpiredOrFailed?: () => void;
}

function formatTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  track,
  streamInfo,
  isLoadingStream,
  onTrackEnded,
  onStreamExpiredOrFailed,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (streamInfo?.url) {
      audio.src = streamInfo.url;
      audio.load();
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Autoplay tertahan atau pemutaran gagal:', err);
          setIsPlaying(false);
        });
    } else {
      audio.src = '';
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [streamInfo]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !streamInfo?.url) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || track?.durationSec || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleAudioError = () => {
    console.error('Audio playback error occurred');
    setIsPlaying(false);
    if (onStreamExpiredOrFailed) {
      onStreamExpiredOrFailed();
    }
  };

  if (!track) {
    return (
      <footer className="player-bar empty-player">
        <div className="player-empty-text">Pilih lagu untuk mulai memutar</div>
      </footer>
    );
  }

  return (
    <footer className="player-bar">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          if (onTrackEnded) onTrackEnded();
        }}
        onError={handleAudioError}
      />

      <div className="player-track-info">
        <div className="player-cover-wrapper">
          {track.coverUrl ? (
            <img src={track.coverUrl} alt="" className="player-cover" />
          ) : (
            <div className="player-cover-placeholder">♪</div>
          )}
        </div>
        <div className="player-meta">
          <div className="player-title">{track.title}</div>
          <div className="player-artists">
            {track.artists.map((a) => a.name).join(', ')}
          </div>
        </div>
      </div>

      <div className="player-controls-center">
        <div className="player-buttons">
          <button
            type="button"
            className="player-button play-pause-button"
            onClick={togglePlay}
            disabled={isLoadingStream || !streamInfo?.url}
            aria-label={isPlaying ? 'Jeda' : 'Putar'}
          >
            {isLoadingStream ? '⏳' : isPlaying ? '⏸' : '▶'}
          </button>
        </div>

        <div className="player-progress-row">
          <span className="time-display">{formatTime(currentTime)}</span>
          <input
            type="range"
            className="time-slider"
            min={0}
            max={duration || track.durationSec || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!streamInfo?.url}
            aria-label="Posisi pemutaran"
          />
          <span className="time-display">
            {formatTime(duration || track.durationSec || 0)}
          </span>
        </div>
      </div>

      <div className="player-controls-right">
        <button
          type="button"
          className="mute-button"
          onClick={toggleMute}
          aria-label={isMuted ? 'Bunyikan' : 'Bisukan'}
        >
          {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
        </button>
        <input
          type="range"
          className="volume-slider"
          min={0}
          max={1}
          step={0.02}
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          aria-label="Volume audio"
        />
      </div>
    </footer>
  );
};

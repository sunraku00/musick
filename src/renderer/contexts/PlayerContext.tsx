import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { PlayerStateMachine, type PlayerState } from '../../shared/playerStateMachine';
import type { Track } from '../../shared/types';

interface PlayerContextValue {
  state: PlayerState;
  toastMessage: string | null;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (posSec: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  previous: () => void;
  next: () => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const machineRef = useRef<PlayerStateMachine | null>(null);
  if (!machineRef.current) {
    machineRef.current = new PlayerStateMachine(0.8);
  }
  const machine = machineRef.current;

  const [state, setState] = useState<PlayerState>(machine.getState());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stalledTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Inisialisasi audio element sekali
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const clearStalledTimer = () => {
      if (stalledTimerRef.current) {
        clearTimeout(stalledTimerRef.current);
        stalledTimerRef.current = null;
      }
    };

    const handleStalled = () => {
      clearStalledTimer();
      // Batas waktu 6 detik: jika buffer audio macet/stalled lebih dari 6 detik, anggap link putus
      stalledTimerRef.current = setTimeout(() => {
        console.warn('[AudioEngine] Aliran audio macet (stalled > 6s). Mengambil ulang stream...');
        machine.handleStreamError('STALLED', 'Aliran audio terhenti cukup lama.');
      }, 6000);
    };

    audio.addEventListener('timeupdate', () => {
      machine.onTimeUpdate(audio.currentTime, audio.duration);
    });

    audio.addEventListener('ended', () => {
      clearStalledTimer();
      machine.handleTrackEnded();
    });

    audio.addEventListener('playing', () => {
      clearStalledTimer();
    });

    audio.addEventListener('waiting', handleStalled);
    audio.addEventListener('stalled', handleStalled);

    audio.addEventListener('error', () => {
      clearStalledTimer();
      const err = audio.error;
      const msg = err ? `MediaError code ${err.code}: ${err.message}` : 'Kesalahan pemutar audio';
      console.warn('[AudioEngine] Audio element error:', msg);
      machine.handleStreamError('MEDIA_ERR', msg);
    });

    // Registrasi handler Media Session API (Prinsip B)
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => machine.play());
      navigator.mediaSession.setActionHandler('pause', () => machine.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => machine.previous());
      navigator.mediaSession.setActionHandler('nexttrack', () => machine.next());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          machine.seek(details.seekTime);
        }
      });
    }

    const unsubscribe = machine.subscribe(async (event) => {
      if (event.type === 'STATE_CHANGED') {
        setState(event.state);

        // Sinkronisasi status audio DOM dengan state machine
        if (audioRef.current) {
          const domAudio = audioRef.current;
          domAudio.volume = event.state.isMuted ? 0 : event.state.volume;

          if (event.state.status === 'playing' && domAudio.paused && domAudio.src) {
            domAudio.play().catch((e) => console.warn('Play interrupted:', e.message));
          } else if (event.state.status === 'paused' && !domAudio.paused) {
            domAudio.pause();
          }

          // Sinkronisasi posisi jika ada selisih loncatan manual seek (> 1s)
          if (Math.abs(domAudio.currentTime - event.state.positionSec) > 1.5) {
            domAudio.currentTime = event.state.positionSec;
          }
        }

        // Sinkronisasi metadata Media Session
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          const track = event.state.currentTrack;
          if (track) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: track.title,
              artist: track.artists.map((a) => a.name).join(', '),
              album: track.album?.title || '',
              artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: '120x120', type: 'image/jpeg' }] : [],
            });
          }
          navigator.mediaSession.playbackState =
            event.state.status === 'playing'
              ? 'playing'
              : event.state.status === 'paused'
                ? 'paused'
                : 'none';
        }
      } else if (event.type === 'NEED_RESOLVE') {
        try {
          const api = window.musicApi;
          if (!api) throw new Error('API musicApi tidak tersedia');

          const stream = await api.resolveStream(event.track.sourceId || event.track.id);
          if (audioRef.current) {
            audioRef.current.src = stream.url;
            if (event.startPositionSec > 0) {
              audioRef.current.currentTime = event.startPositionSec;
            }
            audioRef.current.play().catch((e) => console.warn('Auto-play blocked or delayed:', e.message));
            machine.onStreamResolved();
          }
        } catch (err: any) {
          const code = err?.code || 'NETWORK';
          const msg = err?.message || 'Gagal menyelesaikan alamat stream';
          console.warn('[PlayerContext] Gagal resolve stream:', code, msg);
          machine.handleStreamError(code, msg);
        }
      } else if (event.type === 'TOAST') {
        setToastMessage(event.message);
        setTimeout(() => setToastMessage(null), 4000);
      }
    });

    return () => {
      clearStalledTimer();
      unsubscribe();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [machine]);

  const value: PlayerContextValue = {
    state,
    toastMessage,
    play: () => machine.play(),
    pause: () => machine.pause(),
    togglePlay: () => machine.togglePlay(),
    seek: (pos: number) => machine.seek(pos),
    setVolume: (vol: number) => machine.setVolume(vol),
    toggleMute: () => machine.toggleMute(),
    previous: () => machine.previous(),
    next: () => machine.next(),
    setQueue: (tracks: Track[], startIndex = 0) => machine.setQueue(tracks, startIndex),
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export const usePlayer = (): PlayerContextValue => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer harus digunakan di dalam PlayerProvider');
  }
  return context;
};

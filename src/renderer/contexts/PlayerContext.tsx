import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { PlayerStateMachine, type PlayerState } from '../../shared/playerStateMachine';
import type { Track } from '../../shared/types';
import { ID_STRINGS } from '../../shared/i18n/id';

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
  playTrack: (track: Track, queueContext?: Track[]) => void;
  retryPlay: () => void;
  showToast: (msg: string) => void;
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
    audio.id = 'musick-audio-engine';
    audio.preload = 'auto';
    audioRef.current = audio;
    document.body.appendChild(audio);

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

    // Inisialisasi status dari persistensi database lokal (node:sqlite)
    const initPersistence = async () => {
      try {
        if (window.musicApi) {
          const [savedQueue, savedPlayback] = await Promise.all([
            window.musicApi.dbGetQueue(),
            window.musicApi.dbGetPlayback(),
          ]);

          if (savedQueue && savedQueue.length > 0) {
            let targetIdx = 0;
            if (savedPlayback?.currentTrack) {
              const foundIdx = savedQueue.findIndex((t) => t.id === savedPlayback.currentTrack?.id);
              if (foundIdx >= 0) targetIdx = foundIdx;
            }

            machine.restoreState({
              queue: savedQueue,
              currentIndex: targetIdx,
              positionSec: savedPlayback?.positionSec || 0,
              volume: savedPlayback?.volume ?? 0.8,
              isMuted: savedPlayback?.isMuted ?? false,
            });
          } else if (savedPlayback) {
            if (typeof savedPlayback.volume === 'number') {
              machine.setVolume(savedPlayback.volume);
            }
          }
        }
      } catch (err) {
        console.warn('[PlayerContext] Gagal memuat persistensi database:', err);
      }
    };
    initPersistence();

    // Deteksi siklus tidur/bangun komputer (PRD F2)
    let cleanSuspend: (() => void) | undefined;
    let cleanResume: (() => void) | undefined;

    if (window.musicApi?.onSuspend) {
      cleanSuspend = window.musicApi.onSuspend(() => {
        console.log('[PlayerContext] Komputer tidur: menjeda audio dan menyimpan posisi...');
        machine.pause();
      });
    }

    if (window.musicApi?.onResume) {
      cleanResume = window.musicApi.onResume(() => {
        console.log('[PlayerContext] Komputer bangun: memulihkan status dalam keadaan jeda...');
        // Tetap dalam keadaan jeda sampai ditekan putar (PRD F2)
        machine.pause();
        setToastMessage('Komputer bangun dari mode tidur. Pemutaran tetap dijeda.');
        setTimeout(() => setToastMessage(null), 4000);
      });
    }

    // Penanganan perangkat audio berganti / headphone dicabut (PRD F2)
    let handleDeviceChange: (() => void) | undefined;
    let knownAudioOutputs: string[] = [];
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          knownAudioOutputs = devices
            .filter((d) => d.kind === 'audiooutput')
            .map((d) => d.deviceId);
        })
        .catch(() => {});

      handleDeviceChange = async () => {
        try {
          const currentDevices = await navigator.mediaDevices.enumerateDevices();
          const currentOutputs = currentDevices
            .filter((d) => d.kind === 'audiooutput')
            .map((d) => d.deviceId);

          // Cek apakah ada output yang hilang (misal headphone/headset Bluetooth dicabut)
          const lostOutput = knownAudioOutputs.find((id) => id && !currentOutputs.includes(id));
          knownAudioOutputs = currentOutputs;

          if (lostOutput && machine.getState().status === 'playing') {
            machine.pause();
            setToastMessage(ID_STRINGS.player.audioDeviceDisconnected);
            setTimeout(() => setToastMessage(null), 4000);
          }
        } catch {
          // Abaikan bila akses mediaDevices gagal
        }
      };
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    const unsubscribe = machine.subscribe(async (event) => {
      if (event.type === 'STATE_CHANGED') {
        setState(event.state);

        // Beri tahu main process untuk mengaktifkan/menonaktifkan powerSaveBlocker (layar mati)
        if (window.musicApi?.setPowerSaveBlocker) {
          window.musicApi.setPowerSaveBlocker(event.state.status === 'playing').catch(() => {});
        }

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

          // Batas waktu resolve maksimal 8 detik (Tambahan B3)
          let timeoutHandle: NodeJS.Timeout;
          const resolvePromise = api.resolveStream(event.track.sourceId || event.track.id);
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(new Error('Waktu penyelesaian stream audio melebihi batas 8 detik'));
            }, 8000);
          });

          const stream = await Promise.race([resolvePromise, timeoutPromise]);
          clearTimeout(timeoutHandle!);

          if (audioRef.current) {
            audioRef.current.src = stream.url;
            if (event.startPositionSec > 0) {
              audioRef.current.currentTime = event.startPositionSec;
            }
            audioRef.current.play().catch((e) => console.warn('Auto-play blocked or delayed:', e.message));
            machine.onStreamResolved();
          }
        } catch (err: any) {
          const code = err?.code || 'TIMEOUT';
          const msg = err?.message || 'Gagal menyelesaikan alamat stream (melebihi 8 detik)';
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
      if (cleanSuspend) cleanSuspend();
      if (cleanResume) cleanResume();
      if (window.musicApi?.setPowerSaveBlocker) {
        window.musicApi.setPowerSaveBlocker(false).catch(() => {});
      }
      if (handleDeviceChange && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        if (audioRef.current.parentNode) {
          audioRef.current.parentNode.removeChild(audioRef.current);
        }
      }
    };
  }, [machine]);

  // Prefetch stream lagu berikutnya di antrean saat lagu sekarang memutar (Tambahan B3 & Guardrails)
  const prefetchedTrackIdRef = useRef<string | null>(null);
  const pausedTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.status === 'paused') {
      if (!pausedTimestampRef.current) {
        pausedTimestampRef.current = Date.now();
      }
    } else if (state.status === 'playing') {
      pausedTimestampRef.current = null;
    }
  }, [state.status]);

  useEffect(() => {
    // Guardrails prefetch:
    // 1. Hanya prefetch bila sedang aktif memutar ('playing')
    // 2. Berhenti dan jangan prefetch jika terjadi pembatasan sumber (BLOCKED / RATE_LIMITED)
    // 3. Berhenti di ujung antrean (currentIndex >= queue.length - 1)
    // 4. Tidak melakukan prefetch saat jeda lama (> 30s) atau status bukan playing
    if (state.status !== 'playing') return;
    if (state.error?.code === 'BLOCKED' || state.error?.code === 'RATE_LIMITED') return;
    if (!state.currentTrack || state.queue.length === 0) return;

    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.queue.length) {
      // Ujung antrean: tidak ada lagu berikutnya untuk diprefetch
      return;
    }

    const nextTrack = state.queue[nextIndex];
    const nextId = nextTrack.sourceId || nextTrack.id;
    if (nextId && prefetchedTrackIdRef.current !== nextId) {
      prefetchedTrackIdRef.current = nextId;
      // Prefetch satu lagu ke depan di latar belakang ke memory cache
      window.musicApi?.resolveStream(nextId).catch((err) => {
        console.warn('[PlayerContext] Prefetch stream gagal diabaikan:', err);
      });
    }
  }, [state.currentTrack?.id, state.status, state.currentIndex, state.queue, state.error?.code]);

  // Persistensi otomatis status pemutar ke SQLite
  useEffect(() => {
    if (window.musicApi) {
      window.musicApi.dbSavePlayback({
        currentTrack: state.currentTrack,
        positionSec: state.positionSec,
        paused: state.status !== 'playing',
        volume: state.volume,
        isMuted: state.isMuted,
      }).catch(() => {});
    }
  }, [state.currentTrack?.id, state.status, state.volume, state.isMuted]);

  useEffect(() => {
    if (window.musicApi && state.queue.length > 0) {
      window.musicApi.dbSaveQueue(state.queue).catch(() => {});
    }
  }, [state.queue]);

  useEffect(() => {
    if (state.currentTrack && state.status === 'playing' && window.musicApi) {
      window.musicApi.dbAddHistory(state.currentTrack).catch(() => {});
    }
  }, [state.currentTrack?.id, state.status]);

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
    playTrack: (track: Track, queueContext?: Track[]) => {
      if (queueContext && queueContext.length > 0) {
        const idx = queueContext.findIndex((t) => t.id === track.id);
        machine.setQueue(queueContext, idx >= 0 ? idx : 0);
      } else {
        machine.setQueue([track], 0);
      }
    },
    retryPlay: () => {
      if (state.currentIndex >= 0 && state.currentIndex < state.queue.length) {
        machine.playIndex(state.currentIndex);
      } else {
        machine.play();
      }
    },
    showToast: (msg: string) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
    },
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

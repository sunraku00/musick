import type { Track } from './types';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface PlayerError {
  code: string;
  message: string;
}

export interface PlayerState {
  queue: Track[];
  currentIndex: number;
  currentTrack: Track | null;
  status: PlayerStatus;
  positionSec: number;
  durationSec: number;
  volume: number;
  isMuted: boolean;
  retryCount: number;
  consecutiveSkips: number;
  error: PlayerError | null;
}

export type PlayerEvent =
  | { type: 'STATE_CHANGED'; state: PlayerState }
  | { type: 'NEED_RESOLVE'; track: Track; startPositionSec: number }
  | { type: 'TOAST'; message: string };

export class PlayerStateMachine {
  private queue: Track[] = [];
  private currentIndex: number = -1;
  private status: PlayerStatus = 'idle';
  private positionSec: number = 0;
  private durationSec: number = 0;
  private volume: number = 1.0;
  private isMuted: boolean = false;
  private retryCount: number = 0;
  private consecutiveSkips: number = 0;
  private error: PlayerError | null = null;

  private listeners: ((event: PlayerEvent) => void)[] = [];

  constructor(initialVolume = 1.0) {
    this.volume = Math.max(0, Math.min(1, initialVolume));
  }

  subscribe(listener: (event: PlayerEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: PlayerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private notifyStateChange(): void {
    this.emit({ type: 'STATE_CHANGED', state: this.getState() });
  }

  getState(): PlayerState {
    const currentTrack = this.queue[this.currentIndex] ?? null;
    return {
      queue: [...this.queue],
      currentIndex: this.currentIndex,
      currentTrack,
      status: this.status,
      positionSec: this.positionSec,
      durationSec: this.durationSec,
      volume: this.volume,
      isMuted: this.isMuted,
      retryCount: this.retryCount,
      consecutiveSkips: this.consecutiveSkips,
      error: this.error ? { ...this.error } : null,
    };
  }

  /**
   * Memulihkan antrean dan status pemutaran dari database lokal.
   * Pemutar dipulihkan dalam keadaan JEDA (paused) sesuai PRD F2.
   */
  restoreState(saved: {
    queue: Track[];
    currentIndex: number;
    positionSec?: number;
    volume?: number;
    isMuted?: boolean;
  }): void {
    if (!saved.queue || saved.queue.length === 0) return;

    this.queue = [...saved.queue];
    const targetIdx = Math.max(0, Math.min(saved.currentIndex, this.queue.length - 1));
    this.currentIndex = targetIdx;
    this.positionSec = Math.max(0, saved.positionSec || 0);
    this.durationSec = this.queue[targetIdx]?.durationSec || 0;
    this.status = 'paused';
    if (typeof saved.volume === 'number') {
      this.volume = Math.max(0, Math.min(1, saved.volume));
    }
    if (typeof saved.isMuted === 'boolean') {
      this.isMuted = saved.isMuted;
    }
    this.retryCount = 0;
    this.consecutiveSkips = 0;
    this.error = null;
    this.notifyStateChange();
  }

  /**
   * Setel antrean dan mulai memutar lagu pada indeks yang ditentukan (default: 0).
   */
  setQueue(tracks: Track[], startIndex = 0): void {
    if (!tracks || tracks.length === 0) {
      this.queue = [];
      this.currentIndex = -1;
      this.status = 'idle';
      this.positionSec = 0;
      this.durationSec = 0;
      this.error = null;
      this.notifyStateChange();
      return;
    }

    this.queue = [...tracks];
    const targetIndex = Math.max(0, Math.min(startIndex, this.queue.length - 1));
    this.playIndex(targetIndex);
  }

  /**
   * Putar lagu pada indeks tertentu dalam antrean.
   */
  playIndex(index: number): void {
    if (index < 0 || index >= this.queue.length) return;

    this.currentIndex = index;
    const track = this.queue[index];
    this.status = 'loading';
    this.positionSec = 0;
    this.durationSec = track.durationSec || 0;
    this.retryCount = 0;
    this.error = null;

    this.notifyStateChange();
    this.emit({ type: 'NEED_RESOLVE', track, startPositionSec: 0 });
  }

  /**
   * Mengatur stream siap dimainkan (dipanggil oleh audio engine setelah resolveStream sukses).
   */
  onStreamResolved(): void {
    if (this.status === 'loading') {
      this.status = 'playing';
      this.notifyStateChange();
    }
  }

  play(): void {
    if (this.status === 'paused') {
      this.status = 'playing';
      this.notifyStateChange();
    } else if (this.status === 'idle' && this.queue.length > 0) {
      this.playIndex(0);
    }
  }

  pause(): void {
    if (this.status === 'playing' || this.status === 'loading') {
      this.status = 'paused';
      this.notifyStateChange();
    }
  }

  togglePlay(): void {
    if (this.status === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(newPositionSec: number): void {
    if (!this.queue[this.currentIndex]) return;

    // Jika menggeser melebihi durasi, perlakukan sebagai akhir lagu
    if (this.durationSec > 0 && newPositionSec >= this.durationSec) {
      this.positionSec = this.durationSec;
      this.notifyStateChange();
      this.handleTrackEnded();
      return;
    }

    this.positionSec = Math.max(0, newPositionSec);
    this.notifyStateChange();
  }

  /**
   * Pembaruan posisi waktu pemutaran (timeupdate event).
   * Reset penghitung lompatan jika lagu terputar stabil lebih dari 5 detik.
   */
  onTimeUpdate(currentSec: number, durationSec?: number): void {
    this.positionSec = Math.max(0, currentSec);
    if (durationSec && durationSec > 0) {
      this.durationSec = durationSec;
    }

    // PRD F2: Reset penghitung lompatan beruntun saat lagu benar-benar terputar > 5 detik
    if (this.positionSec > 5 && this.consecutiveSkips > 0) {
      this.consecutiveSkips = 0;
    }

    this.notifyStateChange();
  }

  /**
   * Tombol "Sebelumnya":
   * Jika lagu sudah diputar lebih dari 3 detik, mulai ulang lagu (detik 0).
   * Jika <= 3 detik, pindah ke lagu sebelumnya di antrean.
   */
  previous(): void {
    if (this.positionSec > 3) {
      this.seek(0);
      return;
    }

    if (this.currentIndex > 0) {
      this.playIndex(this.currentIndex - 1);
    } else {
      // Jika di lagu pertama, tetap restart ke awal
      this.seek(0);
    }
  }

  /**
   * Tombol "Berikutnya":
   * Pindah ke lagu berikutnya dalam antrean jika masih ada.
   */
  next(): void {
    if (this.currentIndex < this.queue.length - 1) {
      this.playIndex(this.currentIndex + 1);
    } else {
      // Akhir antrean
      this.status = 'idle';
      this.positionSec = 0;
      this.notifyStateChange();
    }
  }

  handleTrackEnded(): void {
    this.next();
  }

  /**
   * Penanganan kegagalan pemutaran atau kedaluwarsa URL stream (F2 & Ketahanan Stream).
   * 1. Coba ulang (retry) hingga 2 kali berturut-turut pada lagu yang sama.
   * 2. Gagal 2x berturut-turut: lompat ke lagu berikutnya.
   * 3. Jika 5 lagu berturut-turut gagal: berhenti total (infinite loop guard).
   */
  handleStreamError(errorCode: string, errorMessage: string): void {
    const currentTrack = this.queue[this.currentIndex];
    if (!currentTrack) return;

    if (this.retryCount < 2) {
      // Coba ambil ulang stream secara otomatis (retry)
      this.retryCount += 1;
      this.status = 'loading';
      this.notifyStateChange();
      this.emit({
        type: 'NEED_RESOLVE',
        track: currentTrack,
        startPositionSec: this.positionSec,
      });
      return;
    }

    // Gagal 2 kali berturut-turut pada trek ini
    this.consecutiveSkips += 1;
    this.retryCount = 0;

    this.emit({
      type: 'TOAST',
      message: `Gagal memutar "${currentTrack.title}". Melompat ke trek berikutnya...`,
    });

    // Guard: Maksimal 5 lompatan berturut-turut
    if (this.consecutiveSkips >= 5) {
      this.status = 'error';
      this.error = {
        code: 'LOOP_GUARD',
        message: 'Pemutaran dihentikan: 5 trek berturut-turut gagal dimuat. Periksa koneksi internet Anda.',
      };
      this.notifyStateChange();
      return;
    }

    // Lompat ke trek berikutnya
    if (this.currentIndex < this.queue.length - 1) {
      this.playIndex(this.currentIndex + 1);
    } else {
      this.status = 'idle';
      this.notifyStateChange();
    }
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.volume > 0 && this.isMuted) {
      this.isMuted = false;
    }
    this.notifyStateChange();
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.notifyStateChange();
  }
}

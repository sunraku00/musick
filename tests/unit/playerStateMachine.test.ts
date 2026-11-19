import { describe, it, expect, vi } from 'vitest';
import { PlayerStateMachine } from '../../src/shared/playerStateMachine';
import type { Track } from '../../src/shared/types';

const mockTracks: Track[] = [
  {
    id: 'mock:t1',
    source: 'mock',
    sourceId: 't1',
    title: 'Lagu Pertama',
    artists: [{ id: 'mock:a1', name: 'Artis Satu' }],
    durationSec: 180,
  },
  {
    id: 'mock:t2',
    source: 'mock',
    sourceId: 't2',
    title: 'Lagu Kedua',
    artists: [{ id: 'mock:a1', name: 'Artis Satu' }],
    durationSec: 200,
  },
  {
    id: 'mock:t3',
    source: 'mock',
    sourceId: 't3',
    title: 'Lagu Ketiga',
    artists: [{ id: 'mock:a2', name: 'Artis Dua' }],
    durationSec: 220,
  },
  {
    id: 'mock:t4',
    source: 'mock',
    sourceId: 't4',
    title: 'Lagu Keempat',
    artists: [{ id: 'mock:a2', name: 'Artis Dua' }],
    durationSec: 240,
  },
  {
    id: 'mock:t5',
    source: 'mock',
    sourceId: 't5',
    title: 'Lagu Kelima',
    artists: [{ id: 'mock:a3', name: 'Artis Tiga' }],
    durationSec: 260,
  },
  {
    id: 'mock:t6',
    source: 'mock',
    sourceId: 't6',
    title: 'Lagu Keenam',
    artists: [{ id: 'mock:a3', name: 'Artis Tiga' }],
    durationSec: 280,
  },
];

describe('PlayerStateMachine Unit Tests', () => {
  it('harus memuat antrean dan mulai pada track pertama dengan status loading', () => {
    const sm = new PlayerStateMachine();
    const events: any[] = [];
    sm.subscribe((e) => events.push(e));

    sm.setQueue(mockTracks, 0);

    const state = sm.getState();
    expect(state.queue.length).toBe(6);
    expect(state.currentIndex).toBe(0);
    expect(state.currentTrack?.title).toBe('Lagu Pertama');
    expect(state.status).toBe('loading');

    const needResolve = events.find((e) => e.type === 'NEED_RESOLVE');
    expect(needResolve).toBeDefined();
    expect(needResolve.track.id).toBe('mock:t1');
  });

  it('harus beralih ke playing saat stream resolved, dan toggle play/pause dengan benar', () => {
    const sm = new PlayerStateMachine();
    sm.setQueue(mockTracks, 0);
    sm.onStreamResolved();

    expect(sm.getState().status).toBe('playing');

    sm.pause();
    expect(sm.getState().status).toBe('paused');

    sm.play();
    expect(sm.getState().status).toBe('playing');

    sm.togglePlay();
    expect(sm.getState().status).toBe('paused');
  });

  it('tombol previous harus me-restart lagu jika currentTime > 3 detik', () => {
    const sm = new PlayerStateMachine();
    sm.setQueue(mockTracks, 1); // Lagu Kedua
    sm.onStreamResolved();
    sm.onTimeUpdate(10); // 10 detik

    sm.previous();

    const state = sm.getState();
    // Harus tetap di Lagu Kedua (indeks 1), tapi posisinya kembali ke 0
    expect(state.currentIndex).toBe(1);
    expect(state.positionSec).toBe(0);
  });

  it('tombol previous harus pindah ke lagu sebelumnya jika currentTime <= 3 detik', () => {
    const sm = new PlayerStateMachine();
    sm.setQueue(mockTracks, 1); // Lagu Kedua
    sm.onStreamResolved();
    sm.onTimeUpdate(2); // 2 detik

    sm.previous();

    const state = sm.getState();
    // Harus pindah ke Lagu Pertama (indeks 0)
    expect(state.currentIndex).toBe(0);
    expect(state.currentTrack?.title).toBe('Lagu Pertama');
  });

  it('seek melebihi durasi harus diperlakukan sebagai akhir lagu dan melompat ke track berikutnya', () => {
    const sm = new PlayerStateMachine();
    sm.setQueue(mockTracks, 0); // Lagu Pertama (durasi 180s)
    sm.onStreamResolved();

    sm.seek(190); // Melebihi 180s

    const state = sm.getState();
    expect(state.currentIndex).toBe(1); // Melompat ke Lagu Kedua
    expect(state.currentTrack?.title).toBe('Lagu Kedua');
  });

  it('harus melakukan retry 2x berturut-turut pada lagu yang sama sebelum melompat ke track berikutnya', () => {
    const sm = new PlayerStateMachine();
    const events: any[] = [];
    sm.subscribe((e) => events.push(e));

    sm.setQueue(mockTracks, 0);
    sm.onStreamResolved();

    // Error 1: Harus coba lagi (retry 1)
    sm.handleStreamError('NETWORK', 'Stream timeout');
    expect(sm.getState().retryCount).toBe(1);
    expect(sm.getState().currentIndex).toBe(0);

    // Error 2: Harus coba lagi (retry 2)
    sm.handleStreamError('NETWORK', 'Stream timeout');
    expect(sm.getState().retryCount).toBe(2);
    expect(sm.getState().currentIndex).toBe(0);

    // Error 3: Retry habis (sudah 2x). Harus melompat ke trek berikutnya (indeks 1)
    sm.handleStreamError('NETWORK', 'Stream timeout');
    expect(sm.getState().retryCount).toBe(0);
    expect(sm.getState().consecutiveSkips).toBe(1);
    expect(sm.getState().currentIndex).toBe(1);
    expect(sm.getState().currentTrack?.title).toBe('Lagu Kedua');

    // Memastikan ada event TOAST pemberitahuan ke pengguna
    const toastEvent = events.find((e) => e.type === 'TOAST');
    expect(toastEvent).toBeDefined();
    expect(toastEvent.message).toContain('Melompat ke trek berikutnya');
  });

  it('harus berhenti total (infinite loop guard) setelah 5 lompatan berturut-turut yang gagal', () => {
    const sm = new PlayerStateMachine();
    sm.setQueue(mockTracks, 0);
    sm.onStreamResolved();

    // Simulasi 5 track berturut-turut gagal (masing-masing gagal setelah 2x retry)
    for (let trackIdx = 0; trackIdx < 5; trackIdx++) {
      // 2x retry
      sm.handleStreamError('NETWORK', 'Stream expired');
      sm.handleStreamError('NETWORK', 'Stream expired');
      // Gagal ke-3 -> pemicu skip
      sm.handleStreamError('NETWORK', 'Stream expired');
    }

    const state = sm.getState();
    expect(state.consecutiveSkips).toBe(5);
    expect(state.status).toBe('error');
    expect(state.error?.code).toBe('LOOP_GUARD');
    expect(state.error?.message).toContain('5 trek berturut-turut');
  });

  it('harus mereset consecutiveSkips menjadi 0 ketika lagu berhasil diputar lebih dari 5 detik', () => {
    const sm = new PlayerStateMachine();
    sm.setQueue(mockTracks, 0);
    sm.onStreamResolved();

    // Lagu 1 gagal dan memicu 1x skip ke Lagu 2
    sm.handleStreamError('NETWORK', 'err');
    sm.handleStreamError('NETWORK', 'err');
    sm.handleStreamError('NETWORK', 'err');

    expect(sm.getState().consecutiveSkips).toBe(1);
    expect(sm.getState().currentIndex).toBe(1);

    // Lagu 2 berhasil diputar dan berjalan stabil selama 6 detik
    sm.onTimeUpdate(6, 200);

    expect(sm.getState().consecutiveSkips).toBe(0);
  });
});

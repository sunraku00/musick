import { describe, it, expect, vi } from 'vitest';
import { BridgeManager } from '../../src/main/bridgeManager';
import { MusicSourceError } from '../../src/shared/errors';

describe('BridgeManager Resilience Tests', () => {
  it('harus dapat mematikan proses idle dan bangkit kembali (resurrect) saat ada pemanggilan berikutnya', async () => {
    const manager = new BridgeManager();

    // 1. Inisialisasi start
    manager.start();
    expect(manager.isRunning()).toBe(true);
    const firstPid = manager.getPid();
    expect(firstPid).toBeGreaterThan(0);

    // 2. Simulasi proses mati / dihentikan secara paksa (crash atau idle)
    manager.stopIdle();
    expect(manager.isRunning()).toBe(false);
    expect(manager.getPid()).toBeNull();

    // 3. Hidup kembali (resurrect) saat start dipanggil lagi
    manager.start();
    expect(manager.isRunning()).toBe(true);
    const secondPid = manager.getPid();
    expect(secondPid).toBeGreaterThan(0);
    expect(secondPid).not.toBe(firstPid);

    // Pembersihan
    manager.kill();
    expect(manager.isRunning()).toBe(false);
  });

  it('harus mengembalikan error NETWORK saat bridge dimatikan paksa di tengah request, dan hidup lagi pada request berikutnya', async () => {
    const manager = new BridgeManager();
    manager.start();
    expect(manager.isRunning()).toBe(true);

    // Kirim request search (yang membutuhkan waktu pemrosesan)
    const requestPromise = manager.search('Sheila on 7');

    // Matikan paksa bridge saat request masih pending
    manager.stopIdle();

    // Request yang sedang berjalan harus ditolak dengan error jelas (kelas NETWORK)
    await expect(requestPromise).rejects.toThrow(MusicSourceError);
    await requestPromise.catch((err) => {
      expect(err.code).toBe('NETWORK');
      expect(err.message).toContain('terhenti');
    });

    // Permintaan berikutnya harus secara transparan membangkitkan (resurrect) bridge baru
    const pingRes = await manager.call<any>('health');
    expect(pingRes).toHaveProperty('status', 'ok');
    expect(manager.isRunning()).toBe(true);

    // Pembersihan
    manager.kill();
  });
});

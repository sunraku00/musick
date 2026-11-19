import { describe, it, expect, vi } from 'vitest';
import { BridgeManager } from '../../src/main/bridgeManager';

describe('BridgeManager Resilience Tests', () => {
  it('harus dapat mematikan proses idle dan bangkit kembali (resurrect) saat ada pemanggilan berikutnya', async () => {
    // Jalankan bridge manager dengan script RPC bawaan
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
});

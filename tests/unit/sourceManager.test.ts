import { describe, it, expect } from 'vitest';
import { SourceManager } from '../../src/main/ipcHandlers';

describe('SourceManager Unit Tests (Release Source & Mock Guard)', () => {
  it('paket rilis tanpa variabel lingkungan HARUS memakai ytmusic sebagai sumber bawaan', () => {
    const manager = new SourceManager({ isPackaged: true });
    const active = manager.getActiveSource();

    expect(active.id).toBe('ytmusic');
    expect(active.name).toBe('YouTube Music');
    expect(active.id).not.toBe('mock');
  });

  it('paket rilis TIDAK mendaftarkan MockSource di listSources jika tidak ada MUSICK_SOURCE=mock', () => {
    const manager = new SourceManager({ isPackaged: true });
    const sources = manager.listSources();

    expect(sources.map((s) => s.id)).toEqual(['ytmusic']);
    expect(sources.some((s) => s.id === 'mock')).toBe(false);
  });

  it('paket rilis menolak pergantian ke mock dan melempar error', () => {
    const manager = new SourceManager({ isPackaged: true });
    expect(() => manager.setActiveSource('mock')).toThrow(/Mock dinonaktifkan/);
  });

  it('jika variabel lingkungan MUSICK_SOURCE=mock dieksplisitkan, mock diizinkan untuk uji', () => {
    const manager = new SourceManager({ isPackaged: true, envSource: 'mock' });
    const active = manager.getActiveSource();

    expect(active.id).toBe('mock');
    expect(manager.listSources().map((s) => s.id)).toContain('mock');
  });

  it('pada mode development (!isPackaged), ytmusic tetap menjadi default bawaan', () => {
    const manager = new SourceManager({ isPackaged: false });
    expect(manager.getActiveSource().id).toBe('ytmusic');
    // Namun mock tetap tersedia untuk pengujian offline lokal
    expect(manager.listSources().map((s) => s.id)).toContain('mock');
  });
});

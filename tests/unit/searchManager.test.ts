import { describe, it, expect, vi } from 'vitest';
import { BoundedSearchCache, SearchCoordinator } from '../../src/renderer/utils/searchManager';
import type { SearchResult } from '../../src/shared/types';

const mockResult = (q: string): SearchResult => ({
  query: q,
  tracks: [],
  artists: [],
  albums: [],
});

describe('SearchCoordinator & BoundedSearchCache Unit Tests', () => {
  it('cache harus membatasi maksimal kapasitas dan menerapkan LRU eviction', () => {
    const cache = new BoundedSearchCache(3);
    cache.set('a', mockResult('a'));
    cache.set('b', mockResult('b'));
    cache.set('c', mockResult('c'));

    expect(cache.size()).toBe(3);

    // Akses 'a' agar menjadi recently used
    expect(cache.get('a')?.query).toBe('a');

    // Masukkan 'd' -> 'b' harus dibuang karena paling lama tidak diakses
    cache.set('d', mockResult('d'));
    expect(cache.size()).toBe(3);
    expect(cache.get('b')).toBeNull();
    expect(cache.get('a')?.query).toBe('a');
    expect(cache.get('c')?.query).toBe('c');
    expect(cache.get('d')?.query).toBe('d');
  });

  it('cache harus mengabaikan entri yang sudah melewati masa berlaku (TTL)', async () => {
    const shortTtlMs = 50; // 50 ms untuk uji
    const cache = new BoundedSearchCache(10, shortTtlMs);
    cache.set('sheila', mockResult('sheila'));

    // Sebelum TTL habis: masih ada
    expect(cache.get('sheila')).not.toBeNull();

    // Tunggu hingga melewati TTL
    await new Promise((r) => setTimeout(r, 60));

    // Setelah TTL habis: harus null
    expect(cache.get('sheila')).toBeNull();
  });

  it('latest-wins harus membuang respons kueri lambat yang tiba setelah kueri baru', async () => {
    const coordinator = new SearchCoordinator();

    // Kueri 1: lambat (150 ms)
    const p1 = coordinator.search('sheila', async () => {
      await new Promise((r) => setTimeout(r, 150));
      return mockResult('sheila');
    });

    // Kueri 2: cepat (20 ms)
    await new Promise((r) => setTimeout(r, 10));
    const p2 = coordinator.search('sheila on 7', async () => {
      await new Promise((r) => setTimeout(r, 20));
      return mockResult('sheila on 7');
    });

    const [res1, res2] = await Promise.all([p1, p2]);

    expect(res1.isLatest).toBe(false);
    expect(res1.result).toBeNull();
    expect(res2.isLatest).toBe(true);
    expect(res2.result?.query).toBe('sheila on 7');
  });

  it('harus membatasi maksimal 2 permintaan konkuren dan mengantrekan permintaan berikutnya', async () => {
    const coordinator = new SearchCoordinator();
    let currentConcurrent = 0;
    let maxObservedConcurrent = 0;

    const slowFetcher = async (q: string) => {
      currentConcurrent++;
      maxObservedConcurrent = Math.max(maxObservedConcurrent, currentConcurrent);
      await new Promise((r) => setTimeout(r, 40));
      currentConcurrent--;
      return mockResult(q);
    };

    // Jalankan 4 permintaan sekaligus
    const queries = ['q1', 'q2', 'q3', 'q4'];
    await Promise.all(queries.map((q) => coordinator.search(q, slowFetcher)));

    // Konkurensi tidak boleh pernah melebihi 2
    expect(maxObservedConcurrent).toBeLessThanOrEqual(2);
  });

  it('harus melempar error timeout jika permintaan melebihi batas waktu', async () => {
    // SearchCoordinator dengan timeout custom lewat inheritance/instansiasi
    const coordinator = new SearchCoordinator();
    // Fetcher yang macet selamanya
    const hangingFetcher = () => new Promise<SearchResult>(() => {});

    // Buat kueri dengan mock coordinator bertimeout pendek (50ms)
    const customCoordinator = new SearchCoordinator();
    (customCoordinator as any).timeoutMs = 50;

    await expect(customCoordinator.search('timeout-test', hangingFetcher)).rejects.toThrow(
      'Waktu pencarian habis'
    );
  });
});

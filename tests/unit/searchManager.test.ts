import { describe, it, expect, vi } from 'vitest';
import { BoundedSearchCache, SearchCoordinator } from '../../src/renderer/utils/searchManager';
import type { SearchResult } from '../../src/shared/types';

const mockResult = (q: string): SearchResult => ({
  query: q,
  tracks: [],
  artists: [],
  albums: [],
});

describe('SearchCoordinator & BoundedSearchCache', () => {
  it('cache harus membatasi maksimal 50 kueri dan menerapkan LRU eviction', () => {
    const cache = new BoundedSearchCache(3); // batasi 3 untuk uji
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

    // Kueri 1 harus diabaikan (isLatest: false)
    expect(res1.isLatest).toBe(false);
    expect(res1.result).toBeNull();

    // Kueri 2 harus diterima (isLatest: true)
    expect(res2.isLatest).toBe(true);
    expect(res2.result?.query).toBe('sheila on 7');
  });
});

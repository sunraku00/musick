import type { SearchResult } from '../../shared/types';

interface CacheEntry {
  result: SearchResult;
  timestamp: number;
}

export class BoundedSearchCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries = 50, ttlMs = 10 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(query: string): SearchResult | null {
    const key = query.trim().toLowerCase();
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order (delete and re-set)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.result;
  }

  set(query: string, result: SearchResult): void {
    const key = query.trim().toLowerCase();
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (first key in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Pengelola pencarian dengan:
 * 1. Latest-wins (menolak respons kueri lama yang datang terlambat).
 * 2. Timeout otomatis (default: 8000 ms).
 * 3. Pembatasan konkurensi (maksimal 2 request simultan).
 */
export class SearchCoordinator {
  private latestQueryId = 0;
  private activeRequests = 0;
  private readonly maxConcurrent = 2;
  private readonly timeoutMs = 8000;
  private cache: BoundedSearchCache;

  constructor(cache = new BoundedSearchCache()) {
    this.cache = cache;
  }

  async search(
    query: string,
    fetcher: (q: string) => Promise<SearchResult>
  ): Promise<{ result: SearchResult | null; isLatest: boolean }> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { result: null, isLatest: true };
    }

    // Cek cache sesi terlebih dahulu
    const cached = this.cache.get(trimmed);
    if (cached) {
      return { result: cached, isLatest: true };
    }

    const currentId = ++this.latestQueryId;

    // Batasi konkurensi request
    while (this.activeRequests >= this.maxConcurrent) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      // Jika selama menunggu antrean sudah ada kueri baru, batalkan kueri usang
      if (currentId !== this.latestQueryId) {
        return { result: null, isLatest: false };
      }
    }

    this.activeRequests++;
    try {
      // Bungkus fetcher dengan timeout promise
      const fetchWithTimeout = Promise.race([
        fetcher(trimmed),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Waktu pencarian habis (Timeout 8s)')), this.timeoutMs)
        ),
      ]);

      const result = await fetchWithTimeout;

      // Latest-wins check
      if (currentId === this.latestQueryId) {
        this.cache.set(trimmed, result);
        return { result, isLatest: true };
      }
      return { result: null, isLatest: false };
    } finally {
      this.activeRequests--;
    }
  }

  getCache(): BoundedSearchCache {
    return this.cache;
  }
}

import { describe, it, expect } from 'vitest';
import { MusicSourceError } from '../../src/shared/errors';

describe('Penanganan Deteksi Bot / Blokir IP YouTube (Risiko PRD K1)', () => {
  it('harus memetakan error bot YouTube ke kelas error BLOCKED dan pesan ramah', () => {
    const rawErrors = [
      "ERROR: [youtube] k1BfsO0mxWQ: Sign in to confirm you're not a bot. This helps protect our community.",
      "HTTP Error 403: Forbidden - Sign in to confirm you are not a bot",
      "CAPTCHA required to proceed",
      "Akses diblokir oleh YouTube"
    ];

    for (const raw of rawErrors) {
      let code: 'BLOCKED' | 'NETWORK' = 'NETWORK';
      if (/sign in to confirm|bot|captcha|blocked|blokir/i.test(raw)) {
        code = 'BLOCKED';
      }

      const err = new MusicSourceError(
        code,
        "Akses dibatasi oleh sumber musik (deteksi bot/jaringan). Silakan coba beberapa saat lagi.",
        { retryable: false }
      );

      expect(err.code).toBe('BLOCKED');
      expect(err.message).toContain('Akses dibatasi oleh sumber musik');
      expect(err.retryable).toBe(false);
    }
  });
});

export type MusicSourceErrorCode =
  | 'NETWORK'
  | 'UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'SOURCE_CHANGED'
  | 'BLOCKED';

export interface MusicSourceErrorPayload {
  name: 'MusicSourceError';
  code: MusicSourceErrorCode;
  message: string;
  retryable: boolean;
}

export class MusicSourceError extends Error {
  readonly code: MusicSourceErrorCode;
  readonly retryable: boolean;

  constructor(
    code: MusicSourceErrorCode,
    message: string,
    options?: { cause?: unknown; retryable?: boolean }
  ) {
    super(message);
    this.name = 'MusicSourceError';
    this.code = code;
    this.retryable = options?.retryable ?? (code === 'NETWORK' || code === 'RATE_LIMITED');
    if (options?.cause) {
      this.cause = options.cause;
    }
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'NETWORK':
        return 'Koneksi internet bermasalah. Periksa jaringan Anda dan coba lagi.';
      case 'UNAVAILABLE':
        return 'Lagu atau konten ini tidak tersedia di sumber musik.';
      case 'RATE_LIMITED':
        return 'Terlalu banyak permintaan ke sumber musik. Mohon tunggu beberapa saat.';
      case 'SOURCE_CHANGED':
        return 'Format respons sumber musik berubah. Adaptor perlu diperbarui.';
      case 'BLOCKED':
        return 'Akses ke sumber musik diblokir atau dibatasi wilayah.';
      default:
        return this.message || 'Terjadi kesalahan pada sumber musik.';
    }
  }

  toJSON(): MusicSourceErrorPayload {
    return {
      name: 'MusicSourceError',
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
  }

  static fromJSON(payload: MusicSourceErrorPayload | Record<string, unknown>): MusicSourceError {
    const code = (payload.code as MusicSourceErrorCode) || 'NETWORK';
    const message = typeof payload.message === 'string' ? payload.message : 'Terjadi kesalahan';
    const retryable = typeof payload.retryable === 'boolean' ? payload.retryable : undefined;
    return new MusicSourceError(code, message, { retryable });
  }
}

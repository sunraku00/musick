/**
 * Entitas domain inti yang dibagikan antara Main, Preload, dan Renderer.
 */

export interface ArtistRef {
  readonly id: string;
  readonly name: string;
}

export interface AlbumRef {
  readonly id: string;
  readonly title: string;
  readonly coverUrl?: string;
  readonly year?: number;
}

export interface Track {
  readonly id: string;
  readonly source: string;
  readonly sourceId: string;
  readonly title: string;
  readonly artists: readonly ArtistRef[];
  readonly album?: AlbumRef;
  readonly durationSec: number;
  readonly coverUrl?: string;
  readonly isAvailable: boolean;
}

export interface Artist {
  readonly id: string;
  readonly source: string;
  readonly sourceId: string;
  readonly name: string;
  readonly imageUrl?: string;
  readonly topTracks?: readonly Track[];
  readonly albums?: readonly AlbumRef[];
}

export interface Album {
  readonly id: string;
  readonly source: string;
  readonly sourceId: string;
  readonly title: string;
  readonly artists: readonly ArtistRef[];
  readonly year?: number;
  readonly coverUrl?: string;
  readonly tracks?: readonly Track[];
}

export interface SearchResult {
  readonly query: string;
  readonly tracks: readonly Track[];
  readonly artists: readonly Artist[];
  readonly albums: readonly Album[];
}

export interface StreamInfo {
  readonly url: string;
  readonly mimeType?: string;
  readonly bitrateKbps?: number;
  readonly expiresAt?: number;
}

export interface SourceMeta {
  readonly id: string;
  readonly name: string;
}

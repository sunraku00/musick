import React from 'react';
import type { SearchResult, Track } from '../../shared/types';

interface SearchResultsProps {
  results: SearchResult | null;
  error: string | null;
  onSelectTrack: (track: Track) => void;
  activeTrackId?: string;
}

function formatDuration(sec: number): string {
  if (!sec || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  error,
  onSelectTrack,
  activeTrackId,
}) => {
  if (error) {
    return (
      <div className="status-box error-box">
        <p className="error-title">Gagal memuat hasil</p>
        <p className="error-message">{String(error)}</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="status-box empty-state">
        <p>Ketik judul lagu, nama artis, atau album di kolom cari di atas.</p>
      </div>
    );
  }

  const { query, tracks, artists, albums } = results;
  const hasNoResults = tracks.length === 0 && artists.length === 0 && albums.length === 0;

  if (hasNoResults) {
    return (
      <div className="status-box empty-state">
        <p>Tidak ada hasil untuk &ldquo;{query}&rdquo;</p>
      </div>
    );
  }

  return (
    <div className="results-container">
      {/* Kelompok Lagu */}
      {tracks.length > 0 && (
        <section className="results-section">
          <h2 className="section-title">Lagu ({tracks.length})</h2>
          <div className="track-list">
            {tracks.map((track) => {
              const isActive = activeTrackId === track.id;
              const isUnavailable = !track.isAvailable;
              return (
                <div
                  key={track.id}
                  className={`track-item ${isActive ? 'active' : ''} ${
                    isUnavailable ? 'unavailable' : ''
                  }`}
                  onClick={() => {
                    if (!isUnavailable) onSelectTrack(track);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (!isUnavailable) onSelectTrack(track);
                    }
                  }}
                >
                  <div className="track-cover-wrapper">
                    {track.coverUrl ? (
                      <img
                        src={track.coverUrl}
                        alt=""
                        className="track-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="track-cover-placeholder">♪</div>
                    )}
                  </div>
                  <div className="track-info">
                    {/* Render teks biasa */}
                    <div className="track-title">{track.title}</div>
                    <div className="track-artist">
                      {track.artists.map((a) => a.name).join(', ')}
                    </div>
                  </div>
                  <div className="track-album">
                    {track.album?.title ? track.album.title : '-'}
                  </div>
                  <div className="track-duration">
                    {isUnavailable ? (
                      <span className="unavailable-badge">Tidak tersedia</span>
                    ) : (
                      formatDuration(track.durationSec)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Kelompok Artis */}
      {artists.length > 0 && (
        <section className="results-section">
          <h2 className="section-title">Artis ({artists.length})</h2>
          <div className="card-grid">
            {artists.map((artist) => (
              <div key={artist.id} className="artist-card">
                <div className="artist-avatar-wrapper">
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt="" className="artist-avatar" />
                  ) : (
                    <div className="artist-avatar-placeholder">👤</div>
                  )}
                </div>
                <div className="artist-name">{artist.name}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Kelompok Album */}
      {albums.length > 0 && (
        <section className="results-section">
          <h2 className="section-title">Album ({albums.length})</h2>
          <div className="card-grid">
            {albums.map((album) => (
              <div key={album.id} className="album-card">
                <div className="album-cover-wrapper">
                  {album.coverUrl ? (
                    <img src={album.coverUrl} alt="" className="album-cover" />
                  ) : (
                    <div className="album-cover-placeholder">💿</div>
                  )}
                </div>
                <div className="album-title">{album.title}</div>
                <div className="album-artist">
                  {album.artists.map((a) => a.name).join(', ')}
                  {album.year ? ` • ${album.year}` : ''}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

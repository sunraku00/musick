import React, { useRef, useState, useEffect } from 'react';
import type { Track } from '../../shared/types';

interface VirtualizedTrackListProps {
  tracks: readonly Track[];
  currentTrackId?: string | null;
  onTrackClick: (track: Track, index: number) => void;
  itemHeight?: number;
  viewportHeight?: number;
}

export const VirtualizedTrackList: React.FC<VirtualizedTrackListProps> = ({
  tracks,
  currentTrackId,
  onTrackClick,
  itemHeight = 56,
  viewportHeight = 400,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalCount = tracks.length;
  const totalHeight = totalCount * itemHeight;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Hitung rentang index yang terlihat (buffer 4 item di atas dan bawah)
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 4);
  const endIndex = Math.min(
    totalCount - 1,
    Math.floor((scrollTop + viewportHeight) / itemHeight) + 4
  );

  const visibleTracks = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleTracks.push({ track: tracks[i], index: i });
  }

  const formatDuration = (sec: number) => {
    if (!sec) return '--:--';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      id="virtual-track-list"
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: `${viewportHeight}px`,
        overflowY: 'auto',
        position: 'relative',
      }}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        {visibleTracks.map(({ track, index }) => {
          if (!track) return null;
          const isCurrent = currentTrackId === track.id;
          const topPos = index * itemHeight;

          return (
            <div
              key={track.id || index}
              data-track-row={track.id}
              onClick={() => onTrackClick(track, index)}
              style={{
                position: 'absolute',
                top: `${topPos}px`,
                left: 0,
                right: 0,
                height: `${itemHeight}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                borderRadius: '6px',
                backgroundColor: isCurrent ? '#282828' : 'transparent',
                cursor: 'pointer',
                transition: 'background-color 0.1s',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) e.currentTarget.style.backgroundColor = '#181818';
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '13px', color: isCurrent ? '#1db954' : '#777777', width: '24px' }}>
                  {isCurrent ? '▶' : index + 1}
                </span>

                {track.coverUrl ? (
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '4px',
                      backgroundColor: '#282828',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#777777',
                    }}
                  >
                    🎵
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: isCurrent ? '#1db954' : '#ffffff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {track.title}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#b3b3b3',
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {track.artists.map((a) => a.name).join(', ')}
                  </div>
                </div>
              </div>

              <span style={{ fontSize: '12px', color: '#b3b3b3', marginLeft: '12px' }}>
                {formatDuration(track.durationSec)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

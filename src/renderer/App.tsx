import React, { useEffect } from 'react';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import { PlayerProvider, usePlayer } from './contexts/PlayerContext';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { ArtistPage } from './pages/ArtistPage';
import { AlbumPage } from './pages/AlbumPage';
import { LikedSongsPage } from './pages/LikedSongsPage';
import { PlaylistPage } from './pages/PlaylistPage';

const AppContent: React.FC = () => {
  const { currentPage } = useNavigation();
  const { toastMessage, state, togglePlay, seek, setVolume, toggleMute } = usePlayer();

  // Aksesibilitas Keyboard Global (PRD F2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // 1. Abaikan pintasan jika pengguna sedang mengetik di input teks/textarea
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range'))
      ) {
        return;
      }

      // 2. Tombol (BUTTON): biarkan Space memicu klik native tombol tanpa aksi ganda
      if (target && target.tagName === 'BUTTON' && e.code === 'Space') {
        return;
      }

      // 3. Slider Volume/Posisi (INPUT type="range"): biarkan panah mengatur slider native
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
          return;
        }
      }

      // 4. Kontainer Daftar Bergulir (Scrollable list): biarkan panah atas/bawah menggulir daftar
      if (target && target.scrollHeight > target.clientHeight && ['ArrowUp', 'ArrowDown'].includes(e.code)) {
        const overflowY = window.getComputedStyle(target).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          return;
        }
      }

      // 5. Eksekusi pintasan pemutar global
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seek(Math.max(0, state.positionSec - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seek(Math.min(state.durationSec, state.positionSec + 5));
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume(Math.min(1, state.volume + 0.05));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume(Math.max(0, state.volume - 0.05));
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, togglePlay, seek, setVolume, toggleMute]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#121212',
        color: '#ffffff',
        overflow: 'hidden',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#1db954',
            color: '#000000',
            fontWeight: 600,
            fontSize: '13px',
            padding: '10px 18px',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Main Body (Sidebar + Content) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: '#121212',
            paddingBottom: '24px',
          }}
        >
          {currentPage === 'home' && <HomePage />}
          {currentPage === 'search' && <SearchPage />}
          {currentPage === 'settings' && <SettingsPage />}
          {currentPage === 'artist' && <ArtistPage />}
          {currentPage === 'album' && <AlbumPage />}
          {currentPage === 'liked-songs' && <LikedSongsPage />}
          {currentPage === 'playlist' && <PlaylistPage />}
        </main>
      </div>

      {/* Bottom Player Bar */}
      <PlayerBar />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <NavigationProvider>
      <PlayerProvider>
        <AppContent />
      </PlayerProvider>
    </NavigationProvider>
  );
};

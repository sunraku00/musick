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

const AppContent: React.FC = () => {
  const { currentPage } = useNavigation();
  const { toastMessage, state, togglePlay, seek, setVolume, toggleMute } = usePlayer();

  // Aksesibilitas Keyboard Global (PRD F2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Jangan cegah spasi / panah saat pengguna sedang mengetik di input pencarian
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

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

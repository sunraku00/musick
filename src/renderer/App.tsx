import React from 'react';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import { PlayerProvider, usePlayer } from './contexts/PlayerContext';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';

const AppContent: React.FC = () => {
  const { currentPage } = useNavigation();
  const { toastMessage } = usePlayer();

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

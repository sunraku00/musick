import React, { useEffect, useState } from 'react';
import { useNavigation, type PageId } from '../contexts/NavigationContext';
import { ID_STRINGS } from '../../shared/i18n/id';
import type { Playlist } from '../../shared/types';
import { CreatePlaylistModal } from './PlaylistModal';

export const Sidebar: React.FC = () => {
  const { currentPage, navigateTo, selectedPlaylistId, navigateToPlaylist, playlistRefreshKey, triggerPlaylistRefresh } = useNavigation();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadPlaylists = async () => {
    try {
      const list = await window.musicApi.dbGetPlaylists();
      setPlaylists(list || []);
    } catch (err) {
      console.error('Gagal memuat daftar playlist:', err);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, [playlistRefreshKey]);

  const navItems: { id: PageId; label: string; icon: string }[] = [
    { id: 'home', label: ID_STRINGS.nav.home, icon: '🏠' },
    { id: 'search', label: ID_STRINGS.nav.search, icon: '🔍' },
    { id: 'liked-songs', label: 'Lagu Disukai', icon: '❤️' },
    { id: 'settings', label: ID_STRINGS.nav.settings, icon: '⚙️' },
  ];

  return (
    <aside
      className="sidebar"
      style={{
        width: '240px',
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        userSelect: 'none',
        borderRight: '1px solid #282828',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', paddingLeft: '8px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#1db954',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}
        >
          🎵
        </div>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#ffffff' }}>
            {ID_STRINGS.app.title}
          </h1>
          <span style={{ fontSize: '11px', color: '#b3b3b3' }}>v0.2.0</span>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => navigateTo(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: isActive ? '#282828' : 'transparent',
                color: isActive ? '#ffffff' : '#b3b3b3',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#181818';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#b3b3b3';
                }
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bagian Playlist */}
      <div style={{ marginTop: '24px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Playlist
          </span>
          <button
            id="btn-create-playlist-sidebar"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#1db954',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '4px',
            }}
            title="Buat Playlist Baru"
          >
            + Buat
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {playlists.length === 0 ? (
            <div style={{ padding: '8px', fontSize: '12px', color: '#666666' }}>
              Belum ada playlist
            </div>
          ) : (
            playlists.map((p) => {
              const isSelected = currentPage === 'playlist' && selectedPlaylistId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => navigateToPlaylist(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    backgroundColor: isSelected ? '#242424' : 'transparent',
                    color: isSelected ? '#ffffff' : '#b3b3b3',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '13px',
                    width: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#181818';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#b3b3b3';
                    }
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>📁 {p.name}</span>
                  <span style={{ fontSize: '11px', color: '#666666', marginLeft: '6px' }}>{p.trackCount}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 8px 0 8px', borderTop: '1px solid #222222' }}>
        <p style={{ margin: 0, fontSize: '11px', color: '#777777', lineHeight: '1.4' }}>
          Tanpa iklan • Tanpa akun • Privasi lokal
        </p>
      </div>

      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newP) => {
          triggerPlaylistRefresh();
          navigateToPlaylist(newP.id);
        }}
      />
    </aside>
  );
};

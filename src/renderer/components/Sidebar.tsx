import React from 'react';
import { useNavigation, type PageId } from '../contexts/NavigationContext';
import { ID_STRINGS } from '../../shared/i18n/id';

export const Sidebar: React.FC = () => {
  const { currentPage, navigateTo } = useNavigation();

  const navItems: { id: PageId; label: string; icon: string }[] = [
    { id: 'home', label: ID_STRINGS.nav.home, icon: '🏠' },
    { id: 'search', label: ID_STRINGS.nav.search, icon: '🔍' },
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', paddingLeft: '8px' }}>
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
          <span style={{ fontSize: '11px', color: '#b3b3b3' }}>v0.1.1</span>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 14px',
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
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: '16px 8px', borderTop: '1px solid #222222' }}>
        <p style={{ margin: 0, fontSize: '11px', color: '#777777', lineHeight: '1.4' }}>
          Tanpa iklan • Tanpa akun • Privasi lokal
        </p>
      </div>
    </aside>
  );
};

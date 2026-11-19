import React from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { ID_STRINGS } from '../../shared/i18n/id';

export const HomePage: React.FC = () => {
  const { navigateTo } = useNavigation();

  return (
    <div
      style={{
        padding: '36px 32px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}
    >
      <header style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', color: '#ffffff' }}>
          {ID_STRINGS.home.welcome}
        </h2>
        <p style={{ margin: 0, color: '#b3b3b3', fontSize: '14px' }}>
          {ID_STRINGS.home.subtitle}
        </p>
      </header>

      {/* Keadaan Kosong Terakhir Diputar (Sesuai PRD M1) */}
      <section
        style={{
          backgroundColor: '#181818',
          borderRadius: '8px',
          padding: '48px 24px',
          textAlign: 'center',
          border: '1px solid #282828',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#242424',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
          }}
        >
          🎵
        </div>

        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
            {ID_STRINGS.home.emptyRecentTitle}
          </h3>
          <p style={{ margin: 0, color: '#888888', fontSize: '13px', maxWidth: '420px', lineHeight: '1.5' }}>
            {ID_STRINGS.home.emptyRecentDesc}
          </p>
        </div>

        <button
          onClick={() => navigateTo('search')}
          style={{
            marginTop: '8px',
            padding: '12px 28px',
            backgroundColor: '#1db954',
            color: '#000000',
            fontWeight: 700,
            fontSize: '14px',
            borderRadius: '500px',
            border: 'none',
            cursor: 'pointer',
            transition: 'transform 0.1s, background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1ed760')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1db954')}
        >
          {ID_STRINGS.home.startSearchBtn}
        </button>
      </section>
    </div>
  );
};

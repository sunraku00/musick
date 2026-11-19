import React, { useState } from 'react';
import { ID_STRINGS } from '../../shared/i18n/id';

export const SettingsPage: React.FC = () => {
  const [audioQuality, setAudioQuality] = useState<'economy' | 'high'>('economy');

  return (
    <div style={{ padding: '36px 32px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>
          {ID_STRINGS.settings.title}
        </h2>
      </header>

      {/* Kualitas Audio */}
      <section style={{ backgroundColor: '#181818', borderRadius: '8px', padding: '24px', marginBottom: '24px', border: '1px solid #282828' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: '0 0 16px 0' }}>
          {ID_STRINGS.settings.audioQuality}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="quality"
              value="economy"
              checked={audioQuality === 'economy'}
              onChange={() => setAudioQuality('economy')}
              style={{ marginTop: '3px', accentColor: '#1db954' }}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>
                {ID_STRINGS.settings.qualityEconomy}
              </div>
              <div style={{ fontSize: '12px', color: '#888888', marginTop: '2px' }}>
                {ID_STRINGS.settings.qualityEconomyDesc}
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="quality"
              value="high"
              checked={audioQuality === 'high'}
              onChange={() => setAudioQuality('high')}
              style={{ marginTop: '3px', accentColor: '#1db954' }}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>
                {ID_STRINGS.settings.qualityHigh}
              </div>
              <div style={{ fontSize: '12px', color: '#888888', marginTop: '2px' }}>
                {ID_STRINGS.settings.qualityHighDesc}
              </div>
            </div>
          </label>
        </div>
      </section>

      {/* Privasi dan Lisensi */}
      <section style={{ backgroundColor: '#181818', borderRadius: '8px', padding: '24px', border: '1px solid #282828' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: '0 0 12px 0' }}>
          {ID_STRINGS.settings.privacyTitle}
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#b3b3b3', lineHeight: '1.6' }}>
          {ID_STRINGS.settings.privacyText}
        </p>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #282828', fontSize: '12px', color: '#777777' }}>
          Musick v0.1.0 • Desktop Windows 64-bit • Dibangun dengan Electron + React
        </div>
      </section>
    </div>
  );
};

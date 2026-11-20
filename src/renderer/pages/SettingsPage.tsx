import React, { useEffect, useState } from 'react';
import { ID_STRINGS } from '../../shared/i18n/id';

export const SettingsPage: React.FC = () => {
  const [audioQuality, setAudioQuality] = useState<'economy' | 'high'>('economy');
  const [activeSourceName, setActiveSourceName] = useState<string>('Memuat...');
  const [appInfo, setAppInfo] = useState<{ version: string; commitHash: string }>({
    version: '0.1.2',
    commitHash: '492a4c7',
  });

  const [clearStatus, setClearStatus] = useState<string | null>(null);

  const handleClearHistory = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus seluruh riwayat putar dan riwayat cari secara permanen?')) {
      return;
    }
    if (window.musicApi) {
      try {
        const res = await window.musicApi.dbClearAllHistory();
        setClearStatus(`Berhasil menghapus ${res.playbackCleared} riwayat putar dan ${res.searchCleared} riwayat cari.`);
        setTimeout(() => setClearStatus(null), 5000);
      } catch (err: any) {
        setClearStatus(`Gagal menghapus riwayat: ${err?.message || err}`);
      }
    }
  };

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        if (window.musicApi) {
          const [activeId, sources, info] = await Promise.all([
            window.musicApi.getActiveSource(),
            window.musicApi.listSources(),
            window.musicApi.getAppInfo ? window.musicApi.getAppInfo() : Promise.resolve({ version: '0.1.1', commitHash: 'd3e530d' }),
          ]);
          const match = sources.find((s) => s.id === activeId);
          setActiveSourceName(match ? `${match.name} (${activeId})` : (activeId || 'YouTube Music'));
          if (info) setAppInfo(info);
        }
      } catch {
        setActiveSourceName('YouTube Music (ytmusic)');
      }
    };
    fetchInfo();
  }, []);

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
                Standard / Hemat (WebM Opus ~128 kbps) - Aktif
              </div>
              <div style={{ fontSize: '12px', color: '#888888', marginTop: '2px' }}>
                Kualitas terbaik yang disediakan YouTube tanpa login. Estimasi pemakaian kuota: {( (128 * 3600) / (8 * 1024) ).toFixed(1)} MB/jam.
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', opacity: 0.5, cursor: 'not-allowed' }}>
            <input
              type="radio"
              name="quality"
              value="high"
              disabled
              checked={false}
              style={{ marginTop: '3px' }}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#888888' }}>
                Tinggi (256 kbps AAC) - Tidak Tersedia
              </div>
              <div style={{ fontSize: '12px', color: '#666666', marginTop: '2px' }}>
                Format 256 kbps memerlukan akun YouTube Music Premium. Sumber gratis membatasi aliran maksimal pada ~128 kbps (itag 251 Opus).
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

        {/* Tombol Hapus Riwayat Permanen */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #282828' }}>
          <button
            id="btn-clear-history"
            onClick={handleClearHistory}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3d1d1d',
              color: '#ff8a8a',
              border: '1px solid #5c2222',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5c2222')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3d1d1d')}
          >
            🗑 Hapus Riwayat Putar & Cari
          </button>
          {clearStatus && (
            <span id="clear-status-msg" style={{ marginLeft: '12px', fontSize: '12px', color: '#1db954' }}>
              ✓ {clearStatus}
            </span>
          )}
        </div>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #282828', fontSize: '12px', color: '#777777', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div id="app-version-info">Musick v{appInfo.version} ({appInfo.commitHash}) • Desktop Windows 64-bit • Dibangun dengan Electron + React</div>
          <div id="active-source-badge" style={{ color: '#1db954', fontWeight: 500 }}>
            Sumber musik aktif: {activeSourceName}
          </div>
        </div>
      </section>
    </div>
  );
};

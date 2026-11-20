import React, { useState, useEffect } from 'react';
import type { Playlist, Track } from '../../shared/types';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (playlist: Playlist) => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Nama playlist tidak boleh kosong');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const newPlaylist = await window.musicApi.dbCreatePlaylist(cleanName.slice(0, 100), description.trim().slice(0, 300));
      setName('');
      setDescription('');
      onCreated(newPlaylist);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat playlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#242424',
          borderRadius: '8px',
          padding: '24px',
          width: '420px',
          maxWidth: '90vw',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          border: '1px solid #333333',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
          Buat Playlist Baru
        </h3>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#4a1515',
              color: '#ff8a8a',
              borderRadius: '4px',
              fontSize: '12px',
              marginBottom: '14px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#b3b3b3', marginBottom: '6px' }}>
              Nama Playlist (maks 100 karakter)
            </label>
            <input
              id="input-playlist-name"
              type="text"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Lagu Perjalanan Sore"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#181818',
                border: '1px solid #3a3a3a',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: '11px', color: '#666666', textAlign: 'right', marginTop: '4px' }}>
              {name.length}/100
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#b3b3b3', marginBottom: '6px' }}>
              Deskripsi (opsional, maks 300 karakter)
            </label>
            <textarea
              id="input-playlist-desc"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Catatan ringkas tentang playlist ini..."
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#181818',
                border: '1px solid #3a3a3a',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: '11px', color: '#666666', textAlign: 'right', marginTop: '4px' }}>
              {description.length}/300
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: '1px solid #444444',
                color: '#cccccc',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Batal
            </button>
            <button
              id="btn-save-playlist"
              type="submit"
              disabled={isSubmitting || !name.trim()}
              style={{
                padding: '8px 20px',
                backgroundColor: isSubmitting || !name.trim() ? '#444444' : '#1db954',
                color: isSubmitting || !name.trim() ? '#888888' : '#000000',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: isSubmitting || !name.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AddToPlaylistModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (playlistName: string, isDuplicate: boolean) => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({ track, isOpen, onClose, onSuccess }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      window.musicApi.dbGetPlaylists().then((list) => {
        setPlaylists(list || []);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen || !track) return null;

  const handleSelect = async (p: Playlist) => {
    try {
      const res = await window.musicApi.dbAddTrackToPlaylist(p.id, track);
      onSuccess(p.name, res.isDuplicate);
      onClose();
    } catch (err) {
      console.error('Gagal menambahkan lagu ke playlist:', err);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newPlaylistName.trim();
    if (!cleanName) return;

    try {
      const created = await window.musicApi.dbCreatePlaylist(cleanName.slice(0, 100));
      const res = await window.musicApi.dbAddTrackToPlaylist(created.id, track);
      setNewPlaylistName('');
      setIsCreating(false);
      onSuccess(created.name, res.isDuplicate);
      onClose();
    } catch (err) {
      console.error('Gagal membuat dan menambahkan lagu:', err);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#242424',
          borderRadius: '8px',
          padding: '24px',
          width: '380px',
          maxWidth: '90vw',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          border: '1px solid #333333',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
          Tambahkan ke Playlist
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#888888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          "{track.title}"
        </p>

        {isCreating ? (
          <form onSubmit={handleCreateAndAdd} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text"
              maxLength={100}
              placeholder="Nama playlist baru..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#181818',
                border: '1px solid #3a3a3a',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                style={{ padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid #444', color: '#ccc', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!newPlaylistName.trim()}
                style={{ padding: '6px 14px', backgroundColor: '#1db954', border: 'none', color: '#000', fontWeight: 600, borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
              >
                Buat & Tambah
              </button>
            </div>
          </form>
        ) : (
          <div>
            <button
              onClick={() => setIsCreating(true)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#181818',
                border: '1px dashed #444444',
                color: '#1db954',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <span>➕</span>
              <span>Buat Playlist Baru</span>
            </button>

            <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {isLoading ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#888', fontSize: '12px' }}>Memuat daftar...</div>
              ) : playlists.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#888', fontSize: '12px' }}>Belum ada playlist</div>
              ) : (
                playlists.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2c2c2c')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                    <span style={{ fontSize: '11px', color: '#777777' }}>{p.trackCount} lagu</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#888888',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
